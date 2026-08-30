# ให้สิทธิ์อินดิเคเตอร์บน TradingView อัตโนมัติ

TradingView ไม่มี public API สำหรับเพิ่ม/ลบ username ในสคริปต์ invite-only
วิธีที่ใช้จริงคือบอทที่เปิด Chrome ซึ่งล็อกอินบัญชีเจ้าของสคริปต์ค้างไว้ แล้วกดหน้าเว็บให้ (Selenium)

บอทตัวนั้นอยู่คนละที่กับเว็บนี้ — repo `electiction/Bot-Tradingview`
ไฟล์ `tv_bridge.py` ในนั้นคือส่วนที่เปิด HTTP ให้เว็บเราเรียก (อ่าน `BRIDGE_README.md` ประกอบ)

**ไม่ตั้งค่า = ทำงานแบบเดิม** แอดมินเพิ่ม username เองผ่านคิว `/admin/access-queue`

## ภาพรวม

```
ลูกค้าจ่ายเงิน / แอดมินอนุมัติสลิป / cron ปิดสิทธิ์
        │
        ▼
  เว็บ (Vercel)  ──POST /grant หรือ /revoke──►  tv_bridge.py (เครื่องที่มี Chrome)
        ▲                                              │
        │                                       เข้าคิว ทำทีละงาน
        │                                              │
        │                                    Selenium กดหน้า TradingView
        │                                              │
        └──POST /api/tradingview/callback ─────────────┘  (60-120 วินาทีต่อมา)
```

**เว็บไม่ยืนรอให้บอททำงานจบ** เพราะขั้นตอน Selenium ใช้เวลาเป็นนาที
และ Vercel จำกัดเวลาของแต่ละ request อยู่แล้ว จึงสั่งแล้วปล่อย
รายการยังค้างในคิวจนกว่าบอทจะรายงานผลกลับมา

## สัญญาการเรียก

เว็บ → บอท:

```
POST {TV_BOT_URL}/grant     {"secret":"...", "username":"someone", "days": 27}
POST {TV_BOT_URL}/revoke    {"secret":"...", "username":"someone"}
```

บอทตอบทันที (ยังไม่ได้ทำงานจริง):

```json
{"ok": true, "queued": true, "position": 1}
```

บอท → เว็บ เมื่อทำงานเสร็จ:

```
POST https://โดเมนเว็บ/api/tradingview/callback
{"secret":"...", "action":"grant", "username":"someone", "ok":true, "error":null,
 "proof":"<PNG base64 ไม่ใส่ก็ได้>"}
```

`proof` คือภาพกล่อง Manage access ที่บอทแคปไว้เป็นหลักฐานให้ลูกค้า
เว็บจะ decode แล้วส่งเข้า DM Telegram ของเจ้าของ username นั้นให้อัตโนมัติ
ไม่ส่งมาก็ทำงานได้ตามปกติ แค่ลูกค้าไม่ได้รับรูป

| ค่าที่ callback ตอบใน `proof` | แปลว่า |
|---|---|
| `sent` | ส่งเข้า DM ลูกค้าแล้ว |
| `no-telegram-account` | สมาชิกยังไม่ได้ผูกบัญชี Telegram |
| `needs-start` | ผูกแล้วแต่ไม่เคยกด Start กับบอท — Telegram ห้ามบอททักก่อน |
| `invalid-png` | base64 ที่ส่งมาไม่ใช่ไฟล์ PNG |
| `failed` | Telegram ปฏิเสธด้วยเหตุอื่น |

ทุกกรณีที่ไม่ใช่ `sent` จะเด้งแจ้งแอดมินให้ส่งภาพเองแทน
และ**ไม่**ทำให้ callback ล้ม — สถานะสิทธิ์ถูกบันทึกไปก่อนหน้านั้นแล้ว

> ⚠️ ฝั่งบอทยังไม่ได้ส่ง `proof` มา ต้องแก้ `tlapi.py` บนเครื่องบอทก่อน
> (ดูหัวข้อ "ภาพหลักฐานสิทธิ์" ด้านล่าง)

> `days` คำนวณจากวันหมดอายุแพ็กเกจจริง เพื่อให้สิทธิ์บน TradingView หมดพร้อมกัน
> เผื่อ cron ฝั่งเราไม่ทำงานสักวันก็ยังไม่มีใครใช้ฟรีเกินกำหนด

## รันบริดจ์ที่ไหน — "คอมเบส" (เครื่อง ASUS ที่บ้าน)

บอทตัวนี้ถูกเขียนมาให้รันบนคอมเบสอยู่แล้ว หลักฐานตรงกันหมด:

| สิ่งที่โค้ดคาดหวัง | คอมเบสมีจริง |
|---|---|
| Windows + Chrome | ✅ `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| โปรไฟล์ Chrome ชื่อ `Profile 1` | ✅ มีอยู่ (ตรงกับค่าที่ฝังไว้ในโค้ดเดิม) |
| Python | ✅ 3.13 |
| โค้ดบอท | ✅ `C:\Users\User\OneDrive\Desktop\Bot Tradingview` (git clone ของ repo เดียวกัน) |

สั่งงานคอมเบสจากแมคผ่าน `~/sentiara-ai/scripts/mac/combase.sh`
(อ่าน `~/sentiara-ai/docs/ops/COMBASE_RUNBOOK.md` ก่อนแตะ — มีกับดักหลายอย่าง)

### ขั้นตอนติดตั้งบนคอมเบส

```bash
C=~/sentiara-ai/scripts/mac/combase.sh
$C wake
$C run 'cd /d "C:\Users\User\OneDrive\Desktop\Bot Tradingview" && git pull'
$C run 'cd /d "C:\Users\User\OneDrive\Desktop\Bot Tradingview" && pip install -r requirements-bridge.txt'
# กรอก .env ตาม .env.bridge.example แล้วตั้ง scheduled task ให้รัน tv_bridge.py
```

> ⚠️ **อย่ารันด้วย `Start-Process` ผ่าน SSH — มันเงียบสนิทไม่ launch อะไรเลย** ต้องใช้ `schtasks`
> และ `schtasks /run` จะไม่ทำอะไรถ้าสถานะยัง running ต้อง `/end` ก่อนเสมอ

### ให้เว็บบน Vercel เรียกถึงคอมเบสได้

คอมเบสอยู่หลัง AP isolation และไม่มี public IP — ต้องเปิดทางออกให้ก่อน

- **Tailscale Funnel** (แนะนำ เพราะคอมเบสต่อ Tailscale อยู่แล้ว) — ได้ URL `https://<ชื่อเครื่อง>.<tailnet>.ts.net`
  เอาไปใส่ `TV_BOT_URL` ได้เลย ไม่ต้องลงอะไรเพิ่ม (ต้องเปิด Funnel ใน ACL ของ tailnet ก่อน)
- **cloudflared tunnel** — ใช้ได้เหมือนกัน แต่ต้องลงโปรแกรมเพิ่ม

### ค่าที่ติดตั้งจริงไว้แล้วบนคอมเบส (ตรวจกับเครื่องจริง 27 ส.ค. 2569)

| อะไร | ค่า |
|---|---|
| บัญชีเจ้าของสคริปต์ | `Pyro_Bolt` |
| สคริปต์ที่ขาย | `Test 2 — SMC Unified Suite [Pyro_Bolt]` (invite-only) |
| โปรไฟล์ Chrome ของบอท | `C:\tv-bot-chrome` (ล็อกอิน TradingView ไว้แล้ว) |
| โฟลเดอร์บอท | `C:\Users\User\OneDrive\Desktop\Bot Tradingview` |
| scheduled task | `TradePulseTVBridge` — trigger `At system start up`, run as `User` |
| ตัวสั่งรัน | `C:\tv-bridge-run.bat` (ตั้ง UTF-8 แล้วเรียก `python.exe -u tv_bridge.py`) |
| log | `C:\Users\User\tv-bridge.log` |
| callback | ตั้งแล้ว ชี้ไป `https://tradepulse-lime-five.vercel.app/api/tradingview/callback` |
| URL สาธารณะ | `https://asus.tail17bed7.ts.net` (Tailscale Funnel) |

**รีสตาร์ทบริดจ์** — ต้องฆ่าโปรเซสที่ถือพอร์ต 8787 ก่อน แล้วค่อย `schtasks /end` + `/run`
(`/end` อย่างเดียวฆ่าแค่ cmd.exe — ตัว python ยังถือพอร์ตอยู่ ตัวใหม่เลย bind ไม่ได้แล้วตายเงียบ)

```powershell
$c = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
if ($c) { Stop-Process -Id ($c.OwningProcess | Select-Object -First 1) -Force }
schtasks /end /tn TradePulseTVBridge
schtasks /run /tn TradePulseTVBridge
```

เช็คว่าขึ้นจริงจาก `schtasks /query /tn TradePulseTVBridge /fo list /v`

| Last Result | แปลว่า |
|---|---|
| `267009` (0x41301) | กำลังรันอยู่ — ปกติ |
| `1` | `.bat` ล้ม มักเป็น python ไม่เจอใน PATH หรือเขียน log ไม่ได้ |
| `0` | จบไปแล้ว = บริดจ์ไม่ได้รันต่อ ผิดปกติ |

> `schtasks /run` ผ่าน SSH ใช้ได้ แต่การสตาร์ทโปรเซสตรง ๆ จาก SSH ไม่รอด —
> โปรเซสจะตายตอน session ปิด และ `Win32_Process.Create` ก็รันใน session 0
> ซึ่งเข้าไม่ถึงของที่ผูกกับ session ของผู้ใช้ ใช้ `schtasks` เท่านั้น

> ระหว่างที่บอทกำลังทำงาน `/health` จะไม่ตอบ เพราะ Selenium เป็นโค้ด blocking
> ที่ค้าง event loop ไว้ทั้งงาน — ไม่ใช่อาการล่ม

### กับดักที่ต้องรู้ก่อนใช้จริง

1. **คอมเบสไม่ได้เปิดตลอด 24 ชม.** — มีคำสั่ง `combase.sh off` ที่ปิดเครื่องตอนกลางคืน
   ช่วงที่ปิด คำสั่งจากเว็บจะไม่ถึง → รายการตกไปเข้าคิว `/admin/access-queue` ให้ทำมือ
   (ระบบออกแบบมารองรับแล้ว ออเดอร์ไม่ล้ม แต่ลูกค้าจะรอนานขึ้น)
   ถ้าจะขายจริงจัง ควรตั้งให้คอมเบสไม่ปิด หรือย้ายบริดจ์ไป VPS แยก
2. **ห้ามใช้ `Profile 1` ร่วมกับ Chrome ที่เปิดใช้งานอยู่** — Chrome ล็อกโฟลเดอร์โปรไฟล์ไว้
   Selenium จะเปิดไม่ได้ถ้ามีหน้าต่าง Chrome ของโปรไฟล์เดียวกันเปิดค้าง
   → ควรสร้างโปรไฟล์แยกไว้ให้บอทโดยเฉพาะ แล้วล็อกอินบัญชีเจ้าของสคริปต์ในนั้น
   (ตั้งผ่าน `CHROME_PROFILE_DIR` ที่เพิ่งทำให้เป็น env แล้ว)
3. **task เป็น `Interactive only`** — ตั้ง trigger ไว้ที่ system start up แล้วก็จริง
   แต่ logon mode ยังเป็น interactive แปลว่าต้องมีคนล็อกอินค้างไว้บนเครื่อง
   รีบูตแล้วไม่มีใครล็อกอิน บริดจ์จะไม่ขึ้น — เช็คได้ตลอดด้วย `/health`
4. **`.bat` ต้องเรียก python ด้วย path เต็ม** — python บนเครื่องนี้ติดตั้งแบบต่อผู้ใช้
   (`C:\Users\User\AppData\Local\Programs\Python\Python313\python.exe`)
   เวลา scheduled task รันนอก session ของผู้ใช้ PATH ไม่มี `python`
   คำสั่งจะล้มเงียบ ๆ แล้ว task รายงาน `Last Result: 1` โดยไม่มีอะไรลง log เลย
5. **ห้ามให้ log อยู่ที่ราก `C:\`** — เขียนที่รากไดรฟ์ต้องมีสิทธิ์แอดมิน
   และไฟล์เดิมเคยถูกโปรเซสอื่นล็อกค้างจนปลดไม่ได้ พอ redirect ล้ม
   `cmd` คืน exit 1 ทั้งชุด ทำให้ดูเหมือนบอทพังทั้งที่โค้ดไม่มีปัญหา
   ตอนนี้ย้ายไป `C:\Users\User\tv-bridge.log` แล้ว
6. **path บอทอยู่ใน OneDrive** — OneDrive เคยล็อกไฟล์ log จนบริดจ์เขียนไม่ได้
   จึงย้าย log ออกไปไว้ `C:\tv-bridge.log` ซึ่งอยู่นอก OneDrive
   ถ้าจะย้ายโฟลเดอร์บอท อย่าลืมแก้ path ใน `C:\tv-bridge-run.bat` ด้วย

## ตั้งค่า

ฝั่งเว็บ:

```bash
vercel env add TV_BOT_URL      # เช่น https://tv-bot.example.com (ไม่ต้องมี / ปิดท้าย)
vercel env add TV_BOT_SECRET   # สุ่มยาว ๆ ต้องตรงกับฝั่งบอท
```

ฝั่งบอท (ในเครื่องที่รัน Chrome) — ดู `.env.bridge.example` ใน repo บอท:

```
TV_BOT_SECRET=<ค่าเดียวกับข้างบน>
TV_INDICATOR_NAME=<ชื่อสคริปต์ตามที่แสดงในหน้า Published Scripts>
TV_PROFILE_USERNAME=<บัญชี TradingView เจ้าของสคริปต์>
TRADEPULSE_CALLBACK_URL=https://โดเมนเว็บ/api/tradingview/callback
CHROME_USER_DATA_DIR=<โฟลเดอร์โปรไฟล์ Chrome ที่ล็อกอินค้างไว้>
```

เครื่องที่รันบอทต้องเปิดตลอด และถ้าไม่มี public IP ต้องมี tunnel
คอมเบสใช้ **Tailscale Funnel** อยู่ (ไม่ใช่ cloudflared) เพราะเครื่องอยู่บน tailnet อยู่แล้ว:

```bash
tailscale funnel --bg 8787      # ได้ https://asus.tail17bed7.ts.net
tailscale funnel status         # ดูว่ายังเปิดอยู่ไหม
```

Funnel เปิดออกอินเทอร์เน็ตจริง ไม่ใช่แค่ใน tailnet — Vercel จึงเรียกถึงได้
ต่างจากที่อยู่ `100.x` ซึ่งเรียกได้เฉพาะเครื่องบน tailnet เดียวกัน

## เปิดใช้งานอัตโนมัติ — เช็กลิสต์

เป้าหมาย: **ลูกค้ากรอก TradingView username แล้วบอทไปเพิ่มสิทธิ์ให้เองทันที**

โค้ดฝั่งเว็บพร้อมแล้ว (`saveTradingViewUsername` เรียก `syncTradingViewGrant` ต่อทันที)
ที่เหลือเป็นเรื่อง env ล้วน ๆ — ต้องครบ **ทั้งสามค่า** ไม่งั้นเงียบ

| ค่า | ตั้งที่ไหน | ถ้าไม่ตั้งจะเป็นยังไง |
|---|---|---|
| `TV_BOT_URL` | Vercel | `tvAutoGrantEnabled = false` → `syncTradingViewGrant` return ทันที ไม่เกิดอะไรเลย |
| `TV_BOT_SECRET` | Vercel **และ** `.env` ของบอท (ต้องตรงกัน) | เหมือนข้างบน / ถ้าไม่ตรงบอทตอบ `secret ไม่ถูกต้อง` |
| `TRADEPULSE_CALLBACK_URL` | `.env` ของบอท | บอททำงานจริงแต่**ไม่รายงานผลกลับ** → คิวใน `/admin/access-queue` ค้าง PENDING ตลอด ทั้งที่ลูกค้าได้สิทธิ์ไปแล้ว |

`tvAutoGrantEnabled` คือ `Boolean(TV_BOT_URL && TV_BOT_SECRET)` เฉย ๆ ไม่มีสวิตช์แยก
ตั้งครบเมื่อไหร่ก็เปิดเอง ลบออกเมื่อไหร่ก็กลับไปเข้าคิวให้ทำมือ ออเดอร์ไม่พังทั้งสองทาง

### ขั้นตอน

**1. ฝั่งบอท (คอมเบส) — ทำแล้ว ✅ (27 ส.ค. 2569)**

```
TRADEPULSE_CALLBACK_URL=https://tradepulse-lime-five.vercel.app/api/tradingview/callback
```

ยืนยันด้วย `/health` ว่าขึ้น `"callback": true` แล้ว
ถ้าย้ายไปโดเมนของตัวเองเมื่อไหร่ ต้องกลับมาแก้ค่านี้แล้วรีสตาร์ทบริดจ์ด้วย
ไฟล์สำรองก่อนแก้อยู่ที่ `C:\tv-bridge-env.bak` และ `C:\tv-bridge-run.bat.bak`

**2. ฝั่งเว็บ (Vercel) — ยังไม่ได้ทำ ⬅ เหลือแค่ขั้นนี้ขั้นเดียว**

ใส่สองค่า แล้ว redeploy

```bash
vercel env add TV_BOT_URL       # https://asus.tail17bed7.ts.net  (ไม่มี / ปิดท้าย)
vercel env add TV_BOT_SECRET    # ก๊อปจาก TV_BOT_SECRET ใน .env ของบอทบนคอมเบส
```

`TV_BOT_SECRET` ตั้งไว้แล้วฝั่งบอท — เปิดดูได้ที่
`C:\Users\User\OneDrive\Desktop\Bot Tradingview\.env` บนคอมเบส
ต้องใส่ให้ตรงกันเป๊ะ ไม่งั้นบอทตอบ `secret ไม่ถูกต้อง` (401)

> env ไม่ใช่ `NEXT_PUBLIC_*` อ่านตอน runtime ก็จริง แต่ Vercel ต้อง redeploy
> ให้ instance ใหม่รับค่าไปใช้ ตั้งเฉย ๆ แล้วไม่ deploy จะยังไม่มีผล

### ตรวจว่าทำงานจริงไหม

**ก. บริดจ์ยังอยู่ไหม**

```bash
curl https://asus.tail17bed7.ts.net/health
```

ต้องได้ประมาณนี้:

```json
{"ok": true, "queue": 0, "indicator": "Test 2 SMC Unified Suite", "callback": true}
```

- `callback: false` = **ยังไม่ได้ตั้ง `TRADEPULSE_CALLBACK_URL`** บอททำงานได้แต่ผลจะไม่กลับมาที่เว็บ
- `queue` ค้างเลขเดิมนาน ๆ = มีงานติดอยู่ ไปดู `C:\tv-bridge.log`
- ต่อไม่ติดเลย = คอมเบสปิด หรือ Funnel หลุด (`tailscale funnel status`)

> ระหว่างบอทกำลังทำงาน `/health` จะไม่ตอบชั่วคราว เพราะ Selenium เป็นโค้ด blocking
> ค้าง event loop ไว้ทั้งงาน — ไม่ใช่อาการล่ม

**ข. secret กันจริงไหม** — ยิงโดยไม่ใส่ secret ต้องถูกปฏิเสธ

```bash
curl -X POST https://asus.tail17bed7.ts.net/grant \
  -H 'Content-Type: application/json' -d '{"username":"x","days":1}'
# {"ok": false, "error": "secret ไม่ถูกต้อง"}
```

**ค. ฝั่งเว็บเปิดหรือยัง** — เข้า `/admin/system` ดูแถว TradingView
ถ้ายังไม่ได้ตั้ง env จะขึ้นว่า "ตั้ง TV_BOT_URL + TV_BOT_SECRET"

**ง. ลองทั้งเส้นจริง** — สมัครบัญชีทดสอบ เปิดสิทธิ์ให้ แล้วกรอก TradingView
username ที่ `/account` จากนั้นดู `C:\tv-bridge.log` ว่ามีงานเข้า
และดู `/admin/access-queue` ว่าสถานะเปลี่ยนเป็น GRANTED ภายใน 1-2 นาที
ถ้างานเข้าแต่สถานะไม่เปลี่ยน = callback ไม่ถึง กลับไปดูข้อ ก.

## ระบบเรียกบอทตอนไหน

| จังหวะ | เกิดอะไร |
|---|---|
| อนุมัติสลิป / จ่ายผ่าน Stripe สำเร็จ | `/grant` ถ้าสมาชิกกรอก username ไว้แล้ว |
| สมาชิกกรอก username ทีหลัง | `/grant` ทันทีถ้ามีแพ็กเกจใช้งานอยู่ |
| cron ปิดสิทธิ์เมื่อหมดอายุ | `/revoke` |
| แอดมินกดปิดสิทธิ์ทันที | `/revoke` |

## คู่มือคนกด — เพิ่ม / ต่ออายุ / ถอนสิทธิ์ลูกค้า

มีสามทาง เลือกตามสถานการณ์

| สถานการณ์ | ทำยังไง |
|---|---|
| ลูกค้าจ่ายเงินผ่านเว็บ/แอดมินอนุมัติสลิป | **ไม่ต้องทำอะไร** ระบบเรียกบอทให้เอง ถ้าลูกค้ากรอก username ไว้แล้ว |
| ลูกค้ากรอก username ทีหลัง | **ไม่ต้องทำอะไร** ระบบเรียกบอททันทีถ้ามีแพ็กเกจใช้งานอยู่ |
| หมดอายุ | **ไม่ต้องทำอะไร** cron รอบ 01:00 ถอนสิทธิ์ให้ |
| บอทพลาด / ลูกค้าแจ้งว่ายังไม่ได้ | `/admin/access-queue` → กด **สั่งบอท** |
| ลูกค้าเปลี่ยน TradingView username | ให้ลูกค้าแก้เองที่ `/account` แล้วแอดมินกด **สั่งบอท** |
| อยากทำเองบน TradingView โดยไม่ผ่านบอท | ไปเพิ่ม/ลบใน TradingView ด้วยมือ แล้วกลับมากด **อนุมัติ** / **ยกเลิก** เพื่อบันทึกสถานะ |

### ปุ่มในหน้า `/admin/access-queue` ต่างกันยังไง

| ปุ่ม | เรียกบอทไหม | ใช้ตอนไหน |
|---|---|---|
| **สั่งบอท** | **ใช่** | ให้บอทไปเพิ่ม/ถอนสิทธิ์บน TradingView ให้ (ดูสถานะแพ็กเกจแล้วตัดสินเองว่าจะ grant หรือ revoke) |
| **อนุมัติ** | ไม่ | บันทึกว่าให้สิทธิ์แล้ว — ใช้ตอนไปเพิ่มบน TradingView ด้วยมือเองแล้ว |
| **ยกเลิก** | ไม่ | บันทึกว่าถอนสิทธิ์แล้ว — ใช้ตอนไปลบบน TradingView ด้วยมือเองแล้ว |

> **อย่าสับสนสองกลุ่มนี้** กด "อนุมัติ" เฉย ๆ แล้วไม่ได้ไปเพิ่มบน TradingView
> = ในระบบขึ้นว่าเรียบร้อยแต่ลูกค้ายังใช้อินดิเคเตอร์ไม่ได้จริง
> ปุ่ม **สั่งบอท** ขึ้นเฉพาะสมาชิกที่กรอก TradingView username ไว้แล้วเท่านั้น

### ต่ออายุลูกค้าเดิม

`/grant` รอบสองไม่พัง — บริดจ์ลอง `add_indicator_access` ก่อน
ถ้ามีสิทธิ์อยู่แล้วจะไปต่อที่ `renew_indicator_access` ให้เอง (เว้นช่วงเก็บซาก Chrome ก่อน 6 วินาที)
เพราะฉะนั้นตอนลูกค้าต่ออายุ ระบบเรียก `/grant` ตัวเดิมได้เลย ไม่ต้องมี endpoint แยก

### สั่งจาก Telegram โดยตรง (บอทตัวเดิม)

บอทเดิมยังรับคำสั่งใน Telegram ได้อยู่ ใช้ตอนเว็บล่มหรืออยากจัดการเร็ว ๆ

| คำสั่ง | ทำอะไร |
|---|---|
| `/add <username> <วันหมดอายุ>` | เพิ่มสิทธิ์ |
| `/re <username> <วันหมดอายุ>` | ต่ออายุ |
| `/del <username>` | ถอนสิทธิ์ |

> ทำผ่านทางนี้ **ฐานข้อมูลเว็บจะไม่รู้** สถานะใน `/admin/access-queue` จะไม่ตรงกับของจริง
> ใช้เท่าที่จำเป็น แล้วกลับมากดบันทึกสถานะในหน้าคิวให้ตรงด้วย

## เมื่อบอทพัง

บอทคุม TradingView ผ่าน Selenium จึงผูกกับหน้าเว็บของ TradingView โดยตรง
เดิมจับปุ่มจาก class ที่มีแฮช (เช่น `button-qm7Rg5MB`) ซึ่ง TradingView เปลี่ยนเมื่อไหร่ก็ได้
และเคยพังมาแล้วทั้งชุด — ตอนนี้เปลี่ยนไปใช้ selector ที่อิงความหมายแทน
(`a[href*='/script/']`, `input[role='searchbox']`, `[data-username]`) ซึ่งทนกว่ามาก
แต่ก็ยังไม่ใช่ API ทางการ วันที่พังต้องไปแก้ selector ในฝั่งบอท

ฝั่งเว็บออกแบบให้รองรับไว้แล้ว:

- บอทตอบไม่สำเร็จ / ติดต่อไม่ได้ → บันทึกเหตุผลลง note แล้วปล่อยรายการค้างในคิว
- บอทรายงานกลับว่าล้มเหลว → แจ้งเตือนเข้า Telegram แอดมินทันที
- **ไม่มีทางที่ออเดอร์หรือการอนุมัติสลิปจะล้มเพราะบอท**

## ความปลอดภัย

- `TV_BOT_SECRET` เป็นความลับ อยู่ใน env ทั้งสองฝั่ง
- callback เทียบ secret แบบ timing-safe และผูกผลกับสมาชิกผ่าน `tradingViewUsername`
- บริดจ์จะไม่ยอมสตาร์ทถ้าไม่ได้ตั้ง secret — endpoint ที่แจกสิทธิ์สคริปต์ห้ามเปิดโล่ง

## กับดักของหน้า Manage Access (บันทึกจากการไล่แก้จริง 28 ส.ค. 2569)

**ช่องวันหมดอายุถูก disable ตั้งแต่เปิด** เพราะเช็กบ็อกซ์ "ไม่มีวันหมดอายุ"
ติ๊กมาให้ก่อน โค้ดเดิมยิง `send_keys` ใส่เลยจึงได้ `element not interactable`
แล้วตกไปเพิ่มแบบไม่จำกัดวัน — **ต้องอันติ๊กก่อนเสมอ** ช่องถึงจะรับค่า

| อาการที่เจอ | สาเหตุจริง |
|---|---|
| กด Add access ให้คนที่มีสิทธิ์อยู่แล้ว → ไม่มีอะไรเปลี่ยน | TradingView ขึ้น "This user has already been granted access" แล้วปฏิเสธ ต้องลบออกก่อนแล้วเพิ่มใหม่ |
| คลิกช่อง "ยังไม่หมดอายุ" ในลิสต์ | ไม่เปิดหน้าต่างแก้ไข และยังทำให้ dialog เพี้ยน — อย่าใช้ทางนี้ |
| หาแท็บด้วย `[role=tab]` เฉย ๆ | ไปโดนแท็บ Ideas/Minds/Scripts ของหน้าโปรไฟล์ ต้องยึดจากแท็บ id `Add new users` แล้วเอาแท็บพี่น้อง |
| หาช่องวันที่ด้วยข้อความ label | ไปโดนช่องค้นหาที่ใช้คลาส `with-end-slot` เหมือนกัน ต้องยึด input ที่อยู่ติดเช็กบ็อกซ์เดียวในกล่องเดียวกัน |

**ห้ามไล่หาปุ่มที่เขียนว่า "Delete" ทั้งหน้าเด็ดขาด** — แถบเครื่องมือของหน้าสคริปต์
มีปุ่มลบที่ลบอินดิเคเตอร์ทั้งตัว ปุ่มลบสิทธิ์ที่ถูกต้องคือ
`//span[@data-name='manage-access-dialog-item-remove-button']` (หรือคลาส `removeButton`)
ซึ่งกดแล้วลบทันที ไม่มีหน้าต่างยืนยัน

บอทจะ log `EXPIRY_OK` / `EXPIRY_FAIL` พร้อมวันที่ที่อ่านกลับมาจากลิสต์จริง
ใช้ตรวจได้เลยว่ารอบนั้นสำเร็จไหม

> ⚠️ scheduled task `TradePulseTVBridge` เป็นแบบ **Interactive only** — ถ้าเครื่องไม่ได้
> ล็อกอินค้างไว้ `schtasks /run` จะตอบ SUCCESS แต่ process ไม่เกิด (Last Result 1)
> และ process ที่สั่งผ่าน SSH จะตายพร้อม session ต้องรีสตาร์ตตอนอยู่หน้าเครื่อง

## ทำไมบริดจ์เคยล้มแล้วไม่ฟื้น และ watchdog ที่ใส่เพิ่ม

`TradePulseTVBridge` ตั้งไว้เป็น **InteractiveToken + BootTrigger อย่างเดียว** ซึ่งขัดกันเอง —
ตอนบูตยังไม่มีใครล็อกอิน task แบบ interactive จึงรันไม่ได้ (`Last Result 1`)
และไม่มี trigger ตอน logon เลย พอบริดจ์ตายก็ไม่มีอะไรปลุก

เพิ่ม `TradePulseTVBridgeWatchdog` (ทุก 5 นาที, `/it` จึงไม่ต้องเก็บรหัสผ่าน) ทำหน้าที่
เช็กพอร์ต 8787 ถ้าไม่มีใครฟังก็สตาร์ตใหม่ สคริปต์อยู่ที่
`C:\Users\User\tv-bridge-watchdog.ps1` เขียน log ที่ `tv-bridge-watchdog.log`

**กับดักตอนเขียน watchdog:** `Start-Process "C:\tv-bridge-run.bat"` เงียบสนิทไม่ launch อะไรเลย
ต้องเรียก `python.exe -u tv_bridge.py` ตรง ๆ พร้อม `-WorkingDirectory` ถึงจะ bind พอร์ตได้จริง
และ process ที่สั่งผ่าน SSH เฉย ๆ จะตายพร้อม session — ต้องให้ scheduled task เป็นคนสตาร์ต

> ย้ายไป server-254 ในอนาคตได้ (เปิด 24 ชม.) แต่ตอนนี้เครื่องยังไม่เปิด และเข้าไม่ได้
> (Tailscale SSH ปิด, คีย์ไม่ผ่าน, อยู่คนละ LAN กับคอมเบส) ถ้าจะย้ายต้องเปิด `tailscale set --ssh`
> บนเครื่องนั้นก่อน แล้วก๊อปโปรไฟล์ Chrome `C:\tv-bot-chrome` ไปด้วยเพื่อพา session TradingView ไป

## ย้ายบริดจ์จากคอมเบสไป server-254 (28 ส.ค. 2569)

ย้ายเพราะคอมเบสปิดกลางคืน + task Interactive-only ไม่ฟื้นเอง — server-254 (Tailscale
100.89.239.2, user `pai09`) เปิด 24 ชม.

**ที่ตั้งใหม่:** `C:\BotTV` (tlapi.py = V17, tv_bridge.py, .env, requirements-bridge.txt)
Funnel: `https://node.tail17bed7.ts.net` → ตั้ง `TV_BOT_URL` บน Vercel ชี้มานี่แล้ว
callback ใน .env แก้เป็น `quantvisionx.com` แล้ว

**กับดักที่เจอตอนย้าย:**
- **เข้า server-254 ไม่ได้ตอนแรก** — Windows OpenSSH ไม่รองรับ `tailscale set --ssh`
  ต้องลง OpenSSH Server จาก MSI ทางการ (Windows Update โหลดไม่ได้ ขึ้น NotPresent)
  แล้ว pai09 เป็นแอดมิน → key ต้องอยู่ `C:\ProgramData\ssh\administrators_authorized_keys`
  (ไม่ใช่ user profile) สิทธิ์ไฟล์ต้องมีแค่ Administrators:F + SYSTEM:F
- **Tailscale IdeaPad→254 ตันตลอด** (relay ไม่ทะลุ) แต่ **254→คอมเบส ทะลุ** — pull ไฟล์
  จาก 254 ได้ (push จากคอมเบสไม่ได้)
- **โปรไฟล์ Chrome ก๊อปมาแล้ว login หาย** — `scp -r` ข้ามไฟล์ database ที่ล็อก โดยเฉพาะ
  `Default\Network\Cookies` (Chrome รุ่นใหม่ย้าย Cookies ไปโฟลเดอร์ Network) ต้องปิด Chrome
  แล้ว scp โฟลเดอร์ Network มาต่างหาก **แต่ cookie เข้ารหัสด้วย DPAPI ผูกเครื่องเดิม
  ก๊อปข้ามเครื่องใช้ไม่ได้** — ต้อง RDP เข้า 254 login TradingView (Pyro_Bolt) เองครั้งเดียว
- **Task Scheduler รัน python ไม่ขึ้น** — Start-Process ใน task context ถูกบล็อก, และรัน
  python foreground ทำให้ task ค้าง (Last Result 267009 = still running) เลิกใช้ task
  เปลี่ยนเป็น **runner.ps1 วนลูป while(true) เช็กพอร์ต 8787 ทุก 30 วิ** + shortcut ใน
  Startup folder (`TVRunner.lnk`) ให้เปิดตอน login — เสถียร ทดสอบ revive ผ่าน

**การพิมพ์ผ่าน RDP** ทำ single-quote กลายเป็น smart-quote บ่อย → คำสั่งค้าง/ไฟล์ชื่อเพี้ยน
เลี่ยงด้วยการสั่งจากคอมเบสผ่าน SSH หรือใช้คำสั่งสั้นไม่มี quote

**เทสผ่านครบวง:** grant DomeDev → EXPIRY_OK until 2026-09-27 บน 254

> คอมเบสยังเก็บไว้เป็นสำรอง (บริดจ์เดิม + watchdog ยังอยู่) ไม่ได้ลบ

## ย้ายมา "คอมเฟิร์ส" + ใช้ Cloudflare Tunnel (28 ส.ค. 2569 เย็น)

ตัวหลักตอนนี้ = **คอมเฟิร์ส** (Tailscale `desktop-8qjh30a` / 100.111.137.19, user `oneye`)
บอทอยู่ `C:\BotTV` · โปรไฟล์ Chrome `C:\tv-bot-chrome` · Python 3.12

**Tailscale Funnel ใช้กับเครื่องนี้ไม่ได้** — ตั้งถูกทุกอย่าง (`funnel status` = on,
`CertDomains` มีโดเมน, ยิงจากในเครื่องได้ 200, ยิงผ่าน Tailscale IP ได้ 200, ACL มี
`nodeAttrs` funnel ครบ) แต่จากภายนอกได้ 000 เสมอ แม้ reset funnel แล้ว
→ **เปลี่ยนไปใช้ Cloudflare Tunnel แทน ใช้ได้ทันทีในครั้งแรก**

```powershell
# โหลดครั้งเดียว
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "C:\BotTV\cloudflared.exe"
# เปิด tunnel (ได้ URL ฟรีแบบสุ่ม)
Start-Process "C:\BotTV\cloudflared.exe" -ArgumentList "tunnel","--url","http://127.0.0.1:8787" -RedirectStandardError "C:\BotTV\cf.log" -WindowStyle Hidden
Select-String -Path C:\BotTV\cf.log -Pattern "trycloudflare.com"
```

> ⚠️ **quick tunnel ได้ URL สุ่มใหม่ทุกครั้งที่รีสตาร์ต** — ถ้ารีบูตต้องเอา URL ใหม่ไปตั้ง
> `TV_BOT_URL` บน Vercel อีกที ถ้าจะให้ถาวรต้องทำ named tunnel (ต้องมีโดเมนใน Cloudflare)

**cookie TradingView ย้ายข้ามเครื่องไม่ได้** (DPAPI ผูก user+เครื่อง) ทุกครั้งที่ย้าย
ต้องเปิด Chrome ด้วยโปรไฟล์บอทแล้ว login Pyro_Bolt ใหม่:
`chrome.exe --user-data-dir="C:/tv-bot-chrome" --profile-directory=Default`

**เทสผ่าน:** grant DomeDev → `EXPIRY_OK ... DATED:Sep 27, 2026`

## botkeeper — แก้ปัญหา URL ของ quick tunnel เปลี่ยนทุกครั้ง

`scripts/bot/botkeeper.ps1` (สำเนาใช้งานอยู่ที่ `C:\BotTV\botkeeper.ps1` บนคอมเฟิร์ส)
วนลูปทุก 60 วินาที ทำ 3 อย่าง:

1. บริดจ์ตาย → เปิดใหม่
2. cloudflared ตาย → เปิดใหม่
3. **URL เปลี่ยน → PATCH `TV_BOT_URL` บน Vercel + สั่ง redeploy ให้เอง**

ข้อ 3 คือหัวใจ — Cloudflare quick tunnel สุ่ม URL ใหม่ทุกครั้งที่รีสตาร์ต ถ้าไม่อัปเดตเอง
เว็บจะเรียกบอทไม่เจอหลังรีบูต ตัวนี้ทำให้ไม่ต้องแก้มืออีก (ทางเลือกแทน named tunnel
ที่ต้องย้าย DNS ของ quantvisionx.com ไป Cloudflare ซึ่งเสี่ยงกับเว็บที่ใช้งานจริงอยู่)

ต้องมีไฟล์ `C:\BotTV\vercel_token.txt` (Vercel API token, ไม่ commit) — สคริปต์อ่านจากไฟล์
ไม่ฝัง token ไว้ในโค้ด · log อยู่ที่ `C:\BotTV\keeper.log`
เปิดเองตอน login ผ่าน Startup shortcut `BotKeeper.lnk`

**ทดสอบผ่าน:** URL เปลี่ยน → `vercel env updated` + `redeploy triggered` → health `primaryUp:true`

## บั๊กที่ทำให้ "ต่ออายุ" ไม่เคยได้ผล (แก้ใน V18)

โค้ดตรวจผลด้วย `_seen.startswith("DATED")` เฉย ๆ — แค่ถามว่า "มีวันที่ไหม"
คนที่มีสิทธิ์อยู่แล้วย่อมมีวันเดิมติดอยู่ ระบบจึงตัดสินว่าสำเร็จทันที **ไม่เข้าทาง
ลบ-แล้วเพิ่มใหม่เลย** ผลคือต่ออายุกี่ครั้งวันก็ไม่เปลี่ยน แต่ log ขึ้น EXPIRY_OK

หลักฐานตอนจับได้:
```
EXPIRY_OK DomeDev 2026-10-12 DATED:Sep 27, 2026   <- คนละวันแต่บอก OK
```

แก้โดยเพิ่ม `_iso()` แปลงวันที่ที่หน้าเว็บโชว์ (`Sep 27, 2026`) เป็น ISO แล้ว
**เทียบกับวันที่สั่งจริง** ถึงจะถือว่าผ่าน:
```
tv verify: DATED:Sep 27, 2026 | iso: 2026-09-27 | want: 2026-10-12
tv del: clicked / tv after del gone: True / tv re-add: True
tv verify: DATED:Oct 12, 2026 | iso: 2026-10-12 | want: 2026-10-12
EXPIRY_OK DomeDev 2026-10-12 DATED:Oct 12, 2026
```

> บทเรียน: การตรวจผลต้องเทียบกับ "สิ่งที่สั่ง" ไม่ใช่แค่ "มีค่าอยู่"
> ไม่งั้นระบบจะรายงานว่าสำเร็จทั้งที่ไม่ได้ทำอะไรเลย

**ดู log ของบอทต้อง redirect ทั้ง stdout และ stderr** — `print()` ไป stdout,
logging ของ aiohttp ไป stderr ถ้าเก็บแค่ stderr จะไม่เห็นบรรทัด `tv expiry ...` เลย

## ให้ botkeeper เปิดเองตอน login — ใช้ Registry Run key

บนคอมเฟิร์ส `schtasks /create` โดน **Access denied** ทั้งแบบมีและไม่มี `/rl highest`
และ Startup shortcut ก็ไม่ยอมสตาร์ตจริง วิธีที่ใช้ได้คือ Registry Run key ของ user เอง
(ไม่ต้องสิทธิ์ Admin):

```powershell
Set-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "BotKeeper" `
  -Value 'powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\BotTV\botkeeper.ps1'
```

**กับดักที่เสียเวลาไปมาก:** `Start-Process ... -RedirectStandardOutput` ของ PowerShell
จองไฟล์แบบ exclusive ถ้า process เดิมยังถือ handle อยู่จะ throw แล้ว **ลูปค้างทั้งตัว**
ผลคือ watchdog ตายเงียบ ๆ ทั้งที่ `Get-Process` ยังเห็น powershell อยู่ (ดูเหมือนทำงาน
แต่ log ไม่ขยับเลย) แก้โดยให้ `cmd /c ... >> file 2>> file` เป็นคน redirect แทน
และครอบ try แยกแต่ละงาน + เขียน `alive` ทุก 30 นาทีเพื่อให้รู้ว่ายังไม่ตาย

เช็กสุขภาพเร็ว ๆ: `Get-Content C:\BotTV\keeper.log -Tail 5` — ถ้าเงียบเกิน 30 นาที = ตายแล้ว

## ภาพหลักฐานสิทธิ์ที่ส่งให้ลูกค้า (31 ส.ค. 2569)

ลูกค้าอยากเห็นหลักฐานว่าได้สิทธิ์จริง ไม่ใช่แค่ข้อความบอกว่าสำเร็จ
ภาพที่ใช้คือกล่อง **Manage access** ที่โชว์ username กับวันหมดอายุของเขาเอง

**ฝั่งเว็บทำเสร็จแล้ว** — `/api/tradingview/callback` รับ `proof` และส่งเข้า DM ให้

**ฝั่งบอทยังต้องแก้** (อยู่บนคอมเฟิร์ส `C:\BotTV` ไม่ได้อยู่ใน repo นี้):

1. ก๊อป `tvshot.py` ขึ้นเครื่องบอทไว้ข้าง ๆ `tlapi.py`
2. ใน `add_indicator_access` ตรงหลังบรรทัดที่พิมพ์ `EXPIRY_OK` เรียก
   `capture_access_proof_b64(driver, username)` แล้วส่งค่าที่ได้ต่อให้ `tv_bridge.py`
3. `tv_bridge.py` ใส่ค่านั้นลงใน field `proof` ของ callback

`renew_indicator_access` มีโค้ดแคปอยู่ก่อนแล้ว (ส่งเข้า Telegram ของคนที่สั่ง `/re`)
แต่ใช้ซ้ำไม่ได้ตรง ๆ เพราะสองเรื่อง:

- หากล่องด้วย `//div[contains(@class,'dialog-')]` — TradingView ใช้ CSS module
  ชื่อ hash (ตรวจของจริง 31 ส.ค. 2569: `menuWrap-lBIxIwtz`, `button-XNUivTou`)
  XPath นั้นแมตช์หลายกล่อง `find_element` คืนตัวแรกใน DOM ซึ่งอาจเป็นกล่องที่ซ่อนอยู่
  → ได้ภาพเปล่า `tvshot.py` ยึด `div[role='dialog']` ที่มองเห็นจริงแทน
- **แคปทั้งรายการ = ลูกค้าเห็น username กับวันหมดอายุของลูกค้าคนอื่นทั้งหมด**
  `tvshot.py` พิมพ์ชื่อลงช่องค้นหาให้เหลือแถวเดียวก่อนแคป และถ้ากรองไม่สำเร็จ
  จะ **ไม่แคปเลย** ดีกว่าปล่อยภาพที่มีข้อมูลคนอื่นหลุดออกไป
