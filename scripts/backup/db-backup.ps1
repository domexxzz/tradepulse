# สำรองฐานข้อมูล production ลงเครื่องที่บ้าน
#
# ทำไมต้องมี: ข้อมูลลูกค้าทั้งหมดอยู่บน Neon ที่เดียว แผนฟรี และโปรเจกต์อยู่บนบัญชี
# ที่เราไม่ได้เป็นเจ้าของคนเดียว — บัญชีโดนระงับหรือเผลอลบ branch = หายถาวร
# Neon มีระบบย้อนเวลาของตัวเองก็จริง แต่กู้ไม่ได้ถ้าเข้าบัญชีไม่ได้
#
# รันบนคอมเฟิร์สเพราะเปิดตลอดอยู่แล้ว (รันบริดจ์ TradingView) — แมคปิดบ่อย งานตั้งเวลาพลาด
#
# เก็บสองที่บนคนละดิสก์กายภาพ:
#   C:\QVXBackup\daily    ทุกคืน เก็บ 30 วัน   (PNY 1TB)
#   E:\QVXBackup\weekly   วันอาทิตย์ เก็บ 12 สัปดาห์ (GAMER SSD — กัน SSD ตัวใดตัวหนึ่งพัง)
#
# ทุกครั้งที่ dump เสร็จจะตรวจไฟล์ด้วย pg_restore --list ทันที
# dump ที่เปิดไม่ออกคือ dump ที่ไม่มีอยู่จริง — ตรวจตอนกู้คืนจะสายไป

param(
  [string]$ConfigPath = "C:\QVXBackup\backup.env",
  [switch]$Now  # บังคับให้ทำสำเนารายสัปดาห์ด้วย ใช้ตอนทดสอบ
)

$ErrorActionPreference = "Stop"
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

# ── อ่านค่าตั้งค่า ────────────────────────────────────────────────────────────
function Read-Env([string]$path) {
  $map = @{}
  if (-not (Test-Path $path)) { throw "ไม่เจอไฟล์ตั้งค่า $path" }
  foreach ($line in Get-Content $path) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith("#") -or -not $t.Contains("=")) { continue }
    $i = $t.IndexOf("=")
    $map[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim().Trim('"').Trim("'")
  }
  return $map
}

$cfg = Read-Env $ConfigPath
$dbUrl      = $cfg["DATABASE_URL"]
$pgBin      = if ($cfg["PG_BIN"]) { $cfg["PG_BIN"] } else { "C:\PostgreSQL18\bin" }
$dailyDir   = if ($cfg["DAILY_DIR"]) { $cfg["DAILY_DIR"] } else { "C:\QVXBackup\daily" }
$weeklyDir  = if ($cfg["WEEKLY_DIR"]) { $cfg["WEEKLY_DIR"] } else { "E:\QVXBackup\weekly" }
$keepDaily  = [int]$(if ($cfg["KEEP_DAILY"]) { $cfg["KEEP_DAILY"] } else { 30 })
$keepWeekly = [int]$(if ($cfg["KEEP_WEEKLY"]) { $cfg["KEEP_WEEKLY"] } else { 12 })
$alertUrl    = if ($cfg["ALERT_URL"]) { $cfg["ALERT_URL"] } else { "https://quantvisionx.com/api/backup/report" }
$alertSecret = $cfg["BACKUP_ALERT_SECRET"]

if (-not $dbUrl) { throw "ไม่ได้ตั้ง DATABASE_URL ใน $ConfigPath" }

$root    = Split-Path $dailyDir -Parent
$logFile = Join-Path $root "backup.log"
$status  = Join-Path $root "STATUS.txt"
New-Item -ItemType Directory -Force -Path $dailyDir | Out-Null
New-Item -ItemType Directory -Force -Path $root | Out-Null

function Log([string]$m) {
  $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m
  Write-Output $line
  Add-Content -Path $logFile -Value $line
}

# แจ้งเตือนเฉพาะตอนพัง — สำเร็จทุกคืนแล้วเด้งทุกคืนคือ noise ที่ทำให้คนเลิกอ่าน
#
# ยิงผ่านเว็บ ไม่ยิง Telegram เอง เพราะของเดิมเก็บ bot token ไว้บนเครื่องนี้อีกชุด
# และบอทตัวนั้น (@BMTradingViewIndicator_Bot) ไม่ได้อยู่ในห้องไหนเลย
# แจ้งเตือนจึงไม่เคยถึงใคร ทั้งที่ log เขียนว่า "แจ้งเตือน Telegram แล้ว"
# (ตรวจแล้ว 29 ก.ย. 69 — getChat ทั้งห้อง QVX SIGNAL และ Admin QVX ตอบ 400)
#
# เว็บใช้บอทที่อยู่ในห้อง Admin QVX จริง เครื่องนี้จึงถือแค่ความลับของ endpoint
# ไม่ต้องถือ token ของบอทอีกต่อไป
#
# ต้องยืนยันว่าส่งถึงจริง ไม่ใช่แค่ยิงแล้วจบ — เขียน log ตามผลที่ได้จริง
function Alert([string]$m) {
  if (-not $alertSecret) { Log "  (ไม่ได้ตั้ง BACKUP_ALERT_SECRET — ข้ามการแจ้งเตือน)"; return }
  try {
    $body = @{ ok = $false; host = $env:COMPUTERNAME; message = $m } | ConvertTo-Json -Compress
    $res = Invoke-RestMethod -Method Post -Uri $alertUrl -TimeoutSec 20 `
      -Headers @{ Authorization = "Bearer $alertSecret" } `
      -ContentType "application/json; charset=utf-8" `
      -Body ([Text.Encoding]::UTF8.GetBytes($body))
    if ($res.ok) { Log "  แจ้งเตือนเข้าห้อง Admin QVX แล้ว" }
    else { Log "  เว็บรับเรื่องแล้วแต่ส่งเข้า Telegram ไม่ได้: $($res.reason)" }
  } catch { Log "  แจ้งเตือนไม่สำเร็จ: $($_.Exception.Message)" }
}

# รายงานตอนสำเร็จด้วย — ไม่ส่งข้อความเข้าห้อง แค่ให้เว็บรู้ว่ารอบนี้รันแล้ว
#
# ทำไมต้องรายงานตอนสำเร็จ: ถ้าเตือนแค่ตอนพัง กรณี "ไม่ได้รันเลย" จะไม่มีใครส่งอะไรมา
# — เครื่องปิด, งานตั้งเวลาถูกปิด, สคริปต์หาย — ความเงียบจึงดูเหมือนว่าปกติ
# เว็บมี cron รายวันคอยดูว่าเงียบเกิน 26 ชม. หรือยัง แล้วทักเอง (ดู src/lib/heartbeat.ts)
function Heartbeat([string]$m) {
  if (-not $alertSecret) { return }
  try {
    $body = @{ ok = $true; host = $env:COMPUTERNAME; message = $m } | ConvertTo-Json -Compress
    Invoke-RestMethod -Method Post -Uri $alertUrl -TimeoutSec 20 `
      -Headers @{ Authorization = "Bearer $alertSecret" } `
      -ContentType "application/json; charset=utf-8" `
      -Body ([Text.Encoding]::UTF8.GetBytes($body)) | Out-Null
    Log "  รายงานผลให้เว็บแล้ว"
  } catch { Log "  รายงานผลให้เว็บไม่สำเร็จ: $($_.Exception.Message)" }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$out   = Join-Path $dailyDir "qvx-$stamp.dump"

try {
  Log "เริ่มสำรองข้อมูล → $out"

  & "$pgBin\pg_dump.exe" $dbUrl --no-owner --no-acl --format=custom --compress=9 --file=$out
  if ($LASTEXITCODE -ne 0) { throw "pg_dump จบด้วยรหัส $LASTEXITCODE" }
  if (-not (Test-Path $out)) { throw "pg_dump ไม่ได้สร้างไฟล์" }

  $sizeMB = [math]::Round((Get-Item $out).Length / 1MB, 2)
  if ($sizeMB -lt 0.1) { throw "ไฟล์เล็กผิดปกติ ($sizeMB MB) — น่าจะ dump ไม่ครบ" }

  # ตรวจว่าเปิดไฟล์ได้จริงและมีข้อมูลตาราง ไม่ใช่แค่โครงเปล่า
  $listing = & "$pgBin\pg_restore.exe" --list $out 2>&1
  if ($LASTEXITCODE -ne 0) { throw "pg_restore --list เปิดไฟล์ไม่ได้ — dump เสีย" }
  $tables = ($listing | Select-String -Pattern "TABLE DATA" -AllMatches).Count
  if ($tables -lt 15) { throw "เจอตารางแค่ $tables ตาราง (ปกติ 23) — dump ไม่ครบ" }

  Log "  สำเร็จ · $sizeMB MB · $tables ตาราง"

  # ── สำเนาข้ามดิสก์ (วันอาทิตย์) ──
  $isSunday = (Get-Date).DayOfWeek -eq [DayOfWeek]::Sunday
  if ($isSunday -or $Now) {
    try {
      New-Item -ItemType Directory -Force -Path $weeklyDir | Out-Null
      Copy-Item $out (Join-Path $weeklyDir (Split-Path $out -Leaf)) -Force
      Log "  คัดลอกข้ามดิสก์ไป $weeklyDir แล้ว"
    } catch {
      # ดิสก์สำรองพังไม่ควรทำให้ทั้งงานล้ม — ของหลักสำรองไปแล้ว
      Log "  ⚠ คัดลอกข้ามดิสก์ไม่สำเร็จ: $($_.Exception.Message)"
      Alert "สำรองหลักสำเร็จ แต่คัดลอกไป $weeklyDir ไม่ได้: $($_.Exception.Message)"
    }
  }

  # ── ลบของเก่า ──
  $old = Get-ChildItem $dailyDir -Filter "qvx-*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $keepDaily
  foreach ($f in $old) { Remove-Item $f.FullName -Force; Log "  ลบของเก่า $($f.Name)" }
  if (Test-Path $weeklyDir) {
    $oldW = Get-ChildItem $weeklyDir -Filter "qvx-*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $keepWeekly
    foreach ($f in $oldW) { Remove-Item $f.FullName -Force; Log "  ลบสำเนารายสัปดาห์เก่า $($f.Name)" }
  }

  $kept = (Get-ChildItem $dailyDir -Filter "qvx-*.dump").Count
  "สำเร็จ $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') · $sizeMB MB · $tables ตาราง · เก็บไว้ $kept ไฟล์" | Set-Content $status
  Log "เสร็จสิ้น (เก็บไว้ $kept ไฟล์)"
  Heartbeat "$sizeMB MB · $tables ตาราง · เก็บไว้ $kept ไฟล์"
}
catch {
  $msg = $_.Exception.Message
  Log "❌ ล้มเหลว: $msg"
  "ล้มเหลว $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') · $msg" | Set-Content $status
  if (Test-Path $out) { Remove-Item $out -Force }  # อย่าเก็บไฟล์เสียไว้ให้เข้าใจผิดว่ามีสำรอง
  Alert $msg
  exit 1
}
