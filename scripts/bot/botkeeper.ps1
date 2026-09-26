# botkeeper - ดูแลบอท TradingView ให้ทำงานตลอด (ใช้ได้ทั้งเครื่องหลักและเครื่องสำรอง)
#
# ทำ 3 อย่างวนลูป:
#   1. บริดจ์ (python tv_bridge.py) ตาย -> เปิดใหม่
#   2. cloudflared ของบริดจ์ตาย -> เปิดใหม่ (quick tunnel ได้ URL สุ่มใหม่ทุกครั้ง)
#   3. URL เปลี่ยน -> อัปค่า env บน Vercel + redeploy ให้อัตโนมัติ
#
# ข้อ 3 คือหัวใจ: quick tunnel ของ Cloudflare ไม่มี URL คงที่ ถ้าไม่อัปเดตเอง
# เว็บจะเรียกบอทไม่เจอหลังรีบูตทุกครั้ง
#
# คอมเฟิร์ส (ตัวหลัก):  powershell -File C:\BotTV\botkeeper.ps1
# คอมเบส   (ตัวสำรอง): powershell -File C:\BotTV\botkeeper.ps1 -EnvKey TV_BOT_URL_BACKUP `
#                        -Cloudflared "C:\Program Files (x86)\cloudflared\cloudflared.exe" -BridgeTask TradePulseTVBridge
#
# ต้องมี $Dir\vercel_token.txt (Vercel token ของทีม domezzxxs-projects, ห้าม commit)
# ยังไม่มีไฟล์ก็รันได้ - บริดจ์กับ tunnel ยังถูกดูแล แค่อัป Vercel ไม่ได้จนกว่าจะวางไฟล์

param(
  [string]$Dir         = "C:\BotTV",
  # ค่า env บน Vercel ที่จะอัป - ตัวหลัก TV_BOT_URL · ตัวสำรอง TV_BOT_URL_BACKUP
  [string]$EnvKey      = "TV_BOT_URL",
  [string]$Cloudflared = "",
  # ตั้งไว้ = เปิดบริดจ์ผ่าน scheduled task เดิมของเครื่อง แทนการสั่ง python เอง
  [string]$BridgeTask  = "",
  [int]$Port           = 8787
)

$ErrorActionPreference = "Continue"
$dir       = $Dir
if (-not $Cloudflared) { $Cloudflared = "$dir\cloudflared.exe" }
$cfLog     = "$dir\cf.log"
$stateFile = "$dir\last_url.txt"
$log       = "$dir\keeper.log"
$proj      = "prj_Ei4cxqF4VNBrA7wu61N4XPghFfah"
$team      = "team_hQP3M2RvqWdYY8W8652RbJUe"

function Note($m) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m" | Out-File $log -Append -Encoding utf8
}

# อ่าน token ตอนใช้ ไม่ใช่ตอนเริ่ม - วางไฟล์ทีหลังได้โดยไม่ต้องรีสตาร์ต keeper
function Get-Token {
  $f = "$dir\vercel_token.txt"
  if (-not (Test-Path $f)) { return $null }
  $t = (Get-Content $f -Raw).Trim()
  if ($t) { return $t } else { return $null }
}

function Ensure-Bridge {
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -EA SilentlyContinue) { return }
  if ($BridgeTask) {
    Note "bridge down -> schtasks /run $BridgeTask"
    schtasks /run /tn $BridgeTask | Out-Null
    Start-Sleep 12
    return
  }
  Note "bridge down -> starting"
  # ให้ cmd เป็นคน redirect (>> ต่อท้าย) แทน -RedirectStandardOutput ของ PowerShell
  # ตัวหลังจองไฟล์แบบ exclusive ถ้า process เดิมยังถือ handle อยู่จะ throw แล้ว
  # ลูปค้างทั้งตัว ทำให้ watchdog ตายเงียบ ๆ ทั้งที่ยังเห็น process อยู่
  # print() ไป stdout, logging ของ aiohttp ไป stderr จึงต้องเก็บทั้งสองสาย
  $cmd = "cd /d `"$dir`" && python -u tv_bridge.py >> `"$dir\bot_out.log`" 2>> `"$dir\bot.log`""
  Start-Process "cmd.exe" -ArgumentList "/c", $cmd -WindowStyle Hidden
  Start-Sleep 12
}

# นับเฉพาะ cloudflared ที่ชี้พอร์ตบริดจ์ - เครื่องเดียวกันอาจมี tunnel ของโปรเจกต์อื่น
# (คอมเบสมีของพอร์ต 8800 กับเกม) ถ้านับทุกตัว tunnel ของบริดจ์ตายจะไม่มีใครเปิดใหม่
function Get-BridgeTunnel {
  Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -EA SilentlyContinue |
    Where-Object { $_.CommandLine -match "127\.0\.0\.1:$Port\b" }
}

function Ensure-Tunnel {
  if (Get-BridgeTunnel) { return }
  Note "cloudflared down -> starting"
  Remove-Item $cfLog -Force -EA SilentlyContinue
  Start-Process $Cloudflared `
    -ArgumentList "tunnel", "--url", "http://127.0.0.1:$Port" `
    -RedirectStandardError $cfLog -WindowStyle Hidden
  Start-Sleep 18
}

function Get-TunnelUrl {
  if (-not (Test-Path $cfLog)) { return $null }
  $m = Select-String -Path $cfLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -EA SilentlyContinue |
       Select-Object -Last 1
  if (-not $m) { return $null }
  return $m.Matches[0].Value
}

function Update-Vercel($url) {
  $token = Get-Token
  if (-not $token) { Note "no vercel_token.txt -> skip update"; return $false }
  $h = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
  # แก้ค่า env เดิมในที่เดิม (ไม่ลบ-สร้างใหม่ จะได้ id ไม่เปลี่ยน)
  # หา id จากชื่อ env ทุกครั้ง ใช้สคริปต์เดียวได้ทุกเครื่อง
  $body = @{ value = $url } | ConvertTo-Json
  try {
    $envs = (Invoke-RestMethod -Headers $h -EA Stop `
      -Uri "https://api.vercel.com/v10/projects/$proj/env?teamId=$team").envs
    $envId = ($envs | Where-Object { $_.key -eq $EnvKey -and $_.target -contains "production" } |
              Select-Object -First 1).id
    if (-not $envId) { Note "env $EnvKey (production) not found on vercel"; return $false }
    Invoke-RestMethod -Method Patch -Headers $h `
      -Uri "https://api.vercel.com/v9/projects/$proj/env/$envId`?teamId=$team" `
      -Body $body -EA Stop | Out-Null
    Note "vercel env $EnvKey updated -> $url"
  } catch {
    Note ("vercel env FAILED: " + $_.Exception.Message)
    return $false
  }
  # env ใหม่มีผลต่อเมื่อ deploy ใหม่ - สั่ง redeploy จาก production ล่าสุดที่ขึ้นสำเร็จ
  # (ตัวล่าสุดอาจเป็นตัวที่ถูกบล็อกหรือ build พัง redeploy ตัวนั้นก็พังซ้ำ)
  try {
    $latest = Invoke-RestMethod -Headers $h -EA Stop `
      -Uri "https://api.vercel.com/v6/deployments?projectId=$proj&teamId=$team&target=production&state=READY&limit=1"
    $src = $latest.deployments[0]
    $dep = @{ name = "tradepulse"; deploymentId = $src.uid; target = "production" } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Headers $h `
      -Uri "https://api.vercel.com/v13/deployments?teamId=$team&forceNew=1" -Body $dep -EA Stop | Out-Null
    Note "redeploy triggered"
    return $true
  } catch {
    Note ("redeploy FAILED: " + $_.Exception.Message)
    return $false
  }
}

# ยิงงานประจำของเว็บเอง เป็นตัวสำรองของ GitHub Actions
# GitHub ปิด scheduled workflow อัตโนมัติถ้า repo เงียบ 60 วัน แล้วเงียบไปเฉย ๆ
# ตัวเฝ้าจึงไม่ควรมีที่เดียว - เครื่องนี้รันอยู่แล้วทุกนาที ใช้เป็นตัวที่สองได้ฟรี
# endpoint ทั้งสองกันเรียกซ้ำอยู่แล้ว ยิงพร้อม GitHub ไม่มีผลเสีย
function Poke-Web {
  $f = "$dir\cron_secret.txt"
  if (-not (Test-Path $f)) { return }
  $secret = (Get-Content $f -Raw).Trim()
  if (-not $secret) { return }
  $h = @{ Authorization = "Bearer $secret" }
  foreach ($path in @("bridge-health", "reconcile")) {
    try {
      Invoke-RestMethod -Headers $h -TimeoutSec 90 `
        -Uri "https://quantvisionx.com/api/cron/$path" | Out-Null
    } catch {
      Note ("poke $path failed: " + $_.Exception.Message)
    }
  }
}

Note "botkeeper started (env=$EnvKey port=$Port)"
$tick = 0
while ($true) {
  try {
    # แยก try ของแต่ละงาน ถ้างานหนึ่งพัง อีกงานยังเดินต่อ และลูปไม่ตาย
    try { Ensure-Bridge } catch { Note ("Ensure-Bridge error: " + $_.Exception.Message) }
    try { Ensure-Tunnel } catch { Note ("Ensure-Tunnel error: " + $_.Exception.Message) }

    $tick++
    # ทุก 5 นาที (ลูปละ 60 วินาที)
    if ($tick % 5 -eq 0) { try { Poke-Web } catch { Note ("Poke-Web error: " + $_.Exception.Message) } }

    # เต้นทุก 30 นาที เพื่อให้รู้ว่ายังมีชีวิต (ถ้า log เงียบยาว = ตายแล้ว)
    if ($tick % 30 -eq 0) { Note "alive" }

    $url = Get-TunnelUrl
    if ($url) {
      $last = if (Test-Path $stateFile) { (Get-Content $stateFile -Raw).Trim() } else { "" }
      if ($url -ne $last) {
        Note "tunnel url changed: $last -> $url"
        if (Update-Vercel $url) { $url | Out-File $stateFile -Encoding ascii -NoNewline }
      }
    }
  } catch {
    Note ("loop error: " + $_.Exception.Message)
  }
  Start-Sleep 60
}
