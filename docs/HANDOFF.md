# บันทึกส่งต่อ — สรุปทุกอย่างที่เปลี่ยน (27 ส.ค. 2569)

เขียนไว้ให้ session อื่นอ่านแล้วทำงานต่อได้ทันทีโดยไม่ต้องไล่ถาม
ทุกข้อในนี้ตรวจกับของจริงแล้ว ไม่ใช่เดาจากโค้ด

---

## สถานะตอนนี้

| อะไร | สถานะ | ตรวจยังไง |
|---|---|---|
| เว็บ production | 🟢 live | `curl -o /dev/null -w '%{http_code}' https://tradepulse-lime-five.vercel.app` → 200 |
| main | `42f101b` | CI ผ่าน (`verify: SUCCESS`) |
| คอมเบส (ASUS) | 🟢 ออนไลน์ | `~/sentiara-ai/scripts/mac/combase.sh status` |
| บริดจ์ TradingView | 🟢 รันอยู่ · callback ต่อแล้ว | `curl https://asus.tail17bed7.ts.net/health` |
| scheduled task | `Running` (Last Result `267009`) | `schtasks /query /tn TradePulseTVBridge /fo list /v` |
| ที่นั่งโปร | 300 ว่างครบ ยังไม่มีลูกค้าจ่ายเงิน | แถบโปรบนหน้าแรก |

`/health` ที่ถูกต้อง:

```json
{"ok": true, "queue": 0, "indicator": "Test 2 SMC Unified Suite", "callback": true}
```

`callback` ต้องเป็น `true` ถ้าเป็น `false` แปลว่าบอททำงานจริงแต่ไม่รายงานผลกลับเว็บ
คิวใน `/admin/access-queue` จะค้าง PENDING ตลอดทั้งที่ลูกค้าได้สิทธิ์ไปแล้ว

---

## เปลี่ยนอะไรไปบ้าง

### 1. บั๊กเรื่องเงิน 2 ตัว

**ราคาโปรไม่ตามไปทุกที่** — หน้าราคาแสดง ฿990 แล้ว แต่ 3 จุดยังอ่านแคตตาล็อกราคาปกติ
ประกาศ ฿1,290 บนหน้าเดียวกัน ตัวที่หนักสุดคือ JSON-LD (`lowPrice: 1290`) ซึ่ง Google
เทียบกับราคาที่แสดงบนหน้า ไม่ตรงเมื่อไหร่ตัด rich result ทิ้ง
แก้ให้ทั้งสามจุดรับราคาที่ใช้อยู่จริงเข้าไป และตั้ง `revalidate = 300` ให้หน้าฟีเจอร์

**คนที่ได้ที่นั่งโปรที่ 300 หลุดการล็อกราคา** — `lockPromoPriceIfEligible` ถูกเรียก
หลัง `recordPayment` แต่ข้างในถาม `getPromoState()` ซึ่งนับที่นั่ง**รวมตัวเอง**
คนที่ 300 จ่าย ฿990 → `taken` เป็น 300 → `active` เป็น false → return โดยไม่ล็อกราคา
→ ต่ออายุรอบหน้าโดนเก็บ ฿1,290 สวนกับที่หน้าเว็บสัญญาว่า "จ่ายเท่าเดิมทุกครั้งที่ต่ออายุ"
แก้เป็นนับที่นั่งแบบไม่รวมตัวเอง มีเทสต์ UAT `P-1` กันไว้แล้ว
(ยืนยันแล้วว่าเทสต์ล้มกับโค้ดเดิม ผ่านกับโค้ดใหม่ ไม่ใช่เทสต์ที่ผ่านทั้งสองทาง)

### 2. เครื่องมือที่เพิ่มเข้ามา

```bash
npm run setup   # ตั้งเครื่อง dev คำสั่งเดียว: หา Postgres → เขียน .env → migrate → seed
npm run admin   # สร้าง/รีเซ็ตบัญชีแอดมิน โดยไม่ต้องพึ่งระบบอีเมล
```

`npm run admin` มีเพราะปุ่ม "ลืมรหัสผ่าน?" บนเว็บใช้ไม่ได้ถ้ายังไม่มี `RESEND_API_KEY`
(`requestPasswordReset` ตัดจบที่ `if (!emailEnabled)` ตั้งแต่ก่อนสร้างตั๋ว)
รหัสผ่านไม่โชว์บนจอ ไม่รับผ่าน argument และโชว์ host ให้ยืนยันก่อนเขียนเสมอ

```bash
DATABASE_URL='<connection string จริงจาก Neon>' npm run admin
```

> ต้องวาง connection string **ตัวจริง** อย่าวางข้อความตัวอย่าง
> และครอบด้วย single quote กัน zsh ตีความ `$` `&` ในรหัสผ่าน

`npm run setup` ใช้ `.env` ไม่ใช่ `.env.local` เพราะ Prisma CLI อ่านแค่ `.env`
เขียนเป็น Node ไม่ใช่ shell script จะได้รันบน Windows ได้ ทดสอบจากโคลนเปล่าแล้ว

### 3. CI

`.github/workflows/ci.yml` — ทุก PR ยก Postgres ขึ้นมาแล้วรัน
`migrate deploy` → `npm test` → `npm run test:uat` → `next build` → `lint`

Vercel preview บอกได้แค่ว่า build ผ่านไหม ไม่เคยรันเทสต์เลย แต่ตรรกะที่พลาดแล้ว
เสียเงินจริง (วันหมดอายุ ราคาโปร การล็อกราคา) อยู่ในชุด UAT ซึ่งต้องมีฐานข้อมูลจริง

ชื่อฐานใน CI ตั้งเป็น `qvx_test` โดยตั้งใจ — `uat/guard.ts` ยอมเฉพาะฐานที่อยู่
localhost หรือชื่อมีคำว่า `uat`/`test`

### 4. บอท TradingView ต่อครบวงจรแล้ว

ตั้ง `TRADEPULSE_CALLBACK_URL` บนคอมเบสให้ชี้กลับมาที่เว็บ ยืนยันด้วย `/health`
เพิ่มปุ่ม **"สั่งบอท"** ในหน้า `/admin/access-queue` — ก่อนหน้านี้ `adminRetryTradingView`
เป็น dead code ไม่มี UI เรียกเลย แปลว่าไม่มีทางสั่งบอทจากหน้าเว็บได้

⚠️ **ปุ่ม "อนุมัติ" กับ "ยกเลิก" ไม่ได้เรียกบอท** แค่เปลี่ยน status ในฐานข้อมูล
ใช้ตอนไปจัดการบน TradingView ด้วยมือเองแล้ว กดเฉย ๆ โดยไม่ไปเพิ่มจริง
= ระบบขึ้นว่าเรียบร้อยแต่ลูกค้ายังใช้ไม่ได้

### 5. เอกสาร

| ไฟล์ | มีอะไร |
|---|---|
| `docs/SETUP.md` | ตั้งเครื่อง · เข้าแอดมิน · ฐานข้อมูลควรอยู่ที่ไหน · CI |
| `docs/TRADINGVIEW.md` | เช็กลิสต์เปิด auto · คู่มือคนกด · วิธีรีสตาร์ทบริดจ์ · ตารางแปล Last Result |
| `docs/MIGRATE.md` | เปลี่ยนบัญชี TradingView / เปลี่ยนบอท Telegram |

---

## ที่ยังค้าง

1. **`TV_BOT_URL` + `TV_BOT_SECRET` บน Vercel** — เหลือขั้นนี้ขั้นเดียว auto ก็ทำงานทั้งเส้น
   `tvAutoGrantEnabled = Boolean(TV_BOT_URL && TV_BOT_SECRET)` ไม่มีสวิตช์แยก
   ตรวจ log บริดจ์แล้วยังไม่เคยมี `POST /grant` ที่ผ่าน auth เลย มีแต่ 401

2. **สุ่ม `TV_BOT_SECRET` ใหม่** — ค่าเดิมหลุดตอน `type .env` ลงเทอร์มินัลแล้วแคปหน้าจอ
   บริดจ์เปิดออกอินเทอร์เน็ตผ่าน Funnel และใน log เห็นบอทสแกนยิงเข้ามาแล้ว
   ใครมี secret นี้สั่งแจก/ถอนสิทธิ์อินดิเคเตอร์ได้หมด
   ค่าที่หลุดชุดเดียวกัน: `INDICATOR_API_KEY`, รหัส TradingView

   ```bash
   openssl rand -hex 32
   ```

3. **`NEXT_PUBLIC_SITE_URL`** — ยังไม่ได้ตั้ง `sitemap.xml` เลยยังเขียน `http://localhost:3000`

4. **ตัวเลข Backtest** ยังไม่ได้ลง `src/config/stats.ts` (`published` ยังเป็น `false`)
   มีแล้ว: PnL +10,585.56 (+10.59%) · MaxDD 14,168.53 (11.94%) · Win 72.07% (1633/2266)
   Avg W/L 1.071 · XAUUSD 5m OANDA · 3 ส.ค. 2024–26 ส.ค. 2026 · ทุน 100K
   **ยังขาด Profit Factor**

5. **task เป็น `Logon Mode: Interactive only`** — รีบูตแล้วไม่มีคนล็อกอินค้าง
   บริดจ์จะไม่ขึ้นเอง จะดูเหมือนบอทพังทั้งที่แค่ task ไม่ได้เริ่ม
   แก้เป็น S4U ต้องใช้รหัสผ่านเครื่อง หรือย้ายบริดจ์ไป VPS ที่เปิดตลอด

---

## กับดักที่เสียเวลามาแล้ว — อ่านก่อนแตะ

### คอมเบส / บริดจ์

1. **`schtasks /end` อย่างเดียวฆ่าแค่ `cmd.exe`** ตัว python ยังถือพอร์ต 8787 อยู่
   ตัวใหม่เลย bind ไม่ได้แล้วตายเงียบ — ต้องฆ่า PID ที่ถือพอร์ตก่อนเสมอ
2. **อย่าสตาร์ทโปรเซสตรง ๆ ผ่าน SSH** ตายตอน session ปิด
   และ `Win32_Process.Create` รันใน session 0 เข้าไม่ถึงของที่ผูกกับ session ผู้ใช้
   **ใช้ `schtasks` เท่านั้น** (ลองมาครบสามทางแล้ว)
3. **`.bat` ต้องเรียก python ด้วย path เต็ม** python ติดตั้งแบบต่อผู้ใช้อยู่ใน `AppData\Local`
   เวลา task รันนอก session ผู้ใช้ PATH ไม่มี `python` → ล้มเงียบ → `Last Result: 1`
   **โดยไม่มีอะไรลง log เลย** หลอกมาก เพราะดูเหมือนบอทไม่เคยถูกเรียก
4. **ห้ามให้ log อยู่ที่ราก `C:\`** ต้องมีสิทธิ์แอดมิน และไฟล์เดิมเคยถูกล็อกค้าง
   พอ redirect ล้ม `cmd` คืน exit 1 ทั้งชุด — ย้ายไป `C:\Users\User\tv-bridge.log` แล้ว
5. **`/health` ไม่ตอบระหว่างบอททำงาน** เพราะ Selenium เป็นโค้ด blocking ค้าง event loop
   ไม่ใช่อาการล่ม
6. อ่าน `Last Result` ให้เป็น: `267009` = กำลังรัน · `1` = `.bat` ล้ม · `0` = จบไปแล้ว ผิดปกติ

### ปลุกคอมเบส

magic packet ต้องออกจาก**ในบ้าน** — ไม่มีเครื่องนอกบ้านเครื่องไหนปลุกได้โดยตรง

```bash
~/sentiara-ai/scripts/mac/combase.sh wake      # ยิงผ่านกล่อง x96
```

ถ้าเครื่องที่ใช้ต่อ tailnet ไม่ได้ (เช่นเน็ตมหาลัยบล็อก Tailscale) ให้พิมพ์ **`/wol`
ในบอท Telegram** แทน — กล่อง x96 poll Telegram เฉพาะตอน PC หลักดับ ซึ่งก็คือ
ตอนที่ต้องใช้พอดี และ Telegram เป็น cloud API ยิงจากเน็ตไหนก็ได้

`asus.tail17bed7.ts.net` เป็น Tailscale **Funnel** = เปิดออกอินเทอร์เน็ตจริง
`curl` ได้จากทุกที่แม้ไม่ได้อยู่บน tailnet (ต่างจากที่อยู่ `100.x`)

### เว็บ / ฐานข้อมูล

7. **ฐานข้อมูล dev ห้ามอยู่หลัง Tailscale/VPN** Vercel ต่อไม่ถึง
   `prisma migrate deploy` ตอน build จะล้ม → preview ของทุก PR พัง
8. **`prisma generate` หลัง pull ทุกครั้ง** stale Prisma client ทำให้ `next build` แดง
   ทั้งที่ `npm test` เขียว (vitest ไม่ type-check)
9. **`.env` ไม่ใช่ `.env.local`** Prisma CLI อ่านแค่ `.env`
10. **`D:\WebPeeNOT` บนเครื่องโดมอาจเป็นสำเนาเก่า** — seed ของรุ่นเก่าใส่รีวิวปลอม
    แบบอนุมัติแล้ว ถ้าเผลอรันชี้ production จะมีรีวิวปลอมขึ้นหน้าเว็บ
    ซึ่งผิด พ.ร.บ.คุ้มครองผู้บริโภค ไม่ใช่แค่เรื่องมารยาท — เช็ค `git remote -v` ก่อนเสมอ

### ค่าลับ

```bash
grep -o '^[A-Z_]*=' .env      # ดูว่าตั้งครบไหม โดยไม่โชว์ค่า
```

**อย่าใช้ `cat .env` / `type .env` แล้วแคปหน้าจอ** — หลุดมาแล้วรอบนึง

---

## คำสั่งที่ใช้บ่อย

```bash
# คอมเบส
~/sentiara-ai/scripts/mac/combase.sh status
~/sentiara-ai/scripts/mac/combase.sh wake
curl https://asus.tail17bed7.ts.net/health

# รีสตาร์ทบริดจ์ (บนคอมเบส)
$c = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if ($c) { Stop-Process -Id ($c.OwningProcess | Select-Object -First 1) -Force }
schtasks /end /tn TradePulseTVBridge
schtasks /run /tn TradePulseTVBridge

# เว็บ
npm run setup            # ตั้งเครื่อง dev คำสั่งเดียว
npm run admin            # สร้าง/รีเซ็ตบัญชีแอดมิน
npm test                 # 40 เทสต์ ไม่แตะฐานข้อมูล
npm run test:uat         # 10 เทสต์ ต่อฐานข้อมูลจริง
npx prisma generate      # หลัง git pull ทุกครั้ง
```
