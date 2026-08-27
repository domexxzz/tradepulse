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
{"secret":"...", "action":"grant", "username":"someone", "ok":true, "error":null}
```

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
