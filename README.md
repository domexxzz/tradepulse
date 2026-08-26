# TradePulse

เว็บขายสิทธิ์ใช้งานอินดิเคเตอร์วิเคราะห์ทองคำ (XAUUSD) บน TradingView แบบสมาชิกรายงวด
พร้อมระบบชำระเงิน ส่งมอบสิทธิ์ และดูแลอายุสมาชิกอัตโนมัติ

> TradePulse เป็นเครื่องมือช่วยวิเคราะห์เท่านั้น ไม่ใช่คำแนะนำการลงทุน
> ไม่รับบริหารเงินทุน และไม่รับประกันผลตอบแทน

## ระบบที่มี

| ส่วน | รายละเอียด |
|---|---|
| หน้าขาย | 20 section — กราฟสด TradingView, ฟีเจอร์ 18 รายการ, สัญญาณสด, รีวิวจริง, ราคา, FAQ |
| SEO | หน้าฟีเจอร์รายตัว 18 หน้า, sitemap, robots, OG image, structured data |
| สมาชิก | สมัคร/เข้าสู่ระบบ (อีเมล + Google/LINE), ลืมรหัสผ่าน, พอร์ทัลจัดการบัญชี |
| ชำระเงิน | PromptPay QR + แนบสลิป (ค่าเริ่มต้น) หรือ Stripe subscription |
| ส่งมอบสิทธิ์ | อินดิเคเตอร์ TradingView, ยศ Discord ตามแพ็กเกจ, กลุ่มสัญญาณ Telegram |
| อายุสมาชิก | ต่ออายุทบวันที่เหลือ, เตือนล่วงหน้า 3 วัน, ปิดสิทธิ์อัตโนมัติเมื่อหมดอายุ |
| แอดมิน | ตรวจสลิป, คิวสิทธิ์, จัดการสมาชิก, รีวิว, ผู้รับข่าวสาร |
| สัญญาณ | รับจาก TradingView Alert → เก็บลงเว็บ + ส่งเข้า Telegram แยกตาม timeframe |

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Prisma + PostgreSQL ·
Auth.js v5 · Stripe · Resend · deploy บน Vercel

## เริ่มใช้งานในเครื่อง

```bash
docker run -d --name tradepulse-pg \
  -e POSTGRES_PASSWORD=devpass -e POSTGRES_USER=tradepulse -e POSTGRES_DB=tradepulse \
  -p 5433:5432 postgres:16-alpine

cp .env.example .env      # แล้วกรอก DATABASE_URL / DIRECT_URL ตาม docs/SETUP.md
npm install
npx prisma migrate dev
node prisma/seed.mjs
npm run dev               # http://localhost:3000
```

## เอกสาร

| หัวข้อ | ไฟล์ |
|---|---|
| ติดตั้ง ตั้งค่า และ deploy | [docs/SETUP.md](docs/SETUP.md) |
| วงจรชีวิตสมาชิก + cron ปิดสิทธิ์ | [docs/LIFECYCLE.md](docs/LIFECYCLE.md) |
| ระบบอีเมล | [docs/EMAIL.md](docs/EMAIL.md) |
| สลิป PromptPay + ตรวจสลิปอัตโนมัติ | [docs/SLIP.md](docs/SLIP.md) |
| ให้สิทธิ์ TradingView อัตโนมัติ | [docs/TRADINGVIEW.md](docs/TRADINGVIEW.md) |
| สัญญาณเข้ากลุ่ม Telegram | [docs/TELEGRAM.md](docs/TELEGRAM.md) |
| ยศ Discord ตามแพ็กเกจ | [docs/DISCORD.md](docs/DISCORD.md) |
| แดชบอร์ดแอดมิน | [docs/ADMIN.md](docs/ADMIN.md) |
| Stripe | [docs/PAYMENTS.md](docs/PAYMENTS.md) |
| แผนโปรดักต์ตั้งต้น | [PLAN.md](PLAN.md) |

## แก้เนื้อหาเว็บ

แก้ที่ไฟล์เดียวแล้วเปลี่ยนทั้งเว็บ:

- `src/config/site.ts` — ชื่อแบรนด์ ช่องทางติดต่อ เมนู ลิงก์กราฟ
- `src/config/plans.ts` — แพ็กเกจและราคา
- `src/config/features.ts` — ฟีเจอร์ 18 รายการ (มี `slug` = URL หน้ารายตัว) FAQ และเนื้อหาอื่น
- `src/config/stats.ts` — สถิติ backtest (ซ่อนไว้จนกว่าจะกรอกตัวเลขจริง)
- `src/app/globals.css` — สีธีม

## ก่อนขึ้น production ต้องตั้งอย่างน้อยนี้

```
DATABASE_URL, DIRECT_URL       ฐานข้อมูล
NEXTAUTH_SECRET                เข้ารหัส session
NEXT_PUBLIC_SITE_URL           โดเมนจริง (ใช้ในอีเมลและ SEO)
PROMPTPAY_ID                   รับเงิน
CRON_SECRET                    ⚠️ ไม่ตั้ง = สมาชิกไม่มีวันหมดอายุ
RESEND_API_KEY, EMAIL_FROM     ใบเสร็จ + ลืมรหัสผ่าน
ADMIN_EMAILS                   ตั้งแอดมินคนแรก
```

ตัวแปรทั้งหมดพร้อมคำอธิบายอยู่ใน [.env.example](.env.example)
