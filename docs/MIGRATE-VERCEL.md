# ย้าย Vercel มาบัญชีเบส (ทางฟรี)

โปรเจกต์อยู่บนทีม Vercel ของโดม การ transfer ตรง ๆ ทำไม่ได้เพราะ Vercel บังคับว่า
ต้นทางต้องเป็นสมาชิกของทีมปลายทาง ซึ่งบัญชี Hobby มีสมาชิกได้คนเดียว (ต้องจ่าย Pro)
ทางฟรีคือ **สร้างโปรเจกต์ใหม่บนบัญชีเบส แล้วกรอก env ใหม่ทั้งหมด**

## ลำดับที่ต้องทำ — ห้ามสลับ

1. เก็บ env ให้ครบ 43 ตัวก่อน (ตารางข้างล่าง) **ยังไม่ต้องแตะอะไรบนเว็บ**
2. เบสสมัคร Vercel แล้ว import repo `domexxzz/tradepulse` เป็นโปรเจกต์ใหม่
3. ใส่ env ครบ แล้ว deploy — ยังไม่ผูกโดเมน
4. ทดสอบบน URL `*.vercel.app` ของโปรเจกต์ใหม่ให้ผ่านก่อน
   (สมัคร/ล็อกอิน, จ่ายเงิน, รับสัญญาณ Telegram, webhook TradingView)
5. ถึงค่อยย้ายโดเมน — ลบ `quantvisionx.com` จากโปรเจกต์เก่า แล้วเพิ่มในโปรเจกต์ใหม่
   **ไม่ต้องแก้ DNS ที่ GoDaddy** เพราะ `A 76.76.21.21` กับ `CNAME cname.vercel-dns.com`
   เป็นค่าเดียวกันทุกบัญชี Vercel เว็บดับแค่ช่วงสลับไม่กี่นาที
6. เก็บโปรเจกต์เก่าไว้ก่อน อย่าเพิ่งลบ เผื่อต้องถอยกลับ

## ถือโอกาสเปลี่ยนรหัสที่หลุดไปด้วย

ระหว่างนี้ต้องกรอกใหม่อยู่แล้ว ให้เปลี่ยนตัวที่หลุดในแชทไปพร้อมกัน จะได้ดับรอบเดียว

- รหัสฐานข้อมูล Neon
- token บอท `@TD_SMC_bot`
- token บอท `@BMTradingViewIndicator_Bot`
- token Vercel ตัวที่ใช้ deploy

## สถานะ env — 43 ตัว

### ✅ ได้แล้ว 14 ตัว (ผมเก็บไว้ให้แล้ว)

| คีย์ | ได้มาจาก |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | `C:\QVXBackup\backup.env` บนคอมเฟิร์ส — ทดสอบต่อติดแล้ว 23 ตาราง |
| `TV_BOT_SECRET` | `C:\BotTV\.env` บนคอมเฟิร์ส |
| `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL` | `https://quantvisionx.com` |
| `BROKER_MAIL_SECRET`, `MARKET_WEBHOOK_TOKEN` | อ่านกลับจาก Vercel ได้ (ชนิด encrypted) |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_ROLE_MEMBER`, `NEXT_PUBLIC_DISCORD_INVITE_URL` | เหมือนกัน |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` | เหมือนกัน (ชี้ไป Groq) |

### 🔧 ผมสร้างใหม่ให้ได้ 5 ตัว — แต่ต้องไปแก้ปลายทางด้วย

| คีย์ | ผลถ้าเปลี่ยน |
|---|---|
| `NEXTAUTH_SECRET` | สมาชิกทุกคนหลุด login ต้องเข้าใหม่ ไม่มีผลอื่น |
| `CRON_SECRET` | ไม่มีผล Vercel ใช้ภายใน |
| `TELEGRAM_WEBHOOK_SECRET` | ต้องตั้ง webhook Telegram ใหม่ ผมทำให้ได้ |
| `TELEGRAM_SIGNAL_SECRET` | **ต้องแก้ฝั่งที่ยิงสัญญาณเข้ามาให้ตรงกัน** |
| `TRADINGVIEW_WEBHOOK_SECRET` | **ต้องแก้ alert ใน TradingView ของน็อตให้ตรงกัน** ไม่งั้นสัญญาณขาด |

### 📋 เบสต้องไปเอามา 24 ตัว

**Stripe** — dashboard.stripe.com → Developers → API keys
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET` (ต้องสร้าง endpoint ใหม่ชี้มาที่โปรเจกต์ใหม่)

**Omise** — dashboard.omise.co → Keys
- `OMISE_PUBLIC_KEY`
- `OMISE_SECRET_KEY`

**Resend** — resend.com → API Keys
- `RESEND_API_KEY`
- `EMAIL_FROM` (ต้องเป็นโดเมนที่ verify ไว้ใน Resend แล้ว)

**Telegram** — BotFather
- `TELEGRAM_BOT_TOKEN` ของ `@TD_SMC_bot` (เปลี่ยนใหม่เลย เพราะตัวเดิมหลุด)
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_CHAT_ID`, `TELEGRAM_ADMIN_CHAT_ID`
- `TELEGRAM_TOPIC_M5`, `TELEGRAM_TOPIC_M15`, `TELEGRAM_TOPIC_M30`, `TELEGRAM_TOPIC_1H`

  6 ตัวหลังผมดึงให้ได้เองด้วย `npm run telegram:ids` ขอแค่ token

**Google / LINE login** — ตอนนี้พังอยู่แล้ว (ค่าว่าง) ถือโอกาสตั้งใหม่
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google Cloud Console
- `LINE_CLIENT_ID`, `LINE_CLIENT_SECRET` — LINE Developers
- `NEXT_PUBLIC_LINE_OA_URL` — ลิงก์ LINE OA

**เบสรู้เอง**
- `PROMPTPAY_ID` — เลขพร้อมเพย์ที่ใช้รับเงิน
- `ADMIN_EMAILS` — อีเมลแอดมิน (ของเดิมในเครื่องเป็น `admin@uat.test` ซึ่งเป็นค่าทดสอบ)

**URL บอท** — ผมหาให้ได้จากคอมเบส/คอมเฟิร์ส แต่คอมเบสปิดอยู่
- `TV_BOT_URL`, `TV_BOT_URL_BACKUP`

## เรื่องที่ยังค้างและกระทบงานนี้

- **คอมเบสปิดอยู่** — `TV_BOT_URL` กับการยืนยันว่า `TV_BOT_SECRET` ตรงกัน ต้องเปิดเครื่องก่อน
- **Hobby ห้ามใช้เชิงพาณิชย์** — ย้ายไปบัญชีเบสแล้วก็ยังผิดเงื่อนไขเหมือนเดิม
  Vercel ระงับได้โดยไม่เตือน เรื่องนี้ไม่ได้แก้ด้วยการย้าย
