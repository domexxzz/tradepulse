# คู่มือเริ่มต้น (Setup)

## รันในเครื่อง

โปรเจกต์ใช้ PostgreSQL ทั้ง dev และ production เพื่อให้พฤติกรรมตรงกัน
(SQLite ต่างเรื่อง type, transaction และ constraint มากพอที่จะทำให้เจอบั๊กตอนขึ้น production เท่านั้น)

```bash
# 1) รัน Postgres สำหรับ dev
docker run -d --name tradepulse-pg   -e POSTGRES_PASSWORD=devpass -e POSTGRES_USER=tradepulse -e POSTGRES_DB=tradepulse   -p 5433:5432 postgres:16-alpine

# 2) ตั้งค่าใน .env (ทั้งสองค่าใช้ตัวเดียวกันได้ใน dev)
#    DATABASE_URL="postgresql://tradepulse:devpass@localhost:5433/tradepulse?schema=public"
#    DIRECT_URL="postgresql://tradepulse:devpass@localhost:5433/tradepulse?schema=public"

npm install
npx prisma migrate dev   # สร้างตาราง
node prisma/seed.mjs     # ใส่ plan + review ตัวอย่าง
npm run dev              # http://localhost:3000
```

หยุด/ลบฐานข้อมูล dev: `docker stop tradepulse-pg` / `docker rm -f tradepulse-pg`

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

### ที่ควรทำต่อ
- แปลง field `status` / `role` / `interval` (String) เป็น enum ของ Postgres
- ย้ายรูปสลิปออกจากฐานข้อมูลไป object storage เมื่อออเดอร์เริ่มเยอะ (ดู [SLIP.md](./SLIP.md))
- เทสต์อัตโนมัติสำหรับตรรกะวันหมดอายุ/การต่ออายุ
- i18n ภาษาอังกฤษ

## สถานะเฟส
- [x] เฟส 0 — Setup (Next.js 16 + Tailwind v4)
- [x] เฟส 1 — Landing page (ทุก section + TradingView live + ธีมดำ-เขียว + พื้นขาวสลับดำ)
- [x] เฟส 2 — Auth + Member portal (register/login/account + TradingView + protected routes)
- [x] เฟส 3 — Payment (PromptPay QR + สลิป เป็นค่าเริ่มต้น, Stripe พร้อมใช้เมื่อใส่คีย์)
- [x] เฟส 4 — Admin dashboard (ออเดอร์ / คิวสิทธิ์ / สมาชิก / รีวิว / แพ็คเกจ)
- [x] เฟส 5 — วงจรชีวิตสมาชิก + อีเมล + SEO + deploy
- [ ] เฟส 6 — i18n, เทสต์อัตโนมัติ, ย้ายรูปสลิปไป object storage
