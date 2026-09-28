# สำรองฐานข้อมูล

ฐานข้อมูลจริงอยู่บน **Neon** (`Webpeenot` → `neondb`, AWS โอไฮโอ, Postgres 18.6)
ข้อมูลลูกค้าทั้งหมดอยู่ที่นั่นที่เดียว และโปรเจกต์อยู่บนบัญชีที่ใช้แผนฟรี

Neon มีระบบย้อนเวลาของตัวเองก็จริง แต่กู้ไม่ได้ถ้า **เข้าบัญชีไม่ได้** — ซึ่งเป็นความเสี่ยงจริง
ของเรา เพราะบัญชีไม่ได้อยู่ในมือเราคนเดียว จึงต้องมีสำเนาอยู่นอก Neon ด้วย

---

## ทำงานยังไง

รันบน **คอมเฟิร์ส** (`ssh oneye@100.107.33.82`) เพราะเปิดตลอดอยู่แล้วสำหรับบริดจ์ TradingView
— แมคปิดบ่อย งานตั้งเวลาจะพลาด

```
งานตั้งเวลา QVXDatabaseBackup  ทุกวัน 03:00  รันเป็น SYSTEM
  └─ C:\QVXBackup\db-backup.ps1
       ├─ pg_dump → C:\QVXBackup\daily\qvx-<วันเวลา>.dump   เก็บ 30 วัน
       ├─ ตรวจไฟล์ด้วย pg_restore --list (ต้องเจอ ≥ 15 ตาราง)
       ├─ วันอาทิตย์ คัดลอกไป E:\QVXBackup\weekly\          เก็บ 12 สัปดาห์
       └─ ล้มเหลว → เขียน STATUS.txt + แจ้ง Telegram (ถ้าตั้งค่าไว้)
```

**C: กับ E: อยู่คนละดิสก์กายภาพ** (PNY 1TB กับ GAMER 224GB) — SSD ตัวใดตัวหนึ่งพังยังเหลืออีกชุด
`D:` ว่างเปล่า ห้ามแตะ

ขนาดไฟล์ปัจจุบัน ~1.5 MB ต่อครั้ง · 30 วัน + 12 สัปดาห์ รวมไม่ถึง 100 MB

## ไฟล์ที่เกี่ยวข้อง

| ที่ | อะไร |
|---|---|
| `scripts/backup/db-backup.ps1` | สคริปต์ (ต้นฉบับอยู่ใน repo — แก้ที่นี่แล้วค่อยคัดลอกขึ้นเครื่อง) |
| `C:\QVXBackup\db-backup.ps1` | ตัวที่รันจริงบนคอมเฟิร์ส |
| `C:\QVXBackup\backup.env` | รหัสเข้าฐานข้อมูล · **ไม่อยู่ใน git** · ACL เปิดให้เฉพาะ `oneye`, SYSTEM, Administrators |
| `C:\QVXBackup\backup.log` | log ทุกครั้งที่รัน |
| `C:\QVXBackup\STATUS.txt` | ผลล่าสุด อ่านบรรทัดเดียวจบ |

> ⚠️ **คัดลอกสคริปต์ขึ้นเครื่องต้องใส่ UTF-8 BOM** ไม่งั้น PowerShell 5.1 อ่านภาษาไทยเป็นขยะ
> แล้ว parse ไม่ผ่านทั้งไฟล์:
> ```bash
> python3 -c "open('/tmp/x.ps1','wb').write(b'\xef\xbb\xbf'+open('scripts/backup/db-backup.ps1','rb').read())"
> scp /tmp/x.ps1 oneye@100.107.33.82:'C:/QVXBackup/db-backup.ps1'
> ```

> ⚠️ **เขียน `backup.env` ด้วย `echo` ไม่ได้** — zsh แปลง `\b` ใน `C:\...\bin` เป็นอักขระ
> backspace ทำให้พาธเพี้ยนเป็น `C:\PostgreSQL18in` ใช้ Python เขียนหรือ quote แบบ raw แทน

## สั่งสำรองเดี๋ยวนี้

```bash
ssh oneye@100.107.33.82 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\QVXBackup\db-backup.ps1 -Now'
```

`-Now` บังคับให้ทำสำเนาข้ามดิสก์ด้วย (ปกติทำเฉพาะวันอาทิตย์)

## เช็กว่ายังทำงานอยู่ไหม

```bash
ssh oneye@100.107.33.82 'powershell -NoProfile -Command "Get-Content C:\QVXBackup\STATUS.txt; Get-ScheduledTaskInfo -TaskName QVXDatabaseBackup | Select-Object LastRunTime,LastTaskResult,NextRunTime | Format-List"'
```

`LastTaskResult = 0` คือสำเร็จ

## กู้คืนจริง

ทดสอบครบวงจรแล้ว 28 ก.ย. 2569 — dump บนคอมเฟิร์ส → ดึงมาแมค → กู้เข้าฐานข้อมูลเปล่า →
**จำนวนแถวตรงกับ production ทุกตาราง**

```bash
# 1. ดึงไฟล์ล่าสุดมา
scp oneye@100.107.33.82:'C:/QVXBackup/daily/qvx-*.dump' ./

# 2. กู้เข้าฐานข้อมูลเปล่าเพื่อตรวจก่อนเสมอ — ห้ามกู้ทับ production ตรง ๆ
PGB=$(brew --prefix postgresql@18)/bin
$PGB/pg_restore -d "<connection string ของฐานข้อมูลเปล่า>" --no-owner --no-acl qvx-XXXX.dump
```

**pg_dump/pg_restore ต้องเป็นเวอร์ชันเดียวกับเซิร์ฟเวอร์ (18.x)** — ตัว 16 ของ Homebrew
ที่ลงไว้เดิมจะขึ้น `aborting because of server version mismatch` ใช้ `brew --prefix postgresql@18`

## role อ่านอย่างเดียว (มีไว้แล้ว ยังไม่ได้ใช้)

สร้าง `qvx_backup` ไว้ในฐานข้อมูลแล้ว — SELECT ได้ทุกตาราง เขียนอะไรไม่ได้เลย
(ทดสอบแล้ว: `insert` / `delete` / `drop` ถูกปฏิเสธหมด) และตารางที่ migration สร้างใหม่
ในอนาคตจะได้สิทธิ์อ่านอัตโนมัติผ่าน `ALTER DEFAULT PRIVILEGES`

ตอนนี้งานสำรองใช้ **role เจ้าของ** ตามที่เจ้าของโปรเจกต์เลือก เพื่อให้แก้ข้อมูลจากเครื่องนั้นได้เอง
ถ้าวันหนึ่งอยากลดความเสี่ยง เปลี่ยน `DATABASE_URL` ใน `backup.env` ให้ชี้ `qvx_backup` ได้ทันที
ไม่ต้องแก้สคริปต์

## ทดสอบกู้คืนซ้ำเมื่อไหร่ก็ได้

`scripts/backup/verify-restore.ps1` (วางไว้ที่ `C:\QVXBackup\verify-restore.ps1`)
ยกฐานข้อมูลชั่วคราวบนเครื่องนั้น กู้ไฟล์ล่าสุดลงไปจริง นับแถว แล้วลบทิ้ง
ไม่ต้องขนข้อมูลลูกค้าออกจากเครื่อง และไม่แตะ production

```bash
ssh oneye@100.107.33.82 'powershell -NoProfile -ExecutionPolicy Bypass -File C:\QVXBackup\verify-restore.ps1'
```

**ตอนนี้รันไม่ได้** — PostgreSQL บนคอมเฟิร์สลงไว้แบบ client-only มีแต่ `pg_dump`/`pg_restore`
ไม่มีไฟล์เซิร์ฟเวอร์ (`share\postgres.bki`) สคริปต์จะตรวจเจอแล้วบอกเองว่าต้องทำอะไร
ลง PostgreSQL 18 แบบเต็มเมื่อไหร่ก็รันได้ทันที

## ⚠️ แจ้งเตือนสำรองข้อมูลส่งไม่ถึง (ยังไม่แก้)

`TELEGRAM_CHAT_ID` ใน `backup.env` **มีค่าแล้ว แต่ใช้ไม่ได้** — Telegram ตอบ
`Bad Request: chat not found` เมื่อเรียก `getChat` ด้วย token ของ `@BMTradingViewIndicator_Bot`

สาเหตุ: chat id ที่ตั้งไว้เป็นห้องที่**บอทตัวนี้ไม่ได้เป็นสมาชิก** (น่าจะเป็นห้องของ
`@TD_SMC_bot` ซึ่งเป็นคนละบอท) ตรวจซ้ำได้ด้วย `getChat` — ไม่ต้องส่งข้อความจริง

**ผลคือถ้าสำรองข้อมูลล้มเหลว จะไม่มีใครรู้** ต้องเข้าไปดู `C:\QVXBackup\STATUS.txt` เอง

วิธีแก้ เลือกทางใดทางหนึ่ง:
1. ทัก `@BMTradingViewIndicator_Bot` ใน Telegram สักข้อความ แล้วอ่าน chat id จาก
   `getUpdates` มาใส่ `backup.env` (ตอนนี้บอทไม่ได้ตั้ง webhook ไว้ `getUpdates` จึงใช้ได้)
2. เชิญบอทตัวนี้เข้าห้องแอดมินที่ใช้อยู่ แล้วค่อยเอา chat id เดิมมาใช้
- **สำเนานอกบ้าน** — ตอนนี้ทั้งสองชุดอยู่ในเครื่องเดียวกัน ไฟไหม้/ขโมย/น้ำท่วมคือหายทั้งคู่
  ขั้นต่อไปควรส่งขึ้นที่เก็บนอกบ้านสักที่ (Google Drive / S3 / เครื่องอื่น)
