# เฝ้าบอทอ่านเมล (mailbot.py) บนคอมเฟิร์ส — งานตั้งเวลา QVXMailbot เรียกทุก 10 นาที
#
# ทำไมไม่เปิดบอทตรง ๆ: process ที่เปิดผ่าน SSH ตายตอน session หลุด (เคยทำบริดจ์ดับ 14 ชม.)
# ต้องให้ Task Scheduler เป็นคนเปิด — สั่งผ่าน SSH ได้ด้วย Start-ScheduledTask -TaskName QVXMailbot
#
# ยังไม่มี IMAP_PASSWORD ใน mail.env = ไม่เปิดบอท (เปิดไปก็ล้มวนเปล่า ๆ) รอให้รัน set-mail-password.ps1 ก่อน
# log เป็นภาษาอังกฤษล้วนตั้งใจ — คอนโซลเครื่องนี้เป็น cp874 อ่านผ่าน SSH แล้วภาษาไทยเพี้ยน
#
# ติดตั้ง (รันบนคอมเฟิร์ส ครั้งเดียว):
#   $a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\QVXMail\mailbot-watchdog.ps1'
#   $t = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10)
#   $s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew
#   Register-ScheduledTask -TaskName QVXMailbot -Action $a -Trigger $t -Settings $s

#
# -Stop = หยุดบอทอย่างเดียว ไม่เปิดอะไร (สั่งผ่าน SSH ได้) แล้วค่อย Start-ScheduledTask ให้เปิดใหม่
# กรองด้วยชื่อสคริปต์ — เครื่องนี้มี python ของบริดจ์ TradingView รันอยู่ด้วย ห้ามฆ่าเหมา

param([switch]$Stop)

$dir = 'C:\QVXMail'
$envFile = Join-Path $dir 'mail.env'
$logFile = Join-Path $dir 'watchdog.log'

function Write-Log([string]$msg) {
  Add-Content -Path $logFile -Value ('{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg) -Encoding ASCII
}

$running = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -match 'mailbot\.py' }

if ($Stop) {
  $running | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Write-Log ('stopped {0} mailbot process(es) on request' -f @($running).Count)
  exit 0
}

if ($running) { exit 0 }

$hasPassword = (Test-Path $envFile) -and (Select-String -Path $envFile -Pattern '^\s*IMAP_PASSWORD\s*=\s*\S' -Quiet)
if (-not $hasPassword) {
  Write-Log 'waiting: IMAP_PASSWORD is empty in mail.env - run set-mail-password.ps1'
  exit 0
}

$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) {
  Write-Log 'error: python not found in PATH'
  exit 1
}

# คู่เครื่องหมายคำพูดนอกสุดตั้งใจ — cmd /c ตัดคู่นอกสุดทิ้งเมื่อบรรทัดมีคำพูดมากกว่าสองตัว
$cmd = '""{0}" -X utf8 -u "{1}\mailbot.py" --env "{1}\mail.env" --interval 120 >> "{1}\mailbot.log" 2>&1"' -f $py, $dir
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmd -WindowStyle Hidden -WorkingDirectory $dir
Write-Log 'mailbot was not running - started'
