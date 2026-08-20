# ระบบชำระเงิน (Stripe) — คู่มือเปิดใช้งาน

โค้ดพร้อมแล้ว เหลือแค่ใส่คีย์ + สร้าง Price ทำตามนี้ (โหมดทดสอบ)

## 1) เอาคีย์ test จาก Stripe
สมัคร/เข้า https://dashboard.stripe.com → เปิด **Test mode** (สวิตช์มุมขวาบน)
Developers → API keys → คัดลอก:
- Publishable key `pk_test_...`
- Secret key `sk_test_...`

ใส่ใน `.env`:
```
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

## 2) สร้าง Price อัตโนมัติ (4 แพ็กเกจ THB)
```bash
node scripts/stripe-setup.mjs
```
สคริปต์จะสร้าง Product + Price แล้วพิมพ์บรรทัด `STRIPE_PRICE_*` ออกมา — ก๊อปไปวางใน `.env`:
```
STRIPE_PRICE_MONTH="price_..."
STRIPE_PRICE_Q3="price_..."
STRIPE_PRICE_H6="price_..."
STRIPE_PRICE_YEAR="price_..."
```
(รันซ้ำได้ ไม่สร้างซ้ำ — ใช้ lookup_key)

## 3) ตั้ง Webhook (จำเป็นต่อการบันทึกสมาชิก)
ติดตั้ง Stripe CLI: https://docs.stripe.com/stripe-cli แล้ว:
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
คัดลอก `whsec_...` ที่ขึ้นมา ใส่ใน `.env`:
```
STRIPE_WEBHOOK_SECRET="whsec_..."
```
> เปิด terminal นี้ค้างไว้ระหว่างทดสอบ (มันคอย forward event เข้าเว็บ)

## 4) รีสตาร์ท dev แล้วทดสอบ
```bash
npm run dev
```
- ปุ่มในหน้า **ราคา** จะกลายเป็น Stripe Checkout อัตโนมัติ (เพราะมี `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` แล้ว)
- ต้อง **เข้าสู่ระบบก่อน** (ถ้ายังไม่ล็อกอิน กดปุ่มจะพาไป /login)
- บัตรทดสอบ: `4242 4242 4242 4242` · วันหมดอายุอนาคตอะไรก็ได้ · CVC อะไรก็ได้

## สิ่งที่เกิดขึ้นหลังจ่ายสำเร็จ
1. เด้งกลับ `/account?checkout=success` → เห็นแบนเนอร์ "ชำระเงินสำเร็จ"
2. Webhook สร้าง `Subscription` (ACTIVE) + `Payment` + `AccessGrant` สถานะ PENDING
3. สมาชิกกรอก TradingView username → แอดมินเห็นในคิว `/admin/access-queue` → กดอนุมัติ + เพิ่มสิทธิ์สคริปต์บน TradingView
4. ต่ออายุรอบถัดไป: Stripe ยิง `invoice.paid` → บันทึกใบเสร็จอัตโนมัติ
5. ยกเลิก/เปลี่ยนแพ็กเกจ: ปุ่มในหน้า `/account/subscription` → Stripe Billing Portal

## ทดสอบเหตุการณ์ (ไม่ต้องรูดจริง)
```bash
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.deleted
```

## ขึ้น Live
1. สลับ Stripe เป็น Live mode → เอา `sk_live_` / `pk_live_`
2. รัน `node scripts/stripe-setup.mjs` อีกครั้ง (โหมด live) → เอา Price ID live
3. Dashboard → Developers → Webhooks → Add endpoint: `https://โดเมนจริง/api/webhooks/stripe`
   เลือก event: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`
   → เอา Signing secret (`whsec_...`) live ใส่ env บน production
