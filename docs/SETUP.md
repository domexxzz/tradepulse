# คู่มือเริ่มต้น (Setup)

## รันในเครื่อง

```bash
npm install
npm run setup     # หา Postgres → เขียน .env.local → สร้างตาราง → ใส่ข้อมูลตั้งต้น
npm run dev       # http://localhost:3000
```

`npm run setup` รันซ้ำได้ ไม่ทับ `.env.local` ที่มีอยู่แล้ว
ถ้ายังไม่มี Postgres มันจะบอกคำสั่งติดตั้งให้ตามระบบปฏิบัติการ

โปรเจกต์ใช้ PostgreSQL ทั้ง dev และ production เพื่อให้พฤติกรรมตรงกัน
(SQLite ต่างเรื่อง type, transaction และ constraint มากพอที่จะทำให้เจอบั๊กตอนขึ้น production เท่านั้น)

<details>
<summary>ติดตั้ง Postgres เอง</summary>

```bash
# macOS
brew install postgresql@16 && brew services start postgresql@16   # ถ้ายังไม่มี

# Docker (ได้ทุกระบบ)
docker run -d --name qvx-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=qvx_dev postgres:16-alpine
```

Windows: ติดตั้งจาก https://www.postgresql.org/download/windows/
</details>

## เข้าหน้าจัดการระบบ

มีสองทาง เลือกทางไหนก็ได้

**ทางที่ 1 — ตั้ง `ADMIN_EMAILS`** เหมาะกับ production

ใส่อีเมล (คั่นด้วยจุลภาคถ้ามีหลายคน) เป็น environment variable แล้วสมัครสมาชิกด้วยอีเมลนั้น
ตอนล็อกอิน `src/lib/admin-bootstrap.ts` จะเลื่อนขั้นให้เป็น ADMIN อัตโนมัติ
เลื่อนขั้นอย่างเดียว ไม่ลดขั้น — เอาอีเมลออกจากลิสต์แล้วสิทธิ์ยังอยู่

**ทางที่ 2 — `npm run admin`** เหมาะตอนลืมรหัสผ่าน

```bash
npm run admin
```

ถามอีเมลกับรหัสผ่านแล้วสร้าง/อัปเดตบัญชีให้เป็น ADMIN ทันที
รหัสผ่านพิมพ์ตอนรัน ไม่โชว์บนจอ ไม่รับผ่าน argument (จะไปติดใน shell history)
และไม่ถูกเขียนลง log ที่ไหน — เก็บเป็น bcrypt hash อย่างเดียว

จะชี้ไปฐานข้อมูลไหนก็ได้ มันโชว์ host กับชื่อฐานข้อมูลให้ยืนยันก่อนเขียนเสมอ

```bash
DATABASE_URL="postgresql://…" npm run admin     # เช่น ชี้ไป production
```

> จำเป็นเพราะปุ่ม "ลืมรหัสผ่าน?" บนหน้าเว็บใช้ไม่ได้ถ้ายังไม่ได้ตั้ง `RESEND_API_KEY`
> ถ้าไม่มีเครื่องมือนี้ ลืมรหัสแล้วเข้าหลังบ้านไม่ได้เลย

## ฐานข้อมูลควรอยู่ที่ไหน

| ใช้ตอนไหน | อยู่ที่ไหน | ทำไม |
|---|---|---|
| พัฒนาในเครื่อง | Postgres ในเครื่องตัวเอง | เร็ว ทำงานตอนเน็ตหลุดได้ พังก็ลบทิ้งสร้างใหม่ได้ และ `uat/guard.ts` บังคับให้ UAT รันได้เฉพาะ localhost อยู่แล้ว |
| Vercel preview (ทุก PR) | Neon branch | ต่อ Neon–Vercel integration แล้วมันสร้าง branch ของฐานข้อมูลให้ทุก PR อัตโนมัติ ลบให้เองตอน merge — ได้ทดสอบ migration กับข้อมูลทรงเดียวกับ production ก่อน merge จริง |
| production | Neon | ตัวหลัก `vercel-build` รัน `prisma migrate deploy` ให้ทุกครั้งที่ deploy |

**อย่าเอาฐานข้อมูล dev ไปไว้บนเครื่องที่เข้าถึงได้ผ่าน VPN/Tailscale เท่านั้น**
Vercel อยู่บนคลาวด์ ต่อ tailnet ไม่ได้ → `prisma migrate deploy` ตอน build จะล้ม
แปลว่า preview deployment ของทุก PR จะพัง ตรวจงานกันไม่ได้

## ตรวจงานอัตโนมัติ (CI)

`.github/workflows/ci.yml` รันทุก PR และทุก push เข้า main:
ยก Postgres ขึ้นมาในงาน → `migrate deploy` → `npm test` → `npm run test:uat` → `next build` → `lint`

ชื่อฐานข้อมูลใน CI ตั้งเป็น `qvx_test` โดยตั้งใจ เพราะ `uat/guard.ts` ยอมให้รัน
เฉพาะฐานข้อมูลที่อยู่ localhost หรือชื่อมีคำว่า `uat`/`test` เท่านั้น

## คู่มือแยกตามระบบ

| ระบบ | เอกสาร |
|---|---|
| วงจรชีวิตสมาชิก + cron ปิดสิทธิ์ | [LIFECYCLE.md](./LIFECYCLE.md) |
| อีเมล (ใบเสร็จ / เตือนหมดอายุ / ลืมรหัสผ่าน) | [EMAIL.md](./EMAIL.md) |
| สลิป PromptPay + ตรวจสลิปอัตโนมัติ | [SLIP.md](./SLIP.md) |
| ให้สิทธิ์ TradingView อัตโนมัติ | [TRADINGVIEW.md](./TRADINGVIEW.md) |
| สัญญาณเข้ากลุ่ม Telegram | [TELEGRAM.md](./TELEGRAM.md) |
| ยศ Discord ตามแพ็กเกจ | [DISCORD.md](./DISCORD.md) |
| แดชบอร์ดแอดมิน | [ADMIN.md](./ADMIN.md) |
| Stripe (ทางเลือกแทน QR) | [PAYMENTS.md](./PAYMENTS.md) |

## แก้เนื้อหา/แบรนด์ (แก้ที่เดียว เปลี่ยนทั้งเว็บ)
- `src/config/site.ts` — ชื่อแบรนด์, LINE OA, สถิติ, เมนู
- `src/config/plans.ts` — แพ็คเกจ + ราคา
- `src/config/features.ts` — ฟีเจอร์ 25+, ระบบหลัก, รีวิว, FAQ
- `src/app/globals.css` — สีธีม (--brand เขียวไลม์, --background, .theme-light)
- `public/images/` — โลโก้/ภาพประกอบ

## ระบบสมาชิก
- Auth.js v5 (credentials + Google/LINE ถ้ามีคีย์) — `src/auth.ts`, `src/auth.config.ts`
- DB: Prisma + PostgreSQL — `prisma/schema.prisma`
- หน้า: `/register`, `/login`, `/account/*`
- ป้องกันเส้นทาง `/account`, `/admin` ผ่าน `src/proxy.ts`

## ระบบชำระเงิน

ค่าเริ่มต้นคือ **PromptPay QR + แนบสลิป** (`NEXT_PUBLIC_PAYMENT_MODE=qr`) ไม่มีค่าธรรมเนียม
ตั้ง `PROMPTPAY_ID` แล้วใช้ได้เลย — รายละเอียดการกันสลิปซ้ำและตรวจสลิปอัตโนมัติดู [SLIP.md](./SLIP.md)

### ทางเลือก: Stripe (ตัดเงินอัตโนมัติ)
เปิดใช้งานโดยใส่คีย์ใน `.env`:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_MONTH=price_...   # สร้าง Price (recurring) ใน Stripe แล้วเอา id มาใส่
STRIPE_PRICE_Q3=price_...
STRIPE_PRICE_H6=price_...
STRIPE_PRICE_YEAR=price_...
```
- ปุ่ม "สมัครสมาชิก" -> `/api/checkout` -> Stripe Checkout (subscription)
- Webhook: ตั้ง endpoint `/api/webhooks/stripe` (event: checkout.session.completed, customer.subscription.*)
  - ทดสอบ local: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- จัดการ/ยกเลิก: ปุ่มในหน้า `/account/subscription` -> Stripe Billing Portal
- ถ้ายังไม่ใส่คีย์ ปุ่มจะแจ้ง "ยังไม่ได้ตั้งค่าระบบชำระเงิน" อย่างนุ่มนวล

## Deploy ขึ้น Production

1. สร้างฐานข้อมูล Postgres (Neon / Supabase / Vercel Postgres)
2. ตั้ง env บน Vercel:
   - `DATABASE_URL` — connection string แบบ **pooled** (มักมี `-pooler` หรือ `?pgbouncer=true`)
     serverless เปิด connection เยอะ ถ้าต่อตรงจะชน connection limit
   - `DIRECT_URL` — connection string แบบ **ต่อตรง** ใช้ตอน migrate เท่านั้น
     (pooler ไม่รองรับคำสั่ง DDL บางตัว) ถ้าผู้ให้บริการไม่มี pooler แยก ใส่ค่าเดียวกันได้
3. migration รันเองตอน deploy แล้ว — สคริปต์ `vercel-build` ทำ
   `prisma generate && prisma migrate deploy && next build` ให้อัตโนมัติ
   (ถ้า migrate ล้ม build จะล้มด้วย ตั้งใจให้รู้ตัวทันทีดีกว่าปล่อยขึ้นไปพัง)
4. รัน seed ครั้งแรก: `npm run db:seed` (ต้องมี DATABASE_URL ของ production ใน shell)
5. ตั้ง `ADMIN_EMAILS` แล้วสมัครสมาชิกด้วยอีเมลนั้น จากนั้นรัน seed ซ้ำเพื่อเลื่อนเป็น ADMIN
6. **ตั้ง `CRON_SECRET`** — ถ้าไม่ตั้ง งานประจำวันจะไม่ทำงาน และสมาชิกจะไม่มีวันหมดอายุ
   (ดู [LIFECYCLE.md](./LIFECYCLE.md))
7. ตั้ง `RESEND_API_KEY` + `EMAIL_FROM` ถ้าต้องการให้ระบบส่งใบเสร็จและให้สมาชิกรีเซ็ตรหัสผ่านเองได้

> ⚠️ ถ้าเปิดใช้ Preview Deployment ของ Vercel ให้ตั้ง `DATABASE_URL` ของ preview
> ไปที่ฐานข้อมูลคนละตัว (Neon สร้าง branch ได้) ไม่งั้น preview จะ migrate ทับ production

> ให้ build บน Vercel รัน `prisma generate` อัตโนมัติแล้ว (postinstall)
> ถ้าเจอ error เรื่อง Prisma Client ตอน build ให้เช็กว่า `DIRECT_URL` ตั้งครบ

### เทสต์

```bash
npm test          # ตรรกะล้วน ไม่ต้องมีฐานข้อมูล (25 เคส)
npm run test:uat  # ชนฐานข้อมูลจริง — ต้องชี้ DATABASE_URL ไปฐานข้อมูลทดสอบเท่านั้น (8 เคส)
npm run test:watch
```

`test:uat` เรียกฟังก์ชันเดียวกับที่เว็บใช้จริง (`activateMembership`, `runMembershipMaintenance`)
ไม่ใช่ของจำลอง จึงจับได้ถ้าตรรกะเงินหรือวันหมดอายุเพี้ยน
มันลบผู้ใช้ที่อีเมลมีคำว่า `uat-run` ทิ้งทั้งก่อนและหลังรัน — **ห้ามชี้ไป production**

`uat/guard.ts` บังคับข้อนี้ด้วยโค้ด ไม่ใช่แค่คำเตือน: ถ้า `DATABASE_URL` ไม่ได้ชี้ไป
localhost หรือฐานข้อมูลที่ชื่อมี `uat`/`test` ชุดเทสต์จะหยุดทันทีก่อนแตะข้อมูล
(จำเป็นเพราะ `runMembershipMaintenance()` ทำงานกับทุกแถว ไม่ได้จำกัดเฉพาะข้อมูลทดสอบ)

ถ้ายังไม่มีฐานข้อมูลสำหรับ UAT ให้รัน `npm run setup` หรือสร้างเอง:

```bash
brew install postgresql@16 && brew services start postgresql@16   # ถ้ายังไม่มี
createdb qvx_uat
```

ครอบตรรกะที่พลาดแล้วเสียเงินจริง: การคิดวันหมดอายุ (`addMonths` สิ้นเดือน/ปีอธิกสุรทิน),
การตัดสินว่าแพ็กเกจยังใช้ได้ไหม (`isSubscriptionActive`) และการตรวจไฟล์สลิป (`parseSlipDataUrl`)

### ที่ควรทำต่อ
- แปลง field `status` / `role` / `interval` (String) เป็น enum ของ Postgres
- ย้ายรูปสลิปออกจากฐานข้อมูลไป object storage เมื่อออเดอร์เริ่มเยอะ (ดู [SLIP.md](./SLIP.md))
- i18n ภาษาอังกฤษ

## สถานะเฟส
- [x] เฟส 0 — Setup (Next.js 16 + Tailwind v4)
- [x] เฟส 1 — Landing page (ทุก section + TradingView live + ธีมดำ-เขียว + พื้นขาวสลับดำ)
- [x] เฟส 2 — Auth + Member portal (register/login/account + TradingView + protected routes)
- [x] เฟส 3 — Payment (PromptPay QR + สลิป เป็นค่าเริ่มต้น, Stripe พร้อมใช้เมื่อใส่คีย์)
- [x] เฟส 4 — Admin dashboard (ออเดอร์ / คิวสิทธิ์ / สมาชิก / รีวิว / แพ็คเกจ)
- [x] เฟส 5 — วงจรชีวิตสมาชิก + อีเมล + SEO + deploy
- [ ] เฟส 6 — i18n, เทสต์อัตโนมัติ, ย้ายรูปสลิปไป object storage
