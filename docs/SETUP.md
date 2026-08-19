# คู่มือเริ่มต้น (Setup)

## รันในเครื่อง
```bash
npm install
npx prisma migrate dev   # สร้าง/อัปเดต DB (dev = SQLite)
npm run dev              # http://localhost:3000
```

## แก้เนื้อหา/แบรนด์ (แก้ที่เดียว เปลี่ยนทั้งเว็บ)
- `src/config/site.ts` — ชื่อแบรนด์, LINE OA, สถิติ, เมนู
- `src/config/plans.ts` — แพ็คเกจ + ราคา
- `src/config/features.ts` — ฟีเจอร์ 25+, ระบบหลัก, รีวิว, FAQ
- `src/app/globals.css` — สีธีม (--brand เขียวไลม์, --background, .theme-light)
- `public/images/` — โลโก้/ภาพประกอบ

## ระบบสมาชิก (เฟส 2)
- Auth.js v5 (credentials + Google/LINE ถ้ามีคีย์) — `src/auth.ts`, `src/auth.config.ts`
- DB: Prisma + SQLite (dev) — `prisma/schema.prisma`
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

## ย้ายไป Production (Postgres)
1. เปลี่ยน `datasource.provider` เป็น `postgresql` + ตั้ง `DATABASE_URL`
2. (แนะนำ) แปลง field `status`/`role`/`interval` (String) เป็น enum
3. `npx prisma migrate deploy`

## สถานะเฟส
- [x] เฟส 0 — Setup (Next.js 16 + Tailwind v4)
- [x] เฟส 1 — Landing page (ทุก section + TradingView live + ธีมดำ-เขียว + พื้นขาวสลับดำ)
- [x] เฟส 2 — Auth + Member portal (register/login/account + TradingView + protected routes)
- [x] เฟส 3 — Payment (Stripe checkout + webhook + billing portal) *ต้องใส่คีย์เพื่อใช้งานจริง*
- [x] เฟส 4 — Admin dashboard (คิวอนุมัติสิทธิ์ / สมาชิก / รีวิว / แพ็คเกจ)
- [ ] เฟส 5 — อีเมล + i18n + deploy
