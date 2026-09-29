# ปลุก botkeeper ถ้ามันตาย — ตั้งเป็นงานตั้งเวลาให้รันทุก 10 นาที
#
# ทำไมต้องมี: botkeeper ถูกเปิดครั้งเดียวตอน login ผ่าน Registry Run key
# ตายแล้วไม่มีใครปลุก และมันตายเงียบ ไม่มีอะไรฟ้อง
#
# เคยทำให้บริดจ์ดับ 25 วัน (2-27 ก.ย. 2569) และดับอีก 14 ชั่วโมง (27 ก.ย. 22:08 - 28 ก.ย. 12:28)
# ครั้งหลังสาเหตุคือเปิด keeper ผ่าน SSH แล้ว Windows ฆ่า process ลูกทิ้งตอน session หลุด
# — เปิดจาก Task Scheduler ไม่มีปัญหานี้
#
# ติดตั้ง (รันบนเครื่องบอท):
#   $a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\BotTV\watchdog.ps1'
#   $t = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10)
#   $s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
#   Register-ScheduledTask -TaskName QVXKeeperWatchdog -Action $a -Trigger $t -Settings $s -RunLevel Highest

$k = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'botkeeper' }
if (-not $k) {
  Add-Content C:\BotTV\watchdog.log ("{0} keeper หาย - เปิดใหม่" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
  Start-Process powershell -ArgumentList '-NoProfile','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File','C:\BotTV\botkeeper.ps1' -WindowStyle Hidden
}
