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

### ค่าที่ติดตั้งจริงไว้แล้วบนคอมเบส (26 ส.ค. 2569)

| อะไร | ค่า |
|---|---|
| บัญชีเจ้าของสคริปต์ | `Pyro_Bolt` |
| สคริปต์ที่ขาย | `Test 2 — SMC Unified Suite [Pyro_Bolt]` (invite-only) |
| โปรไฟล์ Chrome ของบอท | `C:\tv-bot-chrome` (ล็อกอิน TradingView ไว้แล้ว) |
| scheduled task | `TradePulseTVBridge` (ขึ้นเองตอน login) |
| log | `%LOCALAPPDATA%\Temp\tv_bridge.log` |
| URL สาธารณะ | `https://asus.tail17bed7.ts.net` (Tailscale Funnel) |

รีสตาร์ทบริดจ์: ต้องฆ่าโปรเซสที่ถือพอร์ต 8787 ก่อน แล้วค่อย `schtasks /end` + `/run`
(`/end` อย่างเดียวฆ่าแค่ cmd.exe — ตัว python ยังถือพอร์ตอยู่ ตัวใหม่เลย bind ไม่ได้แล้วตายเงียบ)

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
3. **บอทยังไม่ได้ตั้งเป็น scheduled task** — ตอนนี้มีแต่งานของ Sentiara
   ถ้าจะให้บริดจ์ขึ้นเองหลังเครื่องบูต ต้องเพิ่ม task ใหม่

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

เครื่องที่รันบอทต้องเปิดตลอด และถ้าไม่มี public IP ให้ใช้ tunnel:

```bash
cloudflared tunnel --url http://localhost:8787
```

## ระบบเรียกบอทตอนไหน

| จังหวะ | เกิดอะไร |
|---|---|
| อนุมัติสลิป / จ่ายผ่าน Stripe สำเร็จ | `/grant` ถ้าสมาชิกกรอก username ไว้แล้ว |
| สมาชิกกรอก username ทีหลัง | `/grant` ทันทีถ้ามีแพ็กเกจใช้งานอยู่ |
| cron ปิดสิทธิ์เมื่อหมดอายุ | `/revoke` |
| แอดมินกดปิดสิทธิ์ทันที | `/revoke` |

## เมื่อบอทพัง

บอทจับปุ่มบนหน้า TradingView จาก class name (เช่น `button-qm7Rg5MB`)
ซึ่ง TradingView เปลี่ยนเมื่อไหร่ก็ได้ — วันที่พังต้องไปแก้ selector ในฝั่งบอท

ฝั่งเว็บออกแบบให้รองรับไว้แล้ว:

- บอทตอบไม่สำเร็จ / ติดต่อไม่ได้ → บันทึกเหตุผลลง note แล้วปล่อยรายการค้างในคิว
- บอทรายงานกลับว่าล้มเหลว → แจ้งเตือนเข้า Telegram แอดมินทันที
- **ไม่มีทางที่ออเดอร์หรือการอนุมัติสลิปจะล้มเพราะบอท**

## ความปลอดภัย

- `TV_BOT_SECRET` เป็นความลับ อยู่ใน env ทั้งสองฝั่ง
- callback เทียบ secret แบบ timing-safe และผูกผลกับสมาชิกผ่าน `tradingViewUsername`
- บริดจ์จะไม่ยอมสตาร์ทถ้าไม่ได้ตั้ง secret — endpoint ที่แจกสิทธิ์สคริปต์ห้ามเปิดโล่ง
