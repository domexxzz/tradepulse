# ฐานข้อมูลหลักบน server-254

> **ผลจริง 19 ต.ค. 2569:** เน็ต 3BB ที่บ้าน server-254 (= คอมเฟิร์ส เครื่องเดียวกัน) เป็น **CGNAT**
> — WAN ของเราเตอร์ Huawei HG8145X6 เป็น `10.115.x.x` ส่วน IP สาธารณะ `183.89.x.x` เป็นของ ISP
> port forward จึงไม่ทะลุ และ Vercel ต่อ IPv6 ไม่ได้ · เลยใช้ **Supabase เป็นฐานหลักแทน**
> (`-Phase cloud` กู้ไฟล์สำรองจากเครื่องนี้ขึ้น Supabase + ปิด REST Data API + เตรียมค่าไปใส่ Vercel)
> ส่วน PostgreSQL บนเครื่องนี้เก็บไว้เป็นสำเนาสำรอง ขั้น 4–6 ด้านล่างใช้ได้เฉพาะเมื่อได้ Public IP จาก ISP
>
> **เว็บใช้ Supabase ตั้งแต่ 19 ต.ค. 2569 ~22:04** (โปรเจกต์ tradepulse, us-east-1 ที่เดียวกับ function ของ Vercel)
> - Vercel: `DATABASE_URL` = transaction pooler :6543 `?pgbouncer=true&connection_limit=1` · `DIRECT_URL` = session pooler :5432
> - กู้จาก `qvx-20261015-0839.dump` — ข้อมูลลูกค้าถึง 14 ต.ค. 21:35 ส่วนที่เข้ามาหลังจากนั้นจนถึงตอน Neon ล็อกยังค้างใน Neon (ข้อมูลไม่ถูกลบ) ดึงมาเติมได้เมื่อ Neon ได้โควตาใหม่
>
> ```powershell
> powershell -NoProfile -ExecutionPolicy Bypass -File C:\QVXDB\qvx-db-254.ps1 -Phase cloud -Dump C:\QVXBackup\daily\<ไฟล์ใหม่สุด>.dump
> notepad C:\QVXDB\vercel-env.txt   # ก๊อปสองค่าไปใส่ Vercel แล้วลบไฟล์
> ```

ต.ค. 2569 Neon แพ็กเกจฟรีหมดโควตาเวลาเครื่อง (100 CU-hour ต่อเดือน หมดราววันที่ 17 เพราะบอทกับงานตั้งเวลาปลุกฐานข้อมูลทุก ~20 วินาที)
เลยย้ายฐานข้อมูลมาไว้ที่ server-254 (Windows เปิด 24 ชม.) ส่วนเว็บยังอยู่ Vercel แล้วต่อเข้ามาทางอินเทอร์เน็ต

```
ลูกค้า → quantvisionx.com (Vercel, region sin1 สิงคโปร์)
              │  postgresql + SSL, พอร์ตภายนอก 55432
              ▼
         เราเตอร์บ้าน (port forward 55432 → server-254:5432)
              ▼
         server-254: PostgreSQL 18 · ฐาน qvx · user qvx_app
```

สคริปต์: `scripts/db-host/qvx-db-254.ps1` (วางบนเครื่องที่ `C:\QVXDB\qvx-db-254.ps1`)

**ข้อแลกเปลี่ยน:** ถ้า server-254 ดับ ไฟดับ หรือเน็ตบ้านหลุด เว็บส่วนที่ใช้ข้อมูลสมาชิกจะล่มทันที

## ติดตั้ง (ทำที่ server-254)

ทุกคำสั่งรันใน PowerShell แบบ **Run as Administrator**

### 0. เตรียมไฟล์ไว้ใน `C:\QVXDB\`

- `qvx-db-254.ps1`
- ไฟล์สำรองใหม่สุดจากคอมเฟิร์ส `C:\QVXBackup\daily\qvx-YYYYMMDD-HHmm.dump`
  (ใช้ RustDesk File Transfer หรือก๊อปผ่านเครื่องอื่น ไฟล์นี้มีข้อมูลลูกค้า อย่าฝากไว้ที่สาธารณะ)

สคริปต์สำรองลบไฟล์ที่ dump ไม่สำเร็จทิ้งเอง ไฟล์ใหม่สุดจึงเป็นไฟล์ดีอันสุดท้ายก่อน Neon ล็อก

### 1. ลง PostgreSQL 18

```powershell
winget install -e --id PostgreSQL.PostgreSQL.18 --interactive
```

ในหน้าติดตั้ง:
- Components: ติ๊กออก **pgAdmin 4** กับ **Stack Builder** (เหลือ Server + Command Line Tools)
- Password: ตั้งรหัสของ `postgres` แล้วจดเก็บไว้ (ใช้ครั้งเดียวในขั้นต่อไป)
- Port: `5432` · Locale: ค่าเริ่มต้น
- หน้าสุดท้าย: ติ๊กออก Launch Stack Builder

ถ้าไม่มี winget ให้โหลดจาก enterprisedb.com/downloads/postgres-postgresql-downloads (Windows x86-64, 18.x)

### 2. ตั้งค่า

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\QVXDB\qvx-db-254.ps1 -Phase setup
```

ใส่รหัส `postgres` (ไม่โชว์บนจอ) แล้วรอจนขึ้น `SETUP OK` ท้ายจอจะบอก:
- `Public IP of this internet line` — IP ของเน็ตบ้าน
- `Router port forward: TCP 55432 (external) -> 192.168.x.x : 5432` — ค่าที่ต้องไปตั้งในเราเตอร์

สิ่งที่สคริปต์ทำ:
- สร้าง user `qvx_app` + ฐาน `qvx`; รหัสสุ่ม 32 ตัวเก็บใน `C:\QVXDB\app-password.txt` (เปิดได้แค่แอดมิน)
- สร้างใบรับรอง SSL แบบ self-signed อายุ 10 ปี
- ให้รับจากนอกเครื่องได้แค่ SSL + `qvx_app` + ฐาน `qvx`; `postgres` เข้าได้แค่จากในเครื่อง
- เปิด firewall พอร์ต 5432 และตั้งไม่ให้เครื่องหลับ
- ทดสอบว่าเข้าแบบ SSL ได้ และเข้าแบบไม่ใช้ SSL หรือเข้าเป็น superuser จากนอกเครื่องโดนปฏิเสธ

รันซ้ำได้ รหัสเดิมไม่เปลี่ยน

### 3. กู้ข้อมูล

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\QVXDB\qvx-db-254.ps1 -Phase restore
```

ต้องขึ้น `ALL TABLES MATCH` และบอกเวลาข้อมูลล่าสุดของแต่ละตาราง (= ข้อมูลหลังเวลานั้นหายไปกับ Neon)
ถ้าฐาน `qvx` มีตารางอยู่แล้ว สคริปต์จะหยุดเอง ไม่กู้ทับ

### 4. เราเตอร์

**ลองแบบอัตโนมัติก่อน (UPnP — ไม่ต้องล็อกอินหน้าเราเตอร์):**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\QVXDB\qvx-db-254.ps1 -Phase portmap
```

- `Port forward: TCP 55432 (internet) -> 192.168.x.x:5432 OK` = เสร็จ ข้ามไปข้อ 5 ได้เลย
- สคริปต์ตั้งงาน `QVX PortMap` ให้เช็คและเติมกลับทุก 30 นาที (เราเตอร์รีบูตแล้ว mapping หาย) log อยู่ที่ `C:\QVXDB\portmap.log`
- `CGNAT` = เปิดพอร์ตไม่ได้ทุกทาง ต้องขอ Public IP จากผู้ให้บริการเน็ต หรือใช้ Supabase แทน
- `NOT FOUND` (เราเตอร์ปิด UPnP) หรือ `FAILED` = ทำด้วยมือตามด้านล่าง

**ทำด้วยมือ:**

1. เข้าหน้าเราเตอร์ (ส่วนใหญ่ `192.168.1.1` หรือดู Default Gateway จาก `ipconfig`)
2. **เช็ค IP:** WAN IP ในหน้าเราเตอร์ต้องตรงกับ `Public IP` จากขั้น 2
   ถ้าไม่ตรง หรือขึ้นต้นด้วย `100.64`–`100.127` / `10.` / `172.16`–`172.31` / `192.168.` = เน็ตเป็น CGNAT
   เปิดพอร์ตไม่ได้ ต้องโทรขอ Public IP จากผู้ให้บริการเน็ต
3. **DHCP Reservation / Static IP:** ล็อก IP แลนของ server-254 ไว้ ไม่ให้เปลี่ยน
4. **Port Forwarding / Virtual Server / NAT:** TCP พอร์ตภายนอก `55432` → IP แลนของ server-254 พอร์ต `5432`

ใช้พอร์ตภายนอก 55432 แทน 5432 เพื่อลดบอทสแกนที่ยิงพอร์ตมาตรฐาน

### 5. ชื่อโดเมนให้ IP บ้าน (DuckDNS)

IP เน็ตบ้านเปลี่ยนได้ (รีบูตเราเตอร์ก็เปลี่ยน) จึงใช้ชื่อแทน:

1. เข้า duckdns.org → sign in ด้วย Google หรือ GitHub
2. ตั้งชื่อ subdomain ที่เดายาก เช่น `qvxdb-xxxx` → add domain
3. ก๊อป token ด้านบนของหน้า
4. รัน (ใส่ token ตอนถาม ไม่โชว์บนจอ)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\QVXDB\qvx-db-254.ps1 -Phase ddns -Domain qvxdb-xxxx
```

ต้องขึ้น `DuckDNS update: ... OK` สคริปต์ตั้งงาน `QVX DuckDNS` อัปเดต IP ทุก 5 นาที (log: `C:\QVXDB\duckdns.log`)
ถ้าเราเตอร์มี DDNS ในตัว (No-IP/DynDNS) ใช้แทนได้

บอกชื่อ `xxxx.duckdns.org` ให้ Claude ทดสอบจากนอกบ้านได้เลย ไม่ต้องใช้รหัส (เช็คว่าพอร์ตตอบ ใช้ SSL และปฏิเสธรหัสผิด)
ทดสอบจาก server-254 เองไม่ได้ เพราะเราเตอร์หลายรุ่นไม่ยอมให้วนกลับเข้า IP ตัวเอง

### 6. ใส่ URL ใน Vercel

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\QVXDB\qvx-db-254.ps1 -Phase url -PublicHost qvxdb-xxxx.duckdns.org
```

URL พร้อมรหัสจะถูกก๊อปลง clipboard (ไม่โชว์บนจอ) แล้วไปที่ vercel.com → project **tradepulse** → Settings → Environment Variables:
- `DATABASE_URL` → Edit → วาง → Save (Production)
- `DIRECT_URL` → Edit → วางค่าเดียวกัน → Save

ห้ามวาง URL นี้ในแชท LINE หรือที่อื่น

### 7. สลับเว็บ (Claude ทำ)

- ตั้ง Vercel function region เป็น `sin1` (สิงคโปร์ ใกล้ไทย) ลด latency ต่อ query จาก ~250ms เหลือ ~35ms
- redeploy (build รัน `prisma migrate deploy` ซึ่งก็คือการทดสอบว่าต่อถึงด้วย)
- เช็คหน้าเว็บ + log ว่าไม่มี error ต่อฐานข้อมูล

## หลังย้าย

- **สำรองข้อมูล:**
  - ตั้ง pg_dump รายคืนบน server-254 เอง
  - เปลี่ยน `C:\QVXBackup\backup.env` บนคอมเฟิร์สให้ดึงจาก server-254 จะได้มีสำเนาอยู่อีกเครื่อง
  - URL สำหรับ pg_dump ต้องตัด `connection_limit` / `connect_timeout` ออก (libpq ไม่รู้จัก)
- **ข้อมูลที่ขาด:** ต้นเดือน Neon ได้โควตาใหม่ ดึงแถวที่สร้างหลังเวลาสำรองล่าสุดมาเติมได้
- **ให้เครื่องอยู่รอด:**
  - BIOS → Restore on AC Power Loss = Power On
  - Windows Update ตั้ง Active hours
  - service `postgresql-x64-18` เป็น Automatic อยู่แล้ว
- **ถ้าเว็บต่อฐานข้อมูลไม่ได้:**
  1. เช็คว่า 254 เปิดอยู่
  2. service ทำงาน
  3. `C:\QVXDB\duckdns.log` บรรทัดล่าสุดเป็น OK
  4. port forward ยังอยู่ (รีเซ็ตเราเตอร์แล้วหายได้)
