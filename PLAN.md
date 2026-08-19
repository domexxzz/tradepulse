# แผนพัฒนาเว็บไซต์ขายอินดิเคเตอร์เทรดทองคำ (Subscription)

> เอกสารนี้คือแผนสถาปัตยกรรม + โครงสร้างไฟล์ระดับ production
> อ้างอิงโมเดลจาก jtgindicators.com (subscription) และ manytrader.shop (feature showcase)

---

## 1. ภาพรวมโปรดักต์

**ธุรกิจ:** ขายสิทธิ์ใช้งานอินดิเคเตอร์บน TradingView (Pine Script invite-only) แบบสมาชิกรายงวด

**กลุ่มเป้าหมาย:** เทรดเดอร์ทองคำ (XAUUSD) / ฟอเร็กซ์ / คริปโต คนไทย

**เป้าหมายเว็บ 3 อย่าง:**
1. **ขาย** — โชว์ฟีเจอร์ + ราคา + ปิดการขายบนเว็บ (จ่ายเงินจริง)
2. **ส่งมอบ** — สมาชิกจ่ายเงิน → ผูก TradingView username → ได้สิทธิ์ใช้อินดิเคเตอร์
3. **ต่ออายุ/ดูแล** — ระบบ subscription ต่ออายุอัตโนมัติ + พอร์ทัลสมาชิก + ซัพพอร์ต

**โมเดลราคา:** รายเดือน / 3 เดือน / 6 เดือน / รายปี (ยิ่งนานยิ่งถูกต่อเดือน)

---

## 2. Tech Stack (ตัดสินใจแล้ว)

| ชั้น | เทคโนโลยี | เหตุผล |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | SEO ดี, SSR/ISR, API routes ในตัว, เร็ว |
| Styling | **Tailwind CSS v4 + shadcn/ui** | สร้าง UI เร็ว, ปรับ theme ง่าย, มืออาชีพ |
| Animation | **Framer Motion** | market ticker, reveal-on-scroll |
| Database | **PostgreSQL (Supabase หรือ Neon)** | relational, ฟรีเทียร์, scale ได้ |
| ORM | **Prisma** | type-safe, migration ง่าย |
| Auth | **Auth.js (NextAuth v5)** | email/Google/LINE Login, session |
| Payment | **Stripe Billing** (หลัก) + **Omise/Opn** (PromptPay/บัตรไทย) | subscription recurring + โอนพร้อมเพย์ |
| Charts | **TradingView Widgets** (ticker + advanced chart XAUUSD) | กราฟสดจริง |
| Email | **Resend** | ใบเสร็จ, แจ้งเตือนต่ออายุ |
| Deploy | **Vercel** (เว็บ) + **Supabase** (DB) | CI/CD อัตโนมัติ, เร็วทั่วโลก |
| i18n | **next-intl** | ไทย/อังกฤษ (เฟสหลัง) |

> **หมายเหตุ payment:** Stripe รองรับ subscription recurring ดีที่สุด และตอนนี้เปิดให้ธุรกิจไทยแล้ว
> ถ้าต้องการ PromptPay/QR แบบไทย ๆ เสริม Omise (Opn Payments) ได้ แต่ recurring หลักแนะนำ Stripe

---

## 3. สถาปัตยกรรมระบบ

```
ผู้ใช้ (Browser / Mobile)
        │
        ▼
┌──────────────────────────────┐
│   Next.js (Vercel)           │
│  ┌────────────┬────────────┐ │
│  │  Public    │  Member    │ │   ← หน้า marketing + พอร์ทัลสมาชิก
│  │  Landing   │  Portal    │ │
│  ├────────────┴────────────┤ │
│  │   Admin Dashboard       │ │   ← จัดการสมาชิก/สิทธิ์/รีวิว
│  ├─────────────────────────┤ │
│  │   API Routes / Actions  │ │
│  └─────────────────────────┘ │
└───────┬──────────┬───────────┘
        │          │
        ▼          ▼
   ┌────────┐  ┌──────────┐
   │ Stripe │  │ Postgres │   ← subscription + ข้อมูลสมาชิก
   │Webhook │  │ (Prisma) │
   └────────┘  └──────────┘
        │
        ▼
  TradingView (grant/revoke สิทธิ์ — manual หรือ semi-auto ผ่าน admin)
```

**Flow การขาย:**
1. ผู้ใช้เลือกแพ็คเกจ → สมัคร/ล็อกอิน → Stripe Checkout
2. จ่ายเงินสำเร็จ → Stripe webhook → สร้าง `Subscription` ในดาต้าเบส → status = active
3. ระบบขอ **TradingView username** จากสมาชิก
4. Admin (หรือระบบกึ่งอัตโนมัติ) ไป grant สิทธิ์ script ให้ username นั้นบน TradingView
5. แจ้งเตือนทางเว็บ/อีเมล/LINE ว่าใช้งานได้แล้ว
6. เมื่อ subscription หมด/ยกเลิก → webhook → revoke สิทธิ์

> **ข้อจำกัดสำคัญ:** TradingView ไม่มี public API สำหรับ grant invite-only script อัตโนมัติเต็มรูปแบบ
> → เฟสแรกใช้ **admin dashboard + คิวงาน** (semi-manual) เป็นวิธีที่ปลอดภัยและถูก ToS ที่สุด

---

## 4. Data Model (Prisma schema — ระดับแนวคิด)

```
User
  id, email, name, image, tradingViewUsername?, role (USER|ADMIN),
  lineUserId?, createdAt

Plan            // แพ็คเกจ
  id, name, interval (MONTH|Q3|H6|YEAR), priceTHB, stripePriceId,
  features[], isActive, sortOrder

Subscription
  id, userId, planId, stripeSubscriptionId, stripeCustomerId,
  status (ACTIVE|PAST_DUE|CANCELED|TRIALING),
  currentPeriodEnd, cancelAtPeriodEnd, createdAt

AccessGrant     // สถานะการให้สิทธิ์ TradingView
  id, userId, subscriptionId, indicatorId,
  status (PENDING|GRANTED|REVOKED), grantedAt?, revokedAt?, note?

Indicator       // ตัวอินดิเคเตอร์/ฟีเจอร์
  id, name, slug, category, shortDesc, longDesc, image, tvScriptId?

Feature         // การ์ดฟีเจอร์ย่อย (25+ อันแบบ JTG)
  id, title, description, icon, category, sortOrder

Review
  id, userName, rating (1-5), comment, plan?, isApproved, createdAt

Payment         // log ธุรกรรม
  id, userId, amountTHB, provider, providerRef, status, createdAt
```

---

## 5. โครงสร้าง Section หน้าเว็บ (Sitemap)

### หน้า Public (marketing)
```
/                      Landing page (single-page + anchor scroll)
  ├─ Hero              ชื่อแบรนด์ + tagline + CTA + ราคาเริ่มต้น
  ├─ TrustBar          ผู้ใช้งาน / ปีก่อตั้ง / win rate / รองรับทุกอุปกรณ์
  ├─ MarketTicker      FOREX·CRYPTO·GOLD XAUUSD·STOCKS (วิ่ง)
  ├─ LiveChart         TradingView advanced chart XAUUSD (สด)
  ├─ About             แนวคิดระบบ + "ไม่ใช่บอทเทรด"
  ├─ CoreFunctions     4-6 ฟีเจอร์หลัก + ภาพกราฟ
  ├─ FeatureGrid       การ์ดฟีเจอร์ย่อย 25+
  ├─ Pricing           เดือน/3เดือน/6เดือน/ปี + ปุ่มสมัคร
  ├─ Reviews           รีวิว + ดาว
  ├─ FAQ               คำถามที่พบบ่อย
  ├─ Disclaimer        คำเตือนความเสี่ยง (กฎหมาย)
  └─ Contact/LineOA    QR + ปุ่มแอดไลน์
/features/[slug]       รายละเอียดฟีเจอร์รายตัว (SEO)
/pricing               หน้าราคาแบบเต็ม
/terms /privacy /refund   หน้ากฎหมาย
```

### หน้าสมาชิก (ต้องล็อกอิน)
```
/login /register
/account               ภาพรวม: แพ็คเกจปัจจุบัน, วันหมดอายุ
/account/subscription  จัดการ/ยกเลิก/เปลี่ยนแพ็คเกจ (Stripe portal)
/account/tradingview   กรอก/แก้ TradingView username + สถานะสิทธิ์
/account/billing       ประวัติใบเสร็จ
/account/support       ลิงก์ LINE OA / ticket
```

### หน้า Admin (role = ADMIN)
```
/admin                 dashboard: ยอดขาย, สมาชิก active, คิวรอ grant
/admin/members         รายชื่อสมาชิก + สถานะ
/admin/access-queue    คิว AccessGrant PENDING → กด granted/revoked
/admin/plans           จัดการแพ็คเกจ/ราคา
/admin/features        จัดการการ์ดฟีเจอร์
/admin/reviews         อนุมัติรีวิว
```

---

## 6. โครงสร้างไฟล์ (Folder Structure)

```
WebPeeNOT/
├─ .env.local                    # secrets (git-ignored)
├─ .env.example                  # เทมเพลต env
├─ .gitignore
├─ next.config.ts
├─ tsconfig.json
├─ tailwind.config.ts
├─ postcss.config.mjs
├─ package.json
├─ README.md
├─ PLAN.md                       # เอกสารนี้
│
├─ prisma/
│  ├─ schema.prisma              # data model
│  ├─ seed.ts                    # ข้อมูลเริ่มต้น (plans, features, reviews)
│  └─ migrations/
│
├─ public/
│  ├─ images/                    # โลโก้, ภาพกราฟฟีเจอร์
│  ├─ line-qr.png
│  └─ og-image.png               # social share
│
├─ src/
│  ├─ app/
│  │  ├─ (marketing)/            # กลุ่มหน้า public
│  │  │  ├─ layout.tsx           # Navbar + Footer
│  │  │  ├─ page.tsx             # Landing (ประกอบจาก sections)
│  │  │  ├─ features/[slug]/page.tsx
│  │  │  ├─ pricing/page.tsx
│  │  │  ├─ terms/page.tsx
│  │  │  ├─ privacy/page.tsx
│  │  │  └─ refund/page.tsx
│  │  │
│  │  ├─ (auth)/
│  │  │  ├─ login/page.tsx
│  │  │  └─ register/page.tsx
│  │  │
│  │  ├─ account/               # พอร์ทัลสมาชิก (protected)
│  │  │  ├─ layout.tsx
│  │  │  ├─ page.tsx
│  │  │  ├─ subscription/page.tsx
│  │  │  ├─ tradingview/page.tsx
│  │  │  ├─ billing/page.tsx
│  │  │  └─ support/page.tsx
│  │  │
│  │  ├─ admin/                 # แดชบอร์ดแอดมิน (protected+role)
│  │  │  ├─ layout.tsx
│  │  │  ├─ page.tsx
│  │  │  ├─ members/page.tsx
│  │  │  ├─ access-queue/page.tsx
│  │  │  ├─ plans/page.tsx
│  │  │  ├─ features/page.tsx
│  │  │  └─ reviews/page.tsx
│  │  │
│  │  ├─ api/
│  │  │  ├─ auth/[...nextauth]/route.ts
│  │  │  ├─ checkout/route.ts          # สร้าง Stripe Checkout session
│  │  │  ├─ webhooks/stripe/route.ts   # รับ event จาก Stripe
│  │  │  └─ webhooks/line/route.ts     # (option) LINE
│  │  │
│  │  ├─ layout.tsx              # root layout (fonts, providers)
│  │  ├─ globals.css
│  │  └─ not-found.tsx
│  │
│  ├─ components/
│  │  ├─ ui/                     # shadcn (button, card, dialog, ...)
│  │  ├─ marketing/
│  │  │  ├─ Hero.tsx
│  │  │  ├─ TrustBar.tsx
│  │  │  ├─ MarketTicker.tsx
│  │  │  ├─ LiveChart.tsx        # TradingView widget wrapper
│  │  │  ├─ About.tsx
│  │  │  ├─ CoreFunctions.tsx
│  │  │  ├─ FeatureGrid.tsx
│  │  │  ├─ FeatureCard.tsx
│  │  │  ├─ Pricing.tsx
│  │  │  ├─ PriceCard.tsx
│  │  │  ├─ Reviews.tsx
│  │  │  ├─ FAQ.tsx
│  │  │  ├─ Disclaimer.tsx
│  │  │  └─ LineCTA.tsx
│  │  ├─ account/
│  │  ├─ admin/
│  │  └─ common/ (Navbar, Footer, ThemeToggle, LangSwitch)
│  │
│  ├─ lib/
│  │  ├─ prisma.ts               # Prisma client singleton
│  │  ├─ auth.ts                 # Auth.js config
│  │  ├─ stripe.ts               # Stripe client + helpers
│  │  ├─ tradingview.ts          # helper สิทธิ์ (queue logic)
│  │  ├─ email.ts                # Resend helpers
│  │  └─ utils.ts
│  │
│  ├─ config/
│  │  ├─ site.ts                 # ชื่อแบรนด์, LINE OA, social, SEO defaults
│  │  ├─ plans.ts                # นิยามแพ็คเกจ (fallback ก่อนต่อ DB)
│  │  └─ features.ts             # เนื้อหาการ์ดฟีเจอร์ 25+
│  │
│  ├─ content/                   # เนื้อหา (ไทย/อังกฤษ) แบบ MDX/JSON
│  │  ├─ th/
│  │  └─ en/
│  │
│  ├─ types/
│  └─ middleware.ts              # ป้องกันเส้นทาง account/admin
│
└─ docs/
   ├─ SETUP.md                   # วิธีตั้งค่า env + third-party
   └─ DEPLOY.md
```

---

## 7. แพ็คเกจราคา (โครงสร้างที่แนะนำ)

| แพ็คเกจ | รอบบิล | กลยุทธ์ราคา | หมายเหตุ |
|---|---|---|---|
| รายเดือน | ทุก 1 เดือน | ราคาต่อเดือนสูงสุด | ทดลองใช้ |
| 3 เดือน | ทุก 3 เดือน | ลด ~10% | — |
| 6 เดือน | ทุก 6 เดือน | ลด ~20% | — |
| **รายปี** | ทุก 12 เดือน | **ถูกที่สุด/เดือน** | ป้าย "คุ้มที่สุด" |

> ราคาจริงกรอกได้ในหน้า `/admin/plans` (map กับ Stripe Price ID)
> ทุกแพ็คเกจ = ต่ออายุอัตโนมัติ + ยกเลิกได้ก่อนรอบถัดไป (เหมือน JTG)

---

## 8. แผนการทำงาน (Roadmap แบ่งเฟส)

### เฟส 0 — Setup (0.5 วัน)
- init Next.js + Tailwind + shadcn + Prisma + Auth.js
- ตั้ง `.env.example`, config/site.ts, โครง folder
- เชื่อม DB (Supabase) + migration แรก

### เฟส 1 — Landing Page (2-3 วัน)
- ทุก section marketing + responsive + dark theme
- TradingView live chart + market ticker
- ใส่คอนเทนต์จริง (ฟีเจอร์ 25+, รีวิว) จากข้อมูลที่คุณมี
- SEO (metadata, OG image, sitemap, robots)

### เฟส 2 — Auth + Member Portal (2 วัน)
- ล็อกอิน/สมัคร (email + Google + LINE)
- หน้า /account + กรอก TradingView username

### เฟส 3 — Payment + Subscription (2-3 วัน)
- Stripe Checkout + webhook + สร้าง Subscription
- Customer portal (จัดการ/ยกเลิก)
- Omise/PromptPay (option)

### เฟส 4 — Admin Dashboard (2 วัน)
- คิว grant สิทธิ์ TradingView
- จัดการสมาชิก/แพ็คเกจ/รีวิว

### เฟส 5 — ขัดเงา + Deploy (1-2 วัน)
- อีเมลใบเสร็จ/แจ้งเตือน, i18n, performance, ทดสอบ
- deploy Vercel + โดเมนจริง

**รวมประมาณ 10-14 วันทำงาน** (ทำ MVP ขายได้จริงตั้งแต่จบเฟส 3)

---

## 9. บัญชี/บริการภายนอกที่ต้องเตรียม (Checklist)

- [ ] โดเมนเว็บ (เช่น yourbrand.com)
- [ ] บัญชี **Vercel** (deploy)
- [ ] บัญชี **Supabase** หรือ Neon (Postgres)
- [ ] บัญชี **Stripe** (เปิดร้านค้าไทย + ยืนยันธุรกิจ) → ได้ Price ID ต่อแพ็คเกจ
- [ ] (option) บัญชี **Omise/Opn** สำหรับ PromptPay
- [ ] **LINE OA** + LINE Login channel (client id/secret)
- [ ] บัญชี **Resend** (ส่งอีเมล) + โดเมนอีเมล
- [ ] บัญชี **TradingView** ที่เป็นเจ้าของ invite-only script
- [ ] Google OAuth client (ล็อกอิน Google)

### ตัวแปร env ที่ต้องใช้ (`.env.example`)
```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
LINE_CLIENT_ID=
LINE_CLIENT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
OMISE_PUBLIC_KEY=          # option
OMISE_SECRET_KEY=          # option
RESEND_API_KEY=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_LINE_OA_URL=
```

---

## 10. กฎหมาย / Compliance (สำคัญมากสำหรับไทย)

ทั้ง 2 เว็บอ้างอิงเน้นเรื่องนี้ — เราต้องมีให้ครบเพื่อลดความเสี่ยง ก.ล.ต./ปอท.:

1. **Disclaimer ชัดเจน:** "จำหน่ายเครื่องมือช่วยวิเคราะห์บน TradingView เท่านั้น ไม่ชักชวนลงทุน ไม่รับบริหารเงินทุน ไม่รับฝากเทรด ไม่การันตีผลตอบแทน การเทรดมีความเสี่ยง"
2. **ห้ามใช้ถ้อยคำการันตีกำไร** — เลี่ยง "รวยแน่นอน/การันตี 100%" (win rate ให้ระบุว่าเป็นผลย้อนหลัง ไม่ใช่การรับประกันอนาคต)
3. **หน้า Terms / Privacy (PDPA) / Refund Policy** ครบ
4. **PDPA:** consent การเก็บข้อมูล + cookie banner (เลือก decline non-essential เป็นค่าเริ่ม)
5. ถ้าเป็นนิติบุคคล ใส่ชื่อบริษัท/เลขทะเบียนเพื่อความน่าเชื่อ (แบบ ManyTrader)

---

## 11. สิ่งที่ต้องขอจากคุณก่อนลงมือ (เฟส 0-1)

1. **ชื่อแบรนด์ + โลโก้** (หรือให้ผมออกแบบชั่วคราว)
2. **ราคาจริงแต่ละแพ็คเกจ** (เดือน/3เดือน/6เดือน/ปี — เป็นบาท)
3. **รายชื่อ + คำอธิบายฟีเจอร์** ที่คุณมี (โยนมาเป็นลิสต์ได้เลย)
4. **ภาพกราฟ/สกรีนช็อตอินดิเคเตอร์** (วางใน `public/images/`)
5. **LINE OA ID/ลิงก์** + QR
6. โทนสี/สไตล์ที่ชอบ (เช่น ดำ-ทอง หรู, หรือ น้ำเงิน-เขียว สายเทค)

---

*จบเอกสารแผน — พร้อมเริ่มเฟส 0 เมื่อคุณเคาะ*
