# ใส่รหัสแอป (app password) ของ Gmail ลง mail.env บนคอมเฟิร์ส แล้วลองล็อกอินให้เลย
#
# รหัสไม่ผ่านแชท ไม่ผ่านไฟล์อื่น พิมพ์ลงช่องนี้แล้วตรงเข้า mail.env (ช่องพิมพ์ซ่อนตัวอักษร)
# รันจากเครื่องที่ SSH เข้าคอมเฟิร์สได้:
#   ssh -t oneye@100.107.33.82 "powershell -NoProfile -ExecutionPolicy Bypass -File C:\QVXMail\set-mail-password.ps1"
# หรือนั่งหน้าเครื่อง / RustDesk: คลิกขวาไฟล์นี้ > Run with PowerShell
#
# ข้อความเป็นภาษาอังกฤษล้วนตั้งใจ — คอนโซลเครื่องนี้เป็น cp874 ภาษาไทยผ่าน SSH แล้วเพี้ยน

$dir = 'C:\QVXMail'
$envFile = Join-Path $dir 'mail.env'
if (-not (Test-Path $envFile)) { Write-Host "Not found: $envFile"; exit 1 }

$secure = Read-Host -AsSecureString 'Gmail app password for the mailbot (16 letters, spaces are fine)'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
$plain = $plain -replace '\s', ''

if ($plain -notmatch '^[A-Za-z]{16}$') {
  Write-Host 'That is not a 16-letter app password. Nothing was saved.'
  exit 1
}

$keep = @(Get-Content $envFile -Encoding UTF8 | Where-Object { $_ -notmatch '^\s*IMAP_PASSWORD\s*=' })
[IO.File]::WriteAllLines($envFile, [string[]]($keep + "IMAP_PASSWORD=$plain"), (New-Object Text.UTF8Encoding $false))
$plain = $null
Write-Host 'Saved to mail.env. Testing Gmail login (read-only, sends nothing to the website)...'
Write-Host ''

$py = (Get-Command python -ErrorAction SilentlyContinue).Source
& $py -X utf8 (Join-Path $dir 'mailbot.py') --env $envFile --interval 0 --dry-run
if ($LASTEXITCODE -ne 0) {
  # ล้างรหัสทิ้ง — ไม่งั้นตัวเฝ้าเห็นว่ามีรหัสแล้วเปิดบอท บอทล็อกอินผิดวนทุก 2 นาทีจน Gmail ล็อก
  $keep = @(Get-Content $envFile -Encoding UTF8 | Where-Object { $_ -notmatch '^\s*IMAP_PASSWORD\s*=' })
  [IO.File]::WriteAllLines($envFile, [string[]]($keep + 'IMAP_PASSWORD='), (New-Object Text.UTF8Encoding $false))
  Write-Host ''
  Write-Host 'Login test FAILED - see the line above. The password was removed again.'
  Write-Host 'Check the app password and run this script again.'
  exit 1
}

Write-Host ''
Write-Host 'Login OK. The bot starts by itself within 10 minutes and sends the mails listed above.'
Write-Host 'Tell Claude it is done.'
