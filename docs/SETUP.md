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

## แก้เนื้อหา/แบรนด์ (แก้ที่เดียว เปลี่ยนทั้งเว็บ)
- `src/config/site.ts` — ชื่อแบรนด์, LINE OA, สถิติ, เมนู
- `src/config/plans.ts` — แพ็คเกจ + ราคา
- `src/config/features.ts` — ฟีเจอร์ 25+, ระบบหลัก, รีวิว, FAQ
- `src/app/globals.css` — สีธีม (--brand เขียวไลม์, --background, .theme-light)
- `public/images/` — โลโก้/ภาพประกอบ

## ระบบสมาชิก (เฟส 2)
- Auth.js v5 (credentials + Google/LINE ถ้ามีคีย์) — `src/auth.ts`, `src/auth.config.ts`
- DB: Prisma + PostgreSQL — `prisma/schema.prisma`
- หน้า: `/register`, `/login`, `/account/*`
- ป้องกันเส้นทาง `/account`, `/admin` ผ่าน `src/proxy.ts`

## ระบบชำระเงิน (เฟส 3 — Stripe)
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
3. รัน migration: `npx prisma migrate deploy`
4. รัน seed ครั้งแรก: `node prisma/seed.mjs`
5. ตั้ง `ADMIN_EMAILS` แล้วสมัครสมาชิกด้วยอีเมลนั้น จากนั้นรัน seed ซ้ำเพื่อเลื่อนเป็น ADMIN

> ให้ build บน Vercel รัน `prisma generate` อัตโนมัติแล้ว (postinstall)
> ถ้าเจอ error เรื่อง Prisma Client ตอน build ให้เช็กว่า `DIRECT_URL` ตั้งครบ

### ที่ควรทำต่อ
- แปลง field `status` / `role` / `interval` (String) เป็น enum ของ Postgres

## สถานะเฟส
- [x] เฟส 0 — Setup (Next.js 16 + Tailwind v4)
- [x] เฟส 1 — Landing page (ทุก section + TradingView live + ธีมดำ-เขียว + พื้นขาวสลับดำ)
- [x] เฟส 2 — Auth + Member portal (register/login/account + TradingView + protected routes)
- [x] เฟส 3 — Payment (Stripe checkout + webhook + billing portal) *ต้องใส่คีย์เพื่อใช้งานจริง*
- [x] เฟส 4 — Admin dashboard (คิวอนุมัติสิทธิ์ / สมาชิก / รีวิว / แพ็คเกจ)
- [ ] เฟส 5 — อีเมล + i18n + deploy
