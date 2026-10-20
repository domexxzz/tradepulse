# ตั้ง PostgreSQL บน server-254 ให้เป็นฐานข้อมูลหลักของเว็บ (ต.ค. 2569 — Neon แพ็กเกจฟรีหมดโควตา)
# ขั้นตอนเต็มอยู่ใน docs/DB-SERVER-254.md
#
# รันบน server-254 ใน PowerShell แบบ Run as Administrator หลังลง PostgreSQL 18 แล้ว:
#   powershell -NoProfile -ExecutionPolicy Bypass -File C:\QVXDB\qvx-db-254.ps1 -Phase setup
#   ... -Phase restore                  กู้ไฟล์ .dump ใหม่สุดใน C:\QVXDB (หรือ -Dump <ไฟล์>)
#   ... -Phase cloud -Dump <ไฟล์>        เน็ตเป็น CGNAT: กู้ไฟล์สำรองขึ้น Supabase แทน แล้วเตรียมค่าไปใส่ Vercel
#   ... -Phase merge [-Apply]           เติมข้อมูลหลังไฟล์สำรองจาก Neon เข้า Supabase (เทียบสามทางกับฐานในเครื่อง)
#   ... -Phase backup                   ให้สำรองรายคืน (QVXDatabaseBackup) ดึงจาก Supabase แทน Neon + ลองสำรองทันที
#   ... -Phase portmap [-CheckOnly]      เปิดพอร์ต 55432 ที่เราเตอร์ผ่าน UPnP + เช็ค CGNAT (ไม่ต้องล็อกอินเราเตอร์)
#   ... -Phase ddns -Domain <ชื่อ>       ตั้ง DuckDNS อัปเดตทุก 5 นาที (IP เน็ตบ้านเปลี่ยนได้)
#   ... -Phase url -PublicHost <ชื่อ>.duckdns.org [-PublicPort 55432]
#
# setup   user qvx_app + ฐาน qvx (รหัสสุ่ม 32 ตัว เก็บใน C:\QVXDB\app-password.txt เปิดได้แค่แอดมิน)
#         + ใบรับรอง SSL + รับจากนอกเครื่องเฉพาะ SSL / qvx_app / ฐาน qvx + firewall + ห้ามเครื่องหลับ
#         + รีสตาร์ต + ทดสอบทั้งทางที่ต้องผ่านและทางที่ต้องโดนปฏิเสธ · รันซ้ำได้ รหัสเดิมไม่เปลี่ยน
# restore ฐาน qvx ต้องว่าง ไม่งั้นหยุด (กันกู้ทับข้อมูลจริง) · นับแถวเทียบกับไฟล์ · บอกเวลาข้อมูลล่าสุด
# url     ประกอบ DATABASE_URL ของ Prisma ลง clipboard (ไม่โชว์บนจอ) ไปวางใน Vercel
#
# ข้อความเป็นภาษาอังกฤษล้วนตั้งใจ — คอนโซลภาษาไทยของ Windows เป็น cp874
param(
  [ValidateSet('setup', 'restore', 'cloud', 'merge', 'backup', 'portmap', 'ddns', 'url')][string]$Phase = 'setup',
  [string]$Dump,
  [switch]$CheckOnly,
  [switch]$NoTask,
  [switch]$Apply,     # -Phase merge: ทำจริง (ไม่ใส่ = นับอย่างเดียวแล้ว rollback)
  [switch]$AnyHost,   # ทดสอบเท่านั้น: ไม่บังคับว่า URL ต้องเป็น host/พอร์ตของ Supabase
  [string]$Domain,
  [string]$PublicHost,
  [int]$PublicPort = 55432,
  # ปกติหาเองจาก Windows service ของ PostgreSQL — ส่งเองเฉพาะตอนทดสอบกับ cluster ที่ไม่ได้เป็น service
  [string]$PgBin,
  [string]$DataDir,
  [string]$Root = 'C:\QVXDB'
)

$ErrorActionPreference = 'Stop'
$root = $Root
$pwFile = Join-Path $root 'app-password.txt'
$env:PGCLIENTENCODING = 'UTF8'
$env:PGCONNECT_TIMEOUT = '15'
$OutputEncoding = New-Object Text.UTF8Encoding $false
New-Item -ItemType Directory -Force $root | Out-Null
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$secrets = New-Object Collections.Generic.List[string]

function Hide([string]$s) {
  foreach ($x in $secrets) { if ($x) { $s = $s.Replace($x, '****') } }
  return $s
}
function Lock-File([string]$path) { icacls $path /inheritance:r /grant:r 'Administrators:F' 'SYSTEM:F' "${env:USERNAME}:F" | Out-Null }
function Read-Secret([string]$prompt) {
  # ป้อนผ่าน stdin ได้ด้วย (เช่น < ไฟล์) — Read-Host -AsSecureString ไม่อ่าน stdin จะค้างรอคีย์บอร์ด
  if ([Console]::IsInputRedirected) { return ([Console]::In.ReadLine() + '').Trim() }
  $s = Read-Host -AsSecureString $prompt
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

# ---- หา PostgreSQL ที่ลงไว้ (EDB installer สร้าง service ชื่อ postgresql-x64-18) ----
$service = $null
if (-not ($PgBin -and $DataDir)) {
  $svc = @(Get-CimInstance Win32_Service | Where-Object { $_.Name -like 'postgresql*' } | Sort-Object Name -Descending)[0]
  if (-not $svc) { throw 'No PostgreSQL service found - install PostgreSQL 18 first: winget install -e --id PostgreSQL.PostgreSQL.18 --interactive' }
  if ($svc.PathName -notmatch '^"?(.+?)[\\/]pg_ctl\.exe"?.*\s-D\s+"([^"]+)"') { throw "Cannot read the bin/data folders from service $($svc.Name)" }
  $PgBin = $matches[1] -replace '/', '\'
  $DataDir = $matches[2] -replace '/', '\'
  $service = $svc.Name
}
$port = 5432
foreach ($f in (Join-Path $DataDir 'postgresql.conf'), (Join-Path $DataDir 'postgresql.auto.conf')) {
  if (Test-Path $f) { foreach ($l in Get-Content $f) { if ($l -match '^\s*port\s*=\s*(\d+)') { $port = [int]$matches[1] } } }
}

# SQL ส่งทาง stdin: Windows PowerShell 5.1 ทำ double quote ใน argument หาย (public."User" -> public.User)
function Q([string]$conn, [string]$pass, [string]$sql) {
  $ErrorActionPreference = 'Continue'
  $env:PGPASSWORD = $pass
  $r = $sql | & "$PgBin\psql.exe" -X -q -t -A -F '|' -v ON_ERROR_STOP=1 -d $conn 2>&1
  $code = $LASTEXITCODE
  $env:PGPASSWORD = $null
  if ($code -ne 0) { throw (Hide (($r | Out-String).Trim())) }
  return @($r | Where-Object { $_ -isnot [Management.Automation.ErrorRecord] -and "$_".Trim() -ne '' } | ForEach-Object { "$_" })
}
# @() ทุกครั้ง: ผลแถวเดียวกลับมาเป็น string เฉย ๆ แล้ว "123"[0] จะได้ "1"
function One([string]$conn, [string]$pass, [string]$sql) { return @(Q $conn $pass $sql)[0] }
function Try-Connect([string]$conn, [string]$pass) {
  $ErrorActionPreference = 'Continue'
  $env:PGPASSWORD = $pass
  $r = 'select 1' | & "$PgBin\psql.exe" -X -q -t -A -d $conn 2>&1
  $ok = $LASTEXITCODE -eq 0
  $env:PGPASSWORD = $null
  return [pscustomobject]@{ Ok = $ok; Text = (Hide (($r | Out-String).Trim() -replace '\s+', ' ')) }
}

function Get-AppPassword([switch]$Create) {
  if (Test-Path $pwFile) { $p = (Get-Content $pwFile -Raw).Trim(); $secrets.Add($p); return $p }
  if (-not $Create) { throw "No $pwFile - run -Phase setup first" }
  # ตัวอักษร+ตัวเลขล้วน (ตัดตัวที่อ่านสับสน) ใส่ใน URL ได้โดยไม่ต้อง encode · 32 ตัว ≈ 186 bit
  $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $p = -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
  [IO.File]::WriteAllText($pwFile, $p)
  Lock-File $pwFile
  $secrets.Add($p)
  return $p
}

# ---- ใบรับรอง SSL แบบ self-signed ----
# Prisma (sslmode=require) เข้ารหัสโดยไม่ตรวจผู้ออกใบ — พอสำหรับกันดักฟังระหว่างทาง
# Windows ไม่มี openssl มาให้ จึงสร้างด้วย .NET แล้วเขียน PEM เอง (คีย์แบบ PKCS#1)
function Add-Der([Collections.Generic.List[byte]]$out, [byte]$tag, [byte[]]$content) {
  $out.Add($tag)
  $n = $content.Length
  if ($n -lt 0x80) { $out.Add([byte]$n) }
  elseif ($n -lt 0x100) { $out.Add(0x81); $out.Add([byte]$n) }
  else { $out.Add(0x82); $out.Add([byte]($n -shr 8)); $out.Add([byte]($n -band 0xFF)) }
  $out.AddRange($content)
}
function Get-IntBytes([byte[]]$b) {
  $i = 0
  while ($i -lt $b.Length - 1 -and $b[$i] -eq 0) { $i++ }
  $v = New-Object Collections.Generic.List[byte]
  if ($b[$i] -band 0x80) { $v.Add(0) }
  for ($j = $i; $j -lt $b.Length; $j++) { $v.Add($b[$j]) }
  return , $v.ToArray()
}
function ConvertTo-Pem([string]$label, [byte[]]$der) {
  $b64 = [Convert]::ToBase64String($der, [Base64FormattingOptions]::InsertLineBreaks) -replace "`r", ''
  return "-----BEGIN $label-----`n$b64`n-----END $label-----`n"
}
function New-SslFiles([string]$crtPath, [string]$keyPath) {
  $rsa = New-Object Security.Cryptography.RSACng 2048
  $req = New-Object Security.Cryptography.X509Certificates.CertificateRequest('CN=qvx-db', $rsa, [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1)
  $cert = $req.CreateSelfSigned([DateTimeOffset]::UtcNow.AddDays(-1), [DateTimeOffset]::UtcNow.AddYears(10))
  $p = $rsa.ExportParameters($true)
  $body = New-Object Collections.Generic.List[byte]
  Add-Der $body 0x02 ([byte[]](0))
  foreach ($part in $p.Modulus, $p.Exponent, $p.D, $p.P, $p.Q, $p.DP, $p.DQ, $p.InverseQ) { Add-Der $body 0x02 (Get-IntBytes $part) }
  $key = New-Object Collections.Generic.List[byte]
  Add-Der $key 0x30 $body.ToArray()
  [IO.File]::WriteAllText($crtPath, (ConvertTo-Pem 'CERTIFICATE' $cert.RawData))
  [IO.File]::WriteAllText($keyPath, (ConvertTo-Pem 'RSA PRIVATE KEY' $key.ToArray()))
}

function Restart-Postgres {
  if ($service) {
    Restart-Service $service -Force
    (Get-Service $service).WaitForStatus('Running', [TimeSpan]::FromSeconds(60))
  } else {
    # ไม่ใช่ service (ตอนทดสอบ): ส่ง output ลง nul — ถ้าต่อ pipe ไว้ postgres จะถือ pipe แล้วคำสั่งค้าง
    cmd /c "`"$PgBin\pg_ctl.exe`" -D `"$DataDir`" -w -m fast -l `"$DataDir\qvx-restart.log`" restart > nul 2>&1"
    if ($LASTEXITCODE -ne 0) { throw "pg_ctl restart failed - see $DataDir\qvx-restart.log" }
  }
  Start-Sleep -Seconds 2
}

function Get-LanIPs {
  # ตัด loopback / link-local / Tailscale (100.64.0.0/10) ออก เหลือ IP ในวงแลนที่เราเตอร์ต้องส่งพอร์ตมาให้
  @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
      $_.IPAddress -notmatch '^(127\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)'
    } | ForEach-Object { [pscustomobject]@{ IP = $_.IPAddress; Name = $_.InterfaceAlias } })
}

# ---- นับแถวในไฟล์สำรอง: แปลงเป็น SQL แล้วนับบรรทัดในบล็อก COPY ของแต่ละตาราง ----
function Get-DumpCounts([string]$file) {
  $ErrorActionPreference = 'Continue'
  $lines = & "$PgBin\pg_restore.exe" --data-only -f - $file 2>$null
  if ($LASTEXITCODE -ne 0) { throw "pg_restore could not read $(Split-Path $file -Leaf)" }
  $h = [ordered]@{}; $t = $null
  foreach ($line in $lines) {
    if ($t) { if ($line -eq '\.') { $t = $null } else { $h[$t] = $h[$t] + 1 } }
    elseif ($line -match '^COPY public\."?([^"\s(]+)"?') { $t = $matches[1]; $h[$t] = 0 }
  }
  return $h
}
function Get-DumpCreated([string]$file) {
  $ErrorActionPreference = 'Continue'
  foreach ($l in @(& "$PgBin\pg_restore.exe" --list $file 2>$null)) { if ("$l" -match 'Archive created at (.+)$') { return $matches[1].Trim() } }
  return ''
}

# ---- เปิดพอร์ตที่เราเตอร์ผ่าน UPnP — ไม่ต้องล็อกอินหน้าเราเตอร์ ----
# เราเตอร์บ้านส่วนใหญ่เปิด UPnP ไว้ (เกม/แอปขอเปิดพอร์ตเอง) ถ้าปิดไว้ก็ต้องตั้ง port forward ด้วยมือ
# ถามเราเตอร์ด้วยว่า IP ฝั่ง WAN ของมันคืออะไร: ถ้าเป็นวง private / 100.64.0.0/10 = CGNAT เปิดพอร์ตยังไงก็ไม่ถึง
function Test-PrivateIp([string]$ip) { $ip -match '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)' }
function Find-Gateways([string]$localIp) {
  $udp = New-Object Net.Sockets.UdpClient -ArgumentList (New-Object Net.IPEndPoint -ArgumentList ([Net.IPAddress]::Parse($localIp)), 0)
  $udp.Client.ReceiveTimeout = 1500
  $target = New-Object Net.IPEndPoint -ArgumentList ([Net.IPAddress]::Parse('239.255.255.250')), 1900
  foreach ($st in 'urn:schemas-upnp-org:device:InternetGatewayDevice:1', 'urn:schemas-upnp-org:device:InternetGatewayDevice:2',
    'urn:schemas-upnp-org:service:WANIPConnection:1', 'urn:schemas-upnp-org:service:WANPPPConnection:1') {
    $b = [Text.Encoding]::ASCII.GetBytes("M-SEARCH * HTTP/1.1`r`nHOST: 239.255.255.250:1900`r`nMAN: `"ssdp:discover`"`r`nMX: 2`r`nST: $st`r`n`r`n")
    [void]$udp.Send($b, $b.Length, $target)
  }
  $locations = New-Object 'Collections.Generic.HashSet[string]'
  $until = (Get-Date).AddSeconds(4)
  while ((Get-Date) -lt $until) {
    $from = New-Object Net.IPEndPoint -ArgumentList ([Net.IPAddress]::Any), 0
    try { $text = [Text.Encoding]::ASCII.GetString($udp.Receive([ref]$from)) } catch { continue }
    if ($text -match '(?im)^LOCATION:\s*(\S+)') { [void]$locations.Add($matches[1]) }
  }
  $udp.Close()
  return @($locations)
}
function Get-Text($response) {
  $c = $response.Content
  if ($c -is [byte[]]) { $c = [Text.Encoding]::UTF8.GetString($c) }
  return "$c".Trim()
}
function Get-WanServices([string]$location) {
  try { [xml]$x = Get-Text (Invoke-WebRequest -Uri $location -UseBasicParsing -TimeoutSec 5) } catch { return }
  $base = $x.SelectSingleNode("//*[local-name()='URLBase']")
  $baseUri = if ($base -and $base.InnerText.Trim()) { [Uri]$base.InnerText.Trim() } else { [Uri](([Uri]$location).GetLeftPart([UriPartial]::Authority)) }
  foreach ($s in $x.SelectNodes("//*[local-name()='service']")) {
    $type = "$($s.SelectSingleNode("*[local-name()='serviceType']").InnerText)".Trim()
    if ($type -notmatch 'WAN(IP|PPP)Connection:\d') { continue }
    $ctl = "$($s.SelectSingleNode("*[local-name()='controlURL']").InnerText)".Trim()
    [pscustomobject]@{ Type = $type; Url = (New-Object Uri -ArgumentList $baseUri, $ctl).AbsoluteUri }
  }
}
function Invoke-Upnp($svc, [string]$action, [string]$inner) {
  $body = '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>' +
    "<u:$action xmlns:u=`"$($svc.Type)`">$inner</u:$action></s:Body></s:Envelope>"
  try {
    $r = Invoke-WebRequest -Uri $svc.Url -Method Post -UseBasicParsing -TimeoutSec 8 -ContentType 'text/xml; charset=utf-8' -Headers @{ SOAPAction = "`"$($svc.Type)#$action`"" } -Body $body
    return [pscustomobject]@{ Ok = $true; Xml = [xml](Get-Text $r); Error = '' }
  } catch {
    $detail = "$($_.ErrorDetails.Message)"
    $code = if ($detail -match '<errorCode>(\d+)</errorCode>') { $matches[1] } else { '' }
    $desc = if ($detail -match '<errorDescription>([^<]*)</errorDescription>') { $matches[1] } else { $_.Exception.Message }
    return [pscustomobject]@{ Ok = $false; Xml = $null; Error = "$code $desc".Trim() }
  }
}
function Get-XmlValue($xml, [string]$name) {
  $n = $xml.SelectSingleNode("//*[local-name()='$name']")
  if ($n) { return $n.InnerText.Trim() } else { return '' }
}
function Get-Mapping($svc) {
  $r = Invoke-Upnp $svc 'GetSpecificPortMappingEntry' "<NewRemoteHost></NewRemoteHost><NewExternalPort>$PublicPort</NewExternalPort><NewProtocol>TCP</NewProtocol>"
  if (-not $r.Ok) { return '' }
  return '{0}:{1}' -f (Get-XmlValue $r.Xml 'NewInternalClient'), (Get-XmlValue $r.Xml 'NewInternalPort')
}

# =====================================================================================
if ($Phase -eq 'setup') {
  "PostgreSQL: $PgBin  data: $DataDir  port: $port  service: $(if ($service) { $service } else { '(none)' })"
  $su = "host=127.0.0.1 port=$port dbname=postgres user=postgres sslmode=disable"
  $suPass = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { Read-Secret 'Password of the "postgres" superuser (the one you typed in the installer)' }
  $secrets.Add($suPass)
  'Superuser login: ' + (One $su $suPass 'select current_user')

  $app = Get-AppPassword -Create
  Q $su $suPass @"
do `$`$ begin
  if not exists (select from pg_roles where rolname = 'qvx_app') then
    create role qvx_app login password '$app';
  else
    alter role qvx_app login password '$app';
  end if;
end `$`$;
"@ | Out-Null
  if ((One $su $suPass "select count(*) from pg_database where datname = 'qvx'") -eq '0') {
    Q $su $suPass 'create database qvx owner qvx_app' | Out-Null
  }
  Q $su $suPass 'revoke all on database qvx from public' | Out-Null
  'Role qvx_app + database qvx: ready (password in ' + $pwFile + ', admins only)'

  $crt = Join-Path $DataDir 'server.crt'
  $key = Join-Path $DataDir 'server.key'
  if (-not ((Test-Path $crt) -and (Test-Path $key))) { New-SslFiles $crt $key; 'SSL certificate: created (self-signed, 10 years)' }
  else { 'SSL certificate: already there' }

  Q $su $suPass @"
alter system set listen_addresses = '*';
alter system set ssl = 'on';
alter system set password_encryption = 'scram-sha-256';
alter system set log_connections = 'on';
"@ | Out-Null

  $hba = Join-Path $DataDir 'pg_hba.conf'
  $marker = '# QVX: the website (Vercel) connects from the internet - SSL only, one user, one database'
  $text = [IO.File]::ReadAllText($hba)
  if (-not $text.Contains($marker)) {
    Copy-Item $hba "$hba.before-qvx" -Force
    $nl = if ($text.EndsWith("`n")) { '' } else { "`r`n" }
    [IO.File]::AppendAllText($hba, $nl + (@($marker,
          'hostssl  qvx  qvx_app  0.0.0.0/0  scram-sha-256',
          'hostssl  qvx  qvx_app  ::/0       scram-sha-256') -join "`r`n") + "`r`n")
    'pg_hba.conf: remote rule added (backup: pg_hba.conf.before-qvx)'
  } else { 'pg_hba.conf: remote rule already there' }

  if ($isAdmin) {
    if (-not (Get-NetFirewallRule -DisplayName 'QVX PostgreSQL' -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -DisplayName 'QVX PostgreSQL' -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Any | Out-Null
    }
    'Windows Firewall: inbound TCP ' + $port + ' allowed'
    powercfg /change standby-timeout-ac 0
    powercfg /change hibernate-timeout-ac 0
    'Power: sleep/hibernate on AC = never'
  } else { Write-Warning 'Not running as Administrator - skipped the firewall rule and sleep settings. Re-run as Administrator.' }

  'Restarting PostgreSQL...'
  Restart-Postgres

  # ทดสอบ: ในเครื่อง + ผ่าน IP แลน (ทางเดียวกับที่คนนอกจะเข้ามา) ต้องผ่านเมื่อใช้ SSL และต้องโดนปฏิเสธเมื่อไม่ใช้
  $bad = 0
  $ssl = One "host=127.0.0.1 port=$port dbname=qvx user=qvx_app sslmode=require" $app "select ssl::text || ' ' || coalesce(version, '') from pg_stat_ssl where pid = pg_backend_pid()"
  "Test localhost SSL login as qvx_app: $ssl"
  if ($ssl -notmatch '^true TLS') { $bad++ }
  $lans = Get-LanIPs
  foreach ($l in $lans) {
    $yes = Try-Connect "host=$($l.IP) port=$port dbname=qvx user=qvx_app sslmode=require" $app
    $no = Try-Connect "host=$($l.IP) port=$port dbname=qvx user=qvx_app sslmode=disable" $app
    $su2 = Try-Connect "host=$($l.IP) port=$port dbname=postgres user=postgres sslmode=require" $suPass
    if (-not $yes.Ok -or $no.Ok -or $su2.Ok) { $bad++ }
    '  {0,-15} {1,-22} SSL login {2} | without SSL {3} | superuser from outside {4}' -f $l.IP, $l.Name,
      $(if ($yes.Ok) { 'OK' } else { 'FAILED: ' + $yes.Text }), $(if ($no.Ok) { 'ALLOWED (bad)' } else { 'refused (good)' }), $(if ($su2.Ok) { 'ALLOWED (bad)' } else { 'refused (good)' })
  }

  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $pub = try { "$(Invoke-RestMethod 'https://api.ipify.org' -TimeoutSec 10)".Trim() } catch { '(could not check)' }
  ''
  if ($bad -eq 0) { 'SETUP OK' } else { "SETUP HAS $bad PROBLEM(S) - send this screen to Claude" }
  "Public IP of this internet line: $pub   (compare with the WAN IP on the router page - must be the same)"
  foreach ($l in $lans) { "Router port forward:  TCP $PublicPort (external)  ->  $($l.IP) : $port  ($($l.Name))" }
  return
}

# กู้ไฟล์สำรองเข้าฐานที่ว่างอยู่ แล้วนับแถวเทียบกับไฟล์ + บอกเวลาข้อมูลล่าสุด · คืน $true ถ้าตรงทุกตาราง
function Restore-Dump([string]$conn, [string]$pass) {
  $files = if ($Dump) { @(Get-Item -LiteralPath $Dump) } else { @(Get-ChildItem $root -Filter '*.dump' -File) }
  if (-not $files.Count) { throw "No .dump file in $root - copy the newest qvx-*.dump there, or give -Dump <file>" }
  $pick = $files | ForEach-Object { [pscustomobject]@{ File = $_; Created = (Get-DumpCreated $_.FullName) } } |
    Where-Object Created | Sort-Object Created -Descending | Select-Object -First 1
  if (-not $pick) { throw 'None of the .dump files can be read by pg_restore' }
  Write-Host ('Dump: {0}  ({1:N0} KB, created {2})' -f $pick.File.Name, ($pick.File.Length / 1KB), $pick.Created)
  $expected = Get-DumpCounts $pick.File.FullName
  Write-Host ('Rows in dump: {0} in {1} tables' -f (($expected.Values | Measure-Object -Sum).Sum), $expected.Count)

  $existing = [int](One $conn $pass "select count(*) from information_schema.tables where table_schema = 'public'")
  if ($existing -gt 0) { throw "The target database already has $existing tables - stopping, not overwriting" }

  Write-Host 'Restoring...'
  $ErrorActionPreference = 'Continue'
  $env:PGPASSWORD = $pass
  # --schema=public: สำรองจาก Supabase มี schema ของ Supabase เอง (auth, storage ฯลฯ) ติดมาด้วย ข้อมูลเว็บอยู่ใน public ทั้งหมด
  $log = & "$PgBin\pg_restore.exe" --no-owner --no-acl --schema=public -d $conn $pick.File.FullName 2>&1
  $env:PGPASSWORD = $null
  $errs = @($log | Where-Object { "$_" -match 'error' })
  Write-Host "pg_restore error lines: $($errs.Count)"
  $errs | Select-Object -First 8 | ForEach-Object { Write-Host ('  ' + (Hide "$_")) }

  $bad = 0
  foreach ($t in $expected.Keys) {
    $n = One $conn $pass ('select count(*) from public."{0}"' -f $t)
    $ok = "$n" -eq "$($expected[$t])"; if (-not $ok) { $bad++ }
    Write-Host ('  {0,-30} dump {1,7}  db {2,7}  {3}' -f $t, $expected[$t], $n, $(if ($ok) { 'OK' } else { 'DIFF' }))
  }
  Write-Host $(if ($bad -eq 0) { 'ALL TABLES MATCH' } else { "$bad TABLE(S) DIFFER - send this screen to Claude" })

  # เวลาข้อมูลล่าสุดของแต่ละตาราง (Prisma เก็บเป็น UTC → +7 เป็นเวลาไทย) = ข้อมูลสดถึงเมื่อไหร่
  $cols = @(Q $conn $pass "select table_name, string_agg(column_name, ',') from information_schema.columns where table_schema = 'public' and column_name in ('createdAt', 'updatedAt') group by table_name order by 1")
  $rows = foreach ($row in $cols) {
    $t, $c = $row -split '\|'
    $expr = ($c -split ',' | ForEach-Object { "max(`"$_`")" }) -join ', '
    [pscustomobject]@{ Table = $t; Newest = (One $conn $pass ("select coalesce(to_char(greatest({0}) + interval '7 hours', 'YYYY-MM-DD HH24:MI'), '-') from public.`"{1}`"" -f $expr, $t)) }
  }
  Write-Host 'Newest record per table (Thai time):'
  $rows | Sort-Object Newest -Descending | Select-Object -First 8 | ForEach-Object { Write-Host ('  {0,-30} {1}' -f $_.Table, $_.Newest) }
  return ($bad -eq 0)
}

if ($Phase -eq 'restore') {
  $app = Get-AppPassword
  [void](Restore-Dump "host=127.0.0.1 port=$port dbname=qvx user=qvx_app sslmode=disable" $app)
  return
}

function Assert-SupabaseUrl([string]$name, [string]$url, [string]$wantPort) {
  if ($url -match '\[YOUR-PASSWORD\]') { throw "$name URL still has [YOUR-PASSWORD] - put the database password in" }
  if ($url -notmatch '^postgres(?:ql)?://[^:/@]+:[^@]+@([^:/@]+):(\d+)/[^?]+$') {
    throw "$name URL is not postgresql://user:password@host:port/postgres - if the password has symbols like @ # / ? reset it to letters and digits only (Supabase > Project Settings > Database)"
  }
  $h = $matches[1]; $p = $matches[2]
  if (-not $AnyHost -and ($h -notlike '*.pooler.supabase.com' -or $p -ne $wantPort)) { throw "$name URL: host/port is ${h}:$p, expected *.pooler.supabase.com:$wantPort" }
}

if ($Phase -eq 'cloud') {
  # เน็ตบ้าน 3BB เป็น CGNAT (WAN ของเราเตอร์เป็น 10.x) เว็บบน Vercel ต่อเข้ามาที่เครื่องนี้ไม่ได้
  # จึงกู้ไฟล์สำรองขึ้น Supabase (ฟรี เปิดตลอด ไม่นับชั่วโมงแบบ Neon) จากเครื่องนี้แทน
  Write-Host 'Supabase > your project > Connect. Copy each URL and put your database password in place of [YOUR-PASSWORD].'
  $tx = Read-Secret '1/2 Transaction pooler URL (port 6543)'
  $session = Read-Secret '2/2 Session pooler URL (port 5432)'
  $secrets.Add($tx); $secrets.Add($session)
  # หน้า Prisma ของ Supabase แถม ?pgbouncer=true มาด้วย — ตัด query ทิ้งแล้วเติมของเราเอง
  $tx = ($tx -split '\?')[0]; $session = ($session -split '\?')[0]
  Assert-SupabaseUrl 'Transaction pooler' $tx '6543'
  Assert-SupabaseUrl 'Session pooler' $session '5432'
  'Transaction pooler login: ' + (One $tx '' 'select current_user')
  'Session pooler login: ' + (One $session '' 'select current_user')

  $ok = Restore-Dump $session ''

  # Supabase เปิดทุกตารางใน public ผ่าน REST Data API ให้ role anon/authenticated
  # เว็บต่อผ่าน Prisma เป็น postgres (เจ้าของตาราง ข้าม RLS) → เปิด RLS แบบไม่มี policy + revoke สองตัวนั้น = ปิด API โดยเว็บไม่กระทบ
  if ((One $session '' "select count(*) from pg_roles where rolname in ('anon', 'authenticated')") -eq '2') {
    Q $session '' @'
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
'@ | Out-Null
    $open = One $session '' "select count(*) from pg_tables where schemaname = 'public' and not rowsecurity"
    $granted = One $session '' "select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated')"
    "Supabase Data API locked: tables without RLS $open, grants left to anon/authenticated $granted (both must be 0)"
  }

  # ค่าที่ต้องใส่ใน Vercel: Prisma บน serverless ผ่าน PgBouncer ต้องปิด prepared statement (pgbouncer=true) + 1 connection ต่อ instance
  $dbUrl = $tx + '?pgbouncer=true&connection_limit=1'
  $out = Join-Path $root 'vercel-env.txt'
  [IO.File]::WriteAllLines($out, [string[]]@(
      'Vercel > tradepulse > Settings > Environment Variables (Production): copy everything after the = sign.',
      'DELETE THIS FILE when done.', '',
      "DATABASE_URL=$dbUrl", '',
      "DIRECT_URL=$session"))
  Lock-File $out
  ''
  if ($ok) { 'CLOUD RESTORE OK' } else { 'CLOUD RESTORE HAS DIFFERENCES - send this screen to Claude' }
  "Next: notepad $out   -> copy the two values into Vercel, then delete the file"
  return
}

# ---- เติมข้อมูลที่ขาดจาก Neon เข้า Supabase (ต.ค. 2569) ----
# Supabase กู้จากไฟล์สำรอง 15 ต.ค. 08:39 · Neon (อัปเกรดชั่วคราว) ยังมีข้อมูลหลังจากนั้นจนถึงตอนล็อก
# เทียบสามทาง: base = ฐาน qvx ในเครื่องนี้ (กู้จากไฟล์สำรองเดียวกัน ไม่มีอะไรเขียนลงไปอีก) · neon · supabase (ใช้งานจริง)
#   แถวใหม่ใน Neon (ไม่มีทั้งใน base และ supabase)        → เพิ่ม
#   แถวที่ Neon แก้ แต่ supabase ยังเหมือน base            → แก้ตาม Neon
#   แก้ทั้งสองฝั่ง → เก็บของ supabase · ถูกลบฝั่งใดฝั่งหนึ่ง → ไม่ฟื้น  (นับให้เห็นในรายงาน)
#   แถวใหม่ที่ค่า unique ชนกับของใน supabase (เช่น ลูกค้าสมัครใหม่ด้วยอีเมลเดิม) → หยุด ไม่ทำอะไร
# ทำในทรานแซกชันเดียว: ไม่ใส่ -Apply = นับแล้ว rollback · -Apply = สำรอง supabase ก่อน แล้วทำจริง
# ตารางสถานะชั่วคราว (RateLimit, BridgeEndpoint, token ต่าง ๆ, _prisma_migrations) ไม่แตะ — ของ supabase ใหม่กว่า
$MergeTables = 'User', 'Account', 'Plan', 'Subscription', 'AccessGrant', 'Payment', 'Review', 'Signal', 'TelegramGrant',
  'SlipOrder', 'Subscriber', 'BrokerApplication', 'BrokerEvent', 'AiConversation', 'AiMessage', 'AiUsage'

function Invoke-PsqlFile([string]$conn, [string]$pass, [string]$file) {
  $ErrorActionPreference = 'Continue'
  $env:PGPASSWORD = $pass
  $r = & "$PgBin\psql.exe" -X -q -t -A -F '|' -v ON_ERROR_STOP=1 -d $conn -f $file 2>&1
  $code = $LASTEXITCODE
  $env:PGPASSWORD = $null
  if ($code -ne 0) { throw (Hide (($r | Out-String).Trim())) }
  return @($r | Where-Object { $_ -isnot [Management.Automation.ErrorRecord] -and "$_".Trim() -ne '' } | ForEach-Object { "$_" })
}
function Get-MergeSchema([string]$conn, [string]$pass) {
  $list = ($MergeTables | ForEach-Object { "'$_'" }) -join ','
  $cols = @{}
  foreach ($row in @(Q $conn $pass "select table_name, string_agg(format('%I', column_name), ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name in ($list) group by table_name")) {
    $t, $c = $row -split '\|', 2; $cols[$t] = $c
  }
  $missing = @($MergeTables | Where-Object { -not $cols.ContainsKey($_) })
  if ($missing.Count) { throw "Supabase has no table: $($missing -join ', ')" }
  # ลำดับเพิ่มแถว: ตารางแม่ก่อนลูก (foreign key)
  $edges = @(Q $conn $pass "select c.relname, p.relname from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_class p on p.oid = k.confrelid join pg_namespace n on n.oid = c.relnamespace where k.contype = 'f' and n.nspname = 'public'")
  $parents = @{}; foreach ($t in $MergeTables) { $parents[$t] = @() }
  foreach ($e in $edges) { $c, $p = $e -split '\|'; if ($parents.ContainsKey($c) -and $p -ne $c -and $MergeTables -contains $p) { $parents[$c] += $p } }
  $order = New-Object Collections.Generic.List[string]
  while ($order.Count -lt $MergeTables.Count) {
    $next = @($MergeTables | Where-Object { -not $order.Contains($_) -and -not @($parents[$_] | Where-Object { -not $order.Contains($_) }).Count })
    if (-not $next.Count) { throw 'Foreign keys form a cycle - cannot order the inserts' }
    $order.AddRange([string[]]$next)
  }
  $uniques = @{}
  foreach ($row in @(Q $conn $pass "select t.relname, string_agg(format('%I', a.attname), ',' order by k.ord) from pg_index x join pg_class t on t.oid = x.indrelid join pg_namespace ns on ns.oid = t.relnamespace cross join lateral unnest(x.indkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum where ns.nspname = 'public' and x.indisunique and not x.indisprimary group by t.relname, x.indexrelid")) {
    $t, $c = $row -split '\|', 2
    if (-not $uniques.ContainsKey($t)) { $uniques[$t] = @() }
    $uniques[$t] += $c
  }
  return [pscustomobject]@{ Cols = $cols; Order = $order.ToArray(); Uniques = $uniques }
}
function Export-Tables([string]$conn, [string]$pass, $schema, [string]$prefix, [string]$dir) {
  $sql = foreach ($t in $MergeTables) {
    $file = (Join-Path $dir "$prefix$t.csv") -replace '\\', '/'
    "\copy (select $($schema.Cols[$t]) from public.`"$t`") to '$file' with (format csv)"
  }
  $f = Join-Path $dir "export-$prefix.sql"
  [IO.File]::WriteAllLines($f, [string[]]$sql)
  [void](Invoke-PsqlFile $conn $pass $f)
}
function New-MergeSql($schema, [string]$dir, [bool]$apply) {
  $q = { param($t) "public.`"$t`"" }
  $lines = New-Object Collections.Generic.List[string]
  $lines.Add('begin;')
  foreach ($t in $MergeTables) {
    foreach ($p in 'n', 'b') {
      $file = (Join-Path $dir "$p$t.csv") -replace '\\', '/'
      $lines.Add("create temp table `"${p}_$t`" (like $(& $q $t));")
      $lines.Add("\copy `"${p}_$t`" ($($schema.Cols[$t])) from '$file' with (format csv)")
    }
  }
  foreach ($t in $MergeTables) {
    $n = "`"n_$t`""; $b = "`"b_$t`""; $p = & $q $t
    $isNew = "not exists (select 1 from $p p where p.id = n.id) and not exists (select 1 from $b b where b.id = n.id)"
    # ตารางที่ไม่มี unique key: $null | ForEach-Object ยังวนหนึ่งรอบ จึงต้องกรองทิ้งก่อน
    $clash = @($schema.Uniques[$t] | Where-Object { $_ } | ForEach-Object {
        $cs = $_ -split ','
        $pc = ($cs | ForEach-Object { "p.$_" }) -join ', '; $nc = ($cs | ForEach-Object { "n.$_" }) -join ', '
        "(select count(*) from $n n where $isNew and exists (select 1 from $p p where p.id <> n.id and ($pc) = ($nc)))"
      })
    $clashExpr = if ($clash.Count) { $clash -join ' + ' } else { '0' }
    $newest = if ($schema.Cols[$t] -match '"createdAt"') { "(select coalesce(to_char(max(""createdAt"") + interval '7 hours', 'YYYY-MM-DD HH24:MI'), '-') from $n)" } else { "'-'" }
    $lines.Add("select 'R', '$t'," +
      " (select count(*) from $n n where $isNew)," +
      " (select count(*) from $n n join $b b on b.id = n.id join $p p on p.id = n.id where to_jsonb(n) <> to_jsonb(b) and to_jsonb(p) = to_jsonb(b))," +
      " (select count(*) from $n n join $b b on b.id = n.id join $p p on p.id = n.id where to_jsonb(n) <> to_jsonb(b) and to_jsonb(p) <> to_jsonb(b) and to_jsonb(p) <> to_jsonb(n))," +
      " (select count(*) from $b b where not exists (select 1 from $n n where n.id = b.id))," +
      " (select count(*) from $n n where not exists (select 1 from $p p where p.id = n.id) and exists (select 1 from $b b where b.id = n.id))," +
      " $clashExpr, $newest;")
  }
  if ($apply) {
    foreach ($t in $schema.Order) {
      $cols = $schema.Cols[$t]; $n = "`"n_$t`""; $b = "`"b_$t`""; $p = & $q $t
      $ncols = ($cols -split ',' | ForEach-Object { "n.$_" }) -join ', '
      $lines.Add("insert into $p ($cols) select $ncols from $n n where not exists (select 1 from $p p where p.id = n.id) and not exists (select 1 from $b b where b.id = n.id);")
    }
    foreach ($t in $schema.Order) {
      $n = "`"n_$t`""; $b = "`"b_$t`""; $p = & $q $t
      $set = (($schema.Cols[$t] -split ',') | Where-Object { $_ -ne 'id' -and $_ -ne '"id"' } | ForEach-Object { "$_ = n.$_" }) -join ', '
      if ($set) { $lines.Add("update $p as p set $set from $n n join $b b on b.id = n.id where p.id = n.id and to_jsonb(n) <> to_jsonb(b) and to_jsonb(p) = to_jsonb(b);") }
    }
    foreach ($t in $MergeTables) {
      $lines.Add("select 'C', '$t', (select count(*) from `"n_$t`" n where not exists (select 1 from public.`"$t`" p where p.id = n.id) and not exists (select 1 from `"b_$t`" b where b.id = n.id)), (select count(*) from public.`"$t`");")
    }
    $lines.Add('commit;')
  } else { $lines.Add('rollback;') }
  $f = Join-Path $dir 'merge.sql'
  [IO.File]::WriteAllLines($f, [string[]]$lines)
  return $f
}

if ($Phase -eq 'merge') {
  $neon = Read-Secret 'Neon connection string (Neon console > Connect)'
  $supa = Read-Secret 'Supabase Session pooler URL (port 5432 - the DIRECT_URL)'
  $secrets.Add($neon); $secrets.Add($supa)
  $neon = $neon.Trim('"'); $supa = ($supa.Trim('"') -split '\?')[0]
  if ($neon -notmatch '^postgres(?:ql)?://[^:/@]+:[^@]+@([^:/@?]+)' -or (-not $AnyHost -and $matches[1] -notlike '*.neon.tech')) { throw 'Neon URL is not postgresql://user:password@...neon.tech/...' }
  Assert-SupabaseUrl 'Session pooler' $supa '5432'
  $app = Get-AppPassword
  $base = "host=127.0.0.1 port=$port dbname=qvx user=qvx_app sslmode=disable"
  'Neon login: ' + (One $neon '' 'select current_user')
  'Supabase login: ' + (One $supa '' 'select current_user')
  'Base (this PC, restored 15 Oct backup) login: ' + (One $base $app 'select current_user')

  $schema = Get-MergeSchema $supa ''
  $dir = Join-Path $root 'merge'
  # ไฟล์ CSV ในนี้คือข้อมูลลูกค้า อยู่แค่ระหว่างรัน — finally ลบทิ้งเสมอ
  New-Item -ItemType Directory -Force $dir | Out-Null
  try {
    'Reading Neon and the base copy...'
    Export-Tables $neon '' $schema 'n' $dir
    Export-Tables $base $app $schema 'b' $dir

    $report = @(Invoke-PsqlFile $supa '' (New-MergeSql $schema $dir $false))
    ''
    '  {0,-18} {1,6} {2,8} {3,10} {4,12} {5,12} {6,6}  {7}' -f 'table', 'new', 'changed', 'both-edit', 'gone-in-neon', 'gone-in-supa', 'CLASH', 'newest in Neon (Thai)'
    $clashes = 0; $toAdd = 0; $toUpd = 0
    foreach ($r in $report | Where-Object { $_ -like 'R|*' }) {
      $x = $r -split '\|'
      $clashes += [int]$x[7]; $toAdd += [int]$x[2]; $toUpd += [int]$x[3]
      '  {0,-18} {1,6} {2,8} {3,10} {4,12} {5,12} {6,6}  {7}' -f $x[1], $x[2], $x[3], $x[4], $x[5], $x[6], $x[7], $x[8]
    }
    ''
    "Rows to add: $toAdd   rows to update: $toUpd   unique clashes: $clashes"
    if (-not $Apply) { 'PLAN ONLY - nothing changed. Run again with -Apply to merge.'; return }
    if ($clashes -gt 0) { 'STOPPED: some new rows clash with rows already in Supabase (e.g. a customer signed up again). Send this screen to Claude.'; return }
    if ($toAdd + $toUpd -eq 0) { 'Nothing to merge.'; return }

    # สำรอง supabase ก่อนแตะ — ถ้าผลไม่ถูกใจ กู้กลับจากไฟล์นี้ได้
    $preDir = if (Test-Path 'C:\QVXBackup\daily') { 'C:\QVXBackup\daily' } else { $root }
    $pre = Join-Path $preDir ('qvx-{0:yyyyMMdd-HHmm}-premerge.dump' -f (Get-Date))
    $ErrorActionPreference = 'Continue'
    & "$PgBin\pg_dump.exe" -Fc --no-owner --no-acl --schema=public -f $pre -d $supa 2>&1 | ForEach-Object { '  pg_dump: ' + (Hide "$_") }
    $ErrorActionPreference = 'Stop'
    if (-not (Test-Path $pre) -or -not (Get-DumpCreated $pre)) { throw "Safety backup failed ($pre) - not merging" }
    'Safety backup of Supabase: {0} ({1:N0} KB)' -f $pre, ((Get-Item $pre).Length / 1KB)

    $after = @(Invoke-PsqlFile $supa '' (New-MergeSql $schema $dir $true))
    $left = 0
    foreach ($r in $after | Where-Object { $_ -like 'C|*' }) { $x = $r -split '\|'; $left += [int]$x[2]; '  {0,-18} rows now {1,7}' -f $x[1], $x[3] }
    if ($left -eq 0) { "MERGE OK - added $toAdd, updated $toUpd" } else { "MERGE INCOMPLETE - $left new rows still missing. Send this screen to Claude." }
  } finally {
    Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
  }
  return
}

if ($Phase -eq 'backup') {
  # สำรองรายคืนเดิม (งาน QVXDatabaseBackup ตี 3 → C:\QVXBackup\db-backup.ps1, docs/BACKUP.md) ยังดึงจาก Neon ที่ล็อกอยู่
  # สำเร็จครั้งสุดท้าย 15 ต.ค. 08:39 · เปลี่ยน DATABASE_URL ใน backup.env ให้ดึงจาก Supabase แล้วสั่งงานรันทันทีหนึ่งรอบ
  # ใช้ session pooler (5432) — pg_dump ผ่าน transaction pooler (6543) ไม่ได้
  if (-not $isAdmin) { throw 'Run PowerShell as Administrator' }
  $bkRoot = 'C:\QVXBackup'
  $envFile = Join-Path $bkRoot 'backup.env'
  $job = Join-Path $bkRoot 'db-backup.ps1'
  $statusFile = Join-Path $bkRoot 'STATUS.txt'
  if (-not (Test-Path $job)) { throw "Not found: $job (see docs/BACKUP.md)" }
  'Before - last result: ' + $(if (Test-Path $statusFile) { (Get-Content $statusFile -TotalCount 1) } else { '(no STATUS.txt)' })

  # ต.ค. 2569 ฐานหลักย้ายไป Render แล้ว (render.yaml) — รับ External Database URL ของ Render
  # ยังรับ session pooler ของ Supabase อยู่ เผื่อต้องย้อนกลับ
  $session = Read-Secret 'Database URL - Render: qvx-db > Connections > External Database URL'
  $secrets.Add($session)
  $session = ($session.Trim('"') -split '\?')[0]
  if ($session -notmatch '^postgres(?:ql)?://[^:/@]+:[^@]+@([^:/@]+)(?::(\d+))?/[^?]+$') { throw 'Not a postgresql://user:password@host/db URL' }
  $dbHost = $matches[1]
  if ($dbHost -like '*.render.com') { $session += '?sslmode=require' }
  elseif ($dbHost -like '*.pooler.supabase.com') { Assert-SupabaseUrl 'Session pooler' $session '5432' }
  elseif (-not $AnyHost) { throw "Host $dbHost is neither Render (*.render.com) nor Supabase" }
  "Database login ($dbHost): " + (One $session '' 'select current_user')

  # คงค่าอื่นในไฟล์ไว้ (BACKUP_ALERT_SECRET ฯลฯ) เปลี่ยนแค่ DATABASE_URL · PG_BIN ต้องชี้ที่ที่มี pg_dump 18 จริง
  $lines = if (Test-Path $envFile) { @(Get-Content $envFile) } else { @() }
  if (Test-Path $envFile) { Copy-Item $envFile ('{0}.before-{1:yyyyMMdd-HHmm}' -f $envFile, (Get-Date)) -Force; Lock-File ('{0}.before-{1:yyyyMMdd-HHmm}' -f $envFile, (Get-Date)) }
  $lines = @($lines | Where-Object { $_ -notmatch '^\s*DATABASE_URL\s*=' }) + "DATABASE_URL=$session"
  $pgBinNow = ($lines | Where-Object { $_ -match '^\s*PG_BIN\s*=' } | Select-Object -Last 1) -replace '^\s*PG_BIN\s*=\s*', ''
  if (-not $pgBinNow) { $pgBinNow = 'C:\PostgreSQL18\bin' }
  if (-not (Test-Path (Join-Path $pgBinNow 'pg_dump.exe'))) {
    $lines = @($lines | Where-Object { $_ -notmatch '^\s*PG_BIN\s*=' }) + "PG_BIN=$PgBin"
    "PG_BIN: $pgBinNow has no pg_dump.exe - switched to $PgBin"
  }
  [IO.File]::WriteAllLines($envFile, [string[]]$lines, (New-Object Text.UTF8Encoding $false))
  Lock-File $envFile
  "backup.env: DATABASE_URL now points at $dbHost (old file kept as backup.env.before-<date>, admins only)"

  $task = Get-ScheduledTask -TaskName 'QVXDatabaseBackup' -ErrorAction SilentlyContinue
  if (-not $task) {
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File $job"
    $trigger = New-ScheduledTaskTrigger -Daily -At 3am
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
    Register-ScheduledTask -TaskName 'QVXDatabaseBackup' -Action $action -Trigger $trigger -Settings $settings -User 'SYSTEM' -RunLevel Highest | Out-Null
    'Task QVXDatabaseBackup: was missing - created (daily 03:00, SYSTEM, runs late if the PC was off)'
  } elseif ($task.State -eq 'Disabled') {
    Enable-ScheduledTask -TaskName 'QVXDatabaseBackup' | Out-Null
    'Task QVXDatabaseBackup: was DISABLED - enabled it'
  }
  $info = Get-ScheduledTaskInfo -TaskName 'QVXDatabaseBackup'
  'Task QVXDatabaseBackup: last run {0:yyyy-MM-dd HH:mm} (result {1}), next run {2:yyyy-MM-dd HH:mm}' -f $info.LastRunTime, $info.LastTaskResult, $info.NextRunTime

  # สั่งผ่านงานตั้งเวลา (รันเป็น SYSTEM แบบเดียวกับตอนตี 3) จะได้รู้ว่าคืนนี้ผ่านจริง ไม่ใช่แค่ผ่านตอนเรารันเอง
  'Running a backup now through the task (1-3 minutes)...'
  $before = (Get-Item $statusFile -ErrorAction SilentlyContinue).LastWriteTime
  Start-ScheduledTask -TaskName 'QVXDatabaseBackup'
  $until = (Get-Date).AddMinutes(15)
  do { Start-Sleep -Seconds 5 } while ((Get-ScheduledTask -TaskName 'QVXDatabaseBackup').State -eq 'Running' -and (Get-Date) -lt $until)
  $after = (Get-Item $statusFile -ErrorAction SilentlyContinue).LastWriteTime
  $status = if (Test-Path $statusFile) { Get-Content $statusFile -TotalCount 1 } else { '' }
  "Result: $status"
  $newest = Get-ChildItem (Join-Path $bkRoot 'daily') -Filter 'qvx-*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($newest) { 'Newest backup: {0}  ({1:N0} KB)' -f $newest.Name, ($newest.Length / 1KB) }
  $fresh = $newest -and $newest.LastWriteTime -gt (Get-Date).AddMinutes(-20) -and $after -ne $before
  if ($fresh) { 'BACKUP OK' } else { 'BACKUP DID NOT PRODUCE A NEW FILE - send this screen to Claude'; Get-Content (Join-Path $bkRoot 'backup.log') -Tail 6 }
  return
}

if ($Phase -eq 'portmap') {
  $logLine = { param($m) if ($NoTask) { Add-Content (Join-Path $root 'portmap.log') ('{0:yyyy-MM-dd HH:mm} {1}' -f (Get-Date), $m) } }
  $lans = @(Get-LanIPs | Where-Object { Test-PrivateIp $_.IP })
  if (-not $lans.Count) { throw 'No LAN IPv4 address found on this PC' }
  $svc = $null; $client = ''; $ext = ''
  foreach ($l in $lans) {
    foreach ($loc in @(Find-Gateways $l.IP)) {
      foreach ($s in @(Get-WanServices $loc)) {
        $r = Invoke-Upnp $s 'GetExternalIPAddress' ''
        $ip = if ($r.Ok) { Get-XmlValue $r.Xml 'NewExternalIPAddress' } else { '' }
        if ($ip -and $ip -ne '0.0.0.0') { $svc = $s; $client = $l.IP; $ext = $ip; break }
      }
      if ($svc) { break }
    }
    if ($svc) { break }
  }
  if (-not $svc) {
    & $logLine 'no UPnP router found'
    'Router UPnP: NOT FOUND - UPnP is switched off on the router. Set the port forward by hand (docs/DB-SERVER-254.md step 4)'
    return
  }
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $pub = try { "$(Invoke-RestMethod 'https://api.ipify.org' -TimeoutSec 10)".Trim() } catch { '' }
  "Router UPnP: found ($($svc.Type -replace '^urn:schemas-upnp-org:service:', ''))"
  "Router WAN IP: $ext   |   public IP seen from the internet: $pub"
  if (Test-PrivateIp $ext) {
    & $logLine "CGNAT wan=$ext"
    'CGNAT: the router itself is behind the ISP''s NAT, so no port forward can reach this PC. Ask the ISP for a public IP, or use Supabase instead.'
    return
  }
  if ($pub -and $pub -ne $ext) { Write-Warning 'Router WAN IP and public IP differ - there may be another router in front of this one' }
  if ($CheckOnly) { return }

  $want = "${client}:$port"
  $now = Get-Mapping $svc
  if ($now -ne $want) {
    if ($now) { [void](Invoke-Upnp $svc 'DeletePortMapping' "<NewRemoteHost></NewRemoteHost><NewExternalPort>$PublicPort</NewExternalPort><NewProtocol>TCP</NewProtocol>") }
    $add = "<NewRemoteHost></NewRemoteHost><NewExternalPort>$PublicPort</NewExternalPort><NewProtocol>TCP</NewProtocol><NewInternalPort>$port</NewInternalPort>" +
      "<NewInternalClient>$client</NewInternalClient><NewEnabled>1</NewEnabled><NewPortMappingDescription>QVX PostgreSQL</NewPortMappingDescription><NewLeaseDuration>{0}</NewLeaseDuration>"
    # 0 = ถาวร · เราเตอร์บางรุ่น (IGDv2) ไม่รับ 0 ต้องให้อายุ เลยลอง 7 วันต่อ — งานตั้งเวลาจะต่ออายุให้เรื่อย ๆ
    $r = Invoke-Upnp $svc 'AddPortMapping' ($add -f 0)
    if (-not $r.Ok) { $r = Invoke-Upnp $svc 'AddPortMapping' ($add -f 604800) }
    $now = Get-Mapping $svc
    if ($now -ne $want) {
      & $logLine "add failed: $($r.Error)"
      "Port forward FAILED: router said '$($r.Error)'. Set it by hand (docs/DB-SERVER-254.md step 4)"
      return
    }
  }
  & $logLine "ok $PublicPort -> $want"
  "Port forward: TCP $PublicPort (internet) -> $want  OK"
  if ($isAdmin -and -not $NoTask) {
    # เราเตอร์รีบูต/หมดอายุแล้ว mapping หาย — ให้ SYSTEM เช็คแล้วเติมทุก 30 นาที (ถ้ายังอยู่ก็ไม่แตะ)
    schtasks /create /tn 'QVX PortMap' /sc minute /mo 30 /ru SYSTEM /rl HIGHEST /tr "powershell -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Phase portmap -NoTask" /f | Out-Null
    'Task "QVX PortMap": checks and restores the port forward every 30 minutes (log: C:\QVXDB\portmap.log)'
  }
  return
}

if ($Phase -eq 'ddns') {
  if (-not $isAdmin) { throw 'Run PowerShell as Administrator' }
  if (-not $Domain) { throw 'Give -Domain <name>  (the part before .duckdns.org)' }
  $Domain = $Domain -replace '\.duckdns\.org$', ''
  $token = Read-Secret 'DuckDNS token (top of duckdns.org after you sign in)'
  if ($token -notmatch '^[0-9a-fA-F-]{36}$') { throw 'That does not look like a DuckDNS token (36 characters like xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)' }
  $cfg = Join-Path $root 'duckdns.txt'
  [IO.File]::WriteAllLines($cfg, [string[]]@($Domain, $token))
  Lock-File $cfg
  $upd = Join-Path $root 'duckdns-update.ps1'
  Set-Content -Path $upd -Encoding ASCII -Value @'
# Runs every 5 minutes as SYSTEM (task "QVX DuckDNS"): tells DuckDNS this line's current public IP
$d, $t = Get-Content 'C:\QVXDB\duckdns.txt'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
try { $r = "$(Invoke-RestMethod "https://www.duckdns.org/update?domains=$d&token=$t&ip=" -TimeoutSec 20)" } catch { $r = 'ERROR ' + $_.Exception.Message }
Add-Content 'C:\QVXDB\duckdns.log' ('{0:yyyy-MM-dd HH:mm} {1}' -f (Get-Date), $r)
'@
  schtasks /create /tn 'QVX DuckDNS' /sc minute /mo 5 /ru SYSTEM /rl HIGHEST /tr "powershell -NoProfile -ExecutionPolicy Bypass -File $upd" /f | Out-Null
  schtasks /run /tn 'QVX DuckDNS' | Out-Null
  Start-Sleep -Seconds 10
  $last = Get-Content (Join-Path $root 'duckdns.log') -Tail 1 -ErrorAction SilentlyContinue
  "DuckDNS update: $last   (OK = working, KO = wrong name or token)"
  $ip = try { ([Net.Dns]::GetHostAddresses("$Domain.duckdns.org") | Select-Object -First 1).IPAddressToString } catch { '(not resolving yet)' }
  "$Domain.duckdns.org -> $ip"
  return
}

if ($Phase -eq 'url') {
  if (-not $PublicHost) { throw 'Give -PublicHost <name>.duckdns.org  (or the public IP if it never changes)' }
  $app = Get-AppPassword
  $tail = "@${PublicHost}:$PublicPort/qvx?sslmode=require&connection_limit=3&connect_timeout=15"
  Set-Clipboard -Value ("postgresql://qvx_app:$app" + $tail)
  "Copied to the clipboard (password not shown):  postgresql://qvx_app:****$tail"
  'Paste it in Vercel > tradepulse > Settings > Environment Variables as BOTH DATABASE_URL and DIRECT_URL (Production).'
  return
}
