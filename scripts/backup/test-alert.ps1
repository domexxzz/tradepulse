# ทดสอบว่าท่อแจ้งเตือนสำรองข้อมูลถึงห้อง Admin QVX จริงหรือยัง
#
# ทำไมต้องมี: ของเดิมแจ้งเตือนไม่เคยถึงใครเป็นเดือน โดยที่ log เขียนว่าส่งแล้ว
# ตัวที่เชื่อถือได้คือ "เห็นข้อความในห้องจริง" ไม่ใช่ "สคริปต์บอกว่าส่งแล้ว"
# รันตัวนี้หลังเปลี่ยนค่าตั้งค่าใด ๆ ที่เกี่ยวกับการแจ้งเตือน
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File C:\QVXBackup\test-alert.ps1
param([string]$ConfigPath = "C:\QVXBackup\backup.env")

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$cfg = @{}
foreach ($line in Get-Content $ConfigPath) {
  $t = $line.Trim()
  if (-not $t -or $t.StartsWith("#") -or -not $t.Contains("=")) { continue }
  $i = $t.IndexOf("=")
  $cfg[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim().Trim('"').Trim("'")
}

$url    = if ($cfg["ALERT_URL"]) { $cfg["ALERT_URL"] } else { "https://quantvisionx.com/api/backup/report" }
$secret = $cfg["BACKUP_ALERT_SECRET"]
if (-not $secret) { throw "ไม่ได้ตั้ง BACKUP_ALERT_SECRET ใน $ConfigPath" }

# test = ส่งข้อความจริงเข้าห้อง (ต่างจาก ok ที่บันทึกเงียบ ๆ ไม่ส่งอะไร)
$body = @{ test = $true; host = $env:COMPUTERNAME; message = "ทดสอบท่อแจ้งเตือน ไม่ใช่การสำรองข้อมูลล้มเหลว" } |
  ConvertTo-Json -Compress

try {
  $res = Invoke-RestMethod -Method Post -Uri $url -TimeoutSec 20 `
    -Headers @{ Authorization = "Bearer $secret" } `
    -ContentType "application/json; charset=utf-8" `
    -Body ([Text.Encoding]::UTF8.GetBytes($body))
  if ($res.ok) {
    Write-Output "ส่งถึงแล้ว — ไปดูข้อความในห้อง Admin QVX เพื่อยืนยันด้วยตา"
  } else {
    Write-Output "เว็บรับเรื่องแล้วแต่ส่งเข้า Telegram ไม่ได้: $($res.reason)"
    exit 1
  }
} catch {
  Write-Output "ยิงเข้าเว็บไม่สำเร็จ: $($_.Exception.Message)"
  Write-Output "เช็คว่า BACKUP_ALERT_SECRET ตรงกับ env ชื่อเดียวกันบน Vercel หรือยัง"
  exit 1
}
