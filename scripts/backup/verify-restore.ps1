# ทดสอบกู้คืนไฟล์สำรองจริง — "สำรองได้" กับ "กู้คืนได้" คนละเรื่อง
#
# db-backup.ps1 ตรวจแค่ pg_restore --list ว่าอ่านสารบัญได้และมีตารางเกิน 15 ตาราง
# ซึ่งจับไฟล์เสียแบบชัด ๆ ได้ แต่ไม่ได้พิสูจน์ว่าข้อมูลกลับมาจริง
# ตัวนี้ยกคลัสเตอร์ Postgres ชั่วคราวขึ้นมาบนเครื่องนี้ กู้ลงไปจริง นับแถว แล้วลบทิ้ง
#
# ทำบนเครื่องที่ไฟล์สำรองอยู่ ไม่ต้องขนข้อมูลลูกค้าออกไปไหน
#
# รันเอง:  powershell -ExecutionPolicy Bypass -File C:\QVXBackup\verify-restore.ps1
# ไม่แตะฐานข้อมูล production และไม่แตะไฟล์สำรองเดิม — อ่านอย่างเดียว

param(
  [string]$BackupRoot = "C:\QVXBackup",
  [int]$Port = 55432,
  # ต่ำกว่านี้ถือว่าไฟล์สำรองใช้ไม่ได้ — เว็บมี 23 ตารางตอนเขียนสคริปต์นี้
  [int]$MinTables = 15
)

$ErrorActionPreference = "Stop"

# ไม่ตั้งอันนี้ ข้อความไทยจะเพี้ยนเป็นขยะเมื่อรันผ่าน SSH (codepage ของ console ไม่ใช่ UTF-8)
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

function Load-Env($path) {
  $h = @{}
  if (Test-Path $path) {
    foreach ($line in Get-Content $path) {
      if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$') { $h[$Matches[1]] = $Matches[2].Trim() }
    }
  }
  return $h
}

$cfg    = Load-Env "$BackupRoot\backup.env"
$pgBin  = if ($cfg.PG_BIN) { $cfg.PG_BIN } else { "C:\PostgreSQL18\bin" }

# ตรวจก่อนว่าเครื่องนี้มี "เซิร์ฟเวอร์" ไม่ใช่แค่เครื่องมือฝั่งไคลเอนต์
# คอมเฟิร์สลง PostgreSQL แบบ client-only ไว้ (pg_dump/pg_restore มี แต่ไม่มีโฟลเดอร์ share)
# ถ้าไม่เช็กตรงนี้ initdb จะพังด้วยข้อความ "postgres.bki does not exist" ซึ่งอ่านไม่รู้เรื่อง
$share = Join-Path (Split-Path $pgBin -Parent) "share\postgres.bki"
if (-not (Test-Path $share)) {
  Write-Host "เครื่องนี้มีแค่เครื่องมือฝั่งไคลเอนต์ ยกฐานข้อมูลชั่วคราวเพื่อทดสอบกู้คืนไม่ได้" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "สำรองข้อมูลยังทำงานปกติ (pg_dump ใช้ได้) แค่ทดสอบกู้คืนเต็มรูปแบบไม่ได้บนเครื่องนี้"
  Write-Host "ถ้าอยากทดสอบให้ได้ เลือกทางใดทางหนึ่ง:"
  Write-Host "  1. ลง PostgreSQL 18 แบบเต็ม (ไม่ใช่ client-only) บนเครื่องนี้ แล้วรันสคริปต์นี้ใหม่"
  Write-Host "  2. กู้ลงฐานข้อมูลชั่วคราวบน Neon แล้วลบทิ้ง (ข้อมูลไม่ออกจากผู้ให้บริการเดิม)"
  Write-Host ""
  Write-Host "ระหว่างนี้ db-backup.ps1 ยังตรวจไฟล์ด้วย pg_restore --list ทุกคืน"
  Write-Host "ซึ่งจับไฟล์เสียได้ แต่ไม่ได้พิสูจน์ว่าข้อมูลกลับมาครบ"
  exit 2
}
$work   = Join-Path $env:TEMP "qvx-restore-test"
$data   = Join-Path $work "pgdata"
$pwFile = Join-Path $work "pw.txt"

# ล้างของค้างจากรอบก่อน (เช่นรอบที่ถูกขัดจังหวะ) ก่อนเริ่มใหม่
if (Test-Path $work) {
  & "$pgBin\pg_ctl.exe" -D $data stop -m immediate 2>$null | Out-Null
  Start-Sleep -Seconds 2
  Remove-Item $work -Recurse -Force -EA SilentlyContinue
}
New-Item -ItemType Directory -Path $work -Force | Out-Null

# หาไฟล์สำรองล่าสุด
$dump = Get-ChildItem $BackupRoot -Recurse -Filter *.dump -EA SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $dump) { Write-Error "ไม่เจอไฟล์ .dump ใน $BackupRoot"; exit 1 }

$ageHours = [math]::Round(((Get-Date) - $dump.LastWriteTime).TotalHours, 1)
Write-Host "ไฟล์ที่จะทดสอบ : $($dump.Name)"
Write-Host "อายุ           : $ageHours ชั่วโมง"
Write-Host "ขนาด           : $([math]::Round($dump.Length/1MB,1)) MB"
Write-Host ""

$ok = $false
try {
  # รหัสสุ่มต่อรอบ คลัสเตอร์นี้อยู่แค่ไม่กี่นาทีแล้วถูกลบ
  $pw = -join ((1..24) | ForEach-Object { [char](Get-Random -InputObject (48..57 + 65..90 + 97..122)) })
  Set-Content -Path $pwFile -Value $pw -Encoding ascii

  Write-Host "1/5 สร้างคลัสเตอร์ชั่วคราว..."
  # locale=C เลี่ยงปัญหา "invalid locale settings" บน Windows ที่ตั้งภาษาไทย
  & "$pgBin\initdb.exe" -D $data -U postgres --pwfile=$pwFile --encoding=UTF8 --locale=C 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "initdb ไม่ผ่าน" }

  Write-Host "2/5 เปิดเซิร์ฟเวอร์ที่พอร์ต $Port..."
  # listen เฉพาะ localhost — คลัสเตอร์ทดสอบต้องไม่โผล่ออกเน็ตเวิร์ก
  & "$pgBin\pg_ctl.exe" -D $data -l "$work\pg.log" -o "-p $Port -h 127.0.0.1" start 2>&1 | Out-Null
  Start-Sleep -Seconds 3

  $env:PGPASSWORD = $pw
  & "$pgBin\createdb.exe" -h 127.0.0.1 -p $Port -U postgres qvxrestore 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "createdb ไม่ผ่าน" }

  Write-Host "3/5 กู้คืนข้อมูลลงไปจริง..."
  # --no-owner/--no-privileges เพราะ role ของ Neon ไม่มีบนเครื่องนี้
  & "$pgBin\pg_restore.exe" -h 127.0.0.1 -p $Port -U postgres -d qvxrestore `
      --no-owner --no-privileges $dump.FullName 2>&1 | Out-Null

  Write-Host "4/5 นับของที่กู้มาได้..."
  $q = @"
select (select count(*) from information_schema.tables where table_schema='public')
    || '|' || (select count(*) from "User")
    || '|' || (select count(*) from "SlipOrder")
    || '|' || (select count(*) from "Subscription")
"@
  $res = & "$pgBin\psql.exe" -h 127.0.0.1 -p $Port -U postgres -d qvxrestore -tAc $q 2>&1
  $parts = ("$res".Trim() -split '\|')
  if ($parts.Count -lt 4) { throw "อ่านผลนับไม่ได้: $res" }

  $tables = [int]$parts[0]
  Write-Host ""
  Write-Host "   ตาราง       : $tables"
  Write-Host "   ผู้ใช้       : $($parts[1])"
  Write-Host "   สลิป        : $($parts[2])"
  Write-Host "   แพ็กเกจ      : $($parts[3])"
  Write-Host ""

  if ($tables -lt $MinTables) { throw "ได้แค่ $tables ตาราง น้อยกว่าเกณฑ์ $MinTables" }
  if ([int]$parts[1] -lt 1)   { throw "กู้มาแล้วไม่มีผู้ใช้เลย ผิดปกติ" }

  $ok = $true
  Write-Host "5/5 ผ่าน — ไฟล์สำรองนี้กู้คืนได้จริง"
}
catch {
  Write-Host "ไม่ผ่าน: $_" -ForegroundColor Red
}
finally {
  # ต้องลบให้หมดเสมอ คลัสเตอร์นี้มีข้อมูลลูกค้าอยู่ ห้ามทิ้งค้างไว้บนดิสก์
  & "$pgBin\pg_ctl.exe" -D $data stop -m immediate 2>$null | Out-Null
  Start-Sleep -Seconds 2
  Remove-Item $work -Recurse -Force -EA SilentlyContinue
  Remove-Item Env:\PGPASSWORD -EA SilentlyContinue
  if (Test-Path $work) { Write-Host "เตือน: ลบ $work ไม่หมด ต้องลบมือ" -ForegroundColor Yellow }
  else { Write-Host "ลบคลัสเตอร์ทดสอบเรียบร้อย" }
}

if (-not $ok) { exit 1 }
