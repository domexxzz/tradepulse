# QVX — สรุปสถานะโปรเจกต์ (ส่งต่อเซสชัน)

_อัปเดต 26 ก.ย. 2569 · เขียนจากการตรวจโค้ดจริง + บันทึกของเซสชันก่อน ๆ_

ข้อมูลที่มาจาก **บันทึกเซสชัน** (ไม่ได้ตรวจซ้ำจากโค้ด) จะมีป้าย `〔บันทึก〕` กำกับ
บันทึกพวกนั้นอายุ ~4 สัปดาห์ — สภาพจริงอาจเปลี่ยนไปแล้ว ตรวจก่อนเชื่อ

ไฟล์นี้แทนบันทึกส่งต่อฉบับ 27 ส.ค. 2569 — เนื้อหาที่ยังใช้ได้ของฉบับนั้นย้ายมารวมไว้แล้ว
ฉบับเดิมดูได้ที่ `git show 013eba3:docs/HANDOFF.md`

---

## ⛔ อ่านก่อนทำอะไรทั้งนั้น

| อะไร | สถานะ | ตรวจยังไง |
|---|---|---|
| เว็บ production | 🟢 live | `curl -o /dev/null -w '%{http_code}' https://quantvisionx.com` → 200 |
| main | CI ผ่านทุกคอมมิตล่าสุด | `git fetch && git log -1 origin/main` · `gh run list --workflow ci.yml -L 1` |
| **เว็บ → บริดจ์ TradingView** | 🔴 **ติดต่อไม่ได้ทั้งตัวหลักและตัวสำรอง** ทุกรอบตั้งแต่อย่างน้อย 3 ก.ย. ถึง 26 ก.ย. = ตอนนี้บอทเพิ่มสิทธิ์อัตโนมัติไม่ได้ | ดูผลรอบล่าสุด ↓ |
| บริดจ์หลัก — คอมเฟิร์ส | 🔴 เว็บยิงไม่ถึง (`primaryUp:false`) | ข้อความเตือนในกลุ่ม Testtool บอกโฮสต์ที่เว็บยิงไป |
| บริดจ์สำรอง — คอมเบส | ⚠️ ยิงตรงได้ 200 (27 ก.ย.) แต่เว็บยิงไม่ถึง (`backupUp:false`) → `TV_BOT_URL_BACKUP` บน Vercel น่าจะชี้ผิดที่ | `curl https://asus.tail17bed7.ts.net/health` · `schtasks /query /tn TradePulseTVBridge /fo list /v` |
| ที่นั่งโปร | 300 ว่างครบ ยังไม่มีลูกค้าจ่ายเงิน | แถบโปรบนหน้าแรก |

ดูผล bridge-health รอบล่าสุด (สิ่งที่เว็บเห็นจริง ไม่ใช่ที่ยิงจากเครื่องเรา):

```bash
id=$(gh run list --workflow bridge-health.yml -L 1 --json databaseId -q '.[0].databaseId')
gh run view $id --log | grep -o '{"ok":true,"primaryUp[^}]*}'
```

ก่อนแก้ไฟล์ไหน เช็ก `git status` ก่อนเสมอว่าไฟล์นั้นมีคนแก้ค้างอยู่ไหม

### 3. มีคนทำงานจากเครื่องอื่นด้วย — fetch ก่อนเริ่มงานทุกครั้ง

เมื่อ 26 ก.ย. ผู้ใช้ GitHub `electiction` push งานใหม่ 4 PR จากเครื่องอื่น
(ช่องทาง Wisdom · API สิทธิ์ · โครง Discord · เอกสาร — ดูหัวข้อ 4.5)
ตอนนั้นสำเนาบน E: ตามหลังอยู่ 4 คอมมิตโดยไม่มีใครรู้

**rebase และ push แล้ว** — ตอนเขียนบันทึกนี้ในเครื่องกับ GitHub ตรงกันที่ `013eba3`
แต่เริ่มงานรอบหน้าให้เช็กก่อนเสมอ อย่าเชื่อว่า HEAD ในเครื่องคือล่าสุด

```powershell
git fetch origin
git status -sb          # ถ้าขึ้น behind ให้ git rebase origin/main ก่อนเริ่มแก้อะไร
```

---

## 1. โปรเจกต์นี้คืออะไร

**QVX / QuantVisionX** — เว็บขายสมาชิกอินดิเคเตอร์วิเคราะห์ทองคำ **XAUUSD บน TradingView**
อินดิเคเตอร์เป็นแบบ **invite-only** ลูกค้าจ่ายเงินแล้วระบบไปเพิ่ม TradingView username ให้

| อะไร | ค่า |
|---|---|
| โดเมน | `quantvisionx.com` |
| โฮสต์ | Vercel — project ชื่อ `tradepulse` (แผน Hobby) |
| GitHub | `domexxzz/tradepulse` · branch `main` |
| ฐานข้อมูล | PostgreSQL บน Neon 〔บันทึก〕 บัญชีเป็นของ "โดม" เจ้าของเว็บเข้า console ไม่ได้ — จัดการ DB ผ่าน Vercel runtime |
| ดีไซเนอร์ | น็อต (`prawsupacha@gmail.com`) ส่งงานผ่าน Google Drive |

---

## 2. Stack

| ชั้น | เทคโนโลยี |
|---|---|
| เฟรมเวิร์ก | **Next.js 16.3.1** (App Router) · React 19.2.8 |
| สไตล์ | Tailwind CSS v4 |
| DB | Prisma 6.19.3 + PostgreSQL |
| ล็อกอิน | Auth.js v5 (`next-auth` 5.0.0-beta.32) + `@auth/prisma-adapter` |
| ชำระเงิน | PromptPay QR (`promptpay-qr`) + ตรวจสลิป · Stripe 22.5 (สำรอง) |
| ภาพ | `sharp` · `jsqr` (อ่าน QR จากสลิป) · `qrcode` |
| อื่น ๆ | `zod` 4 · `framer-motion` · `lucide-react` · `bcryptjs` |
| เทส | Vitest 4 |

> ⚠️ **Next.js 16 มี breaking change เยอะ** — `AGENTS.md` สั่งให้อ่านคู่มือใน
> `node_modules/next/dist/docs/` ก่อนเขียนโค้ด เช่น `images.qualities` ต้องประกาศใน config
> ถึงจะใช้ `quality` อื่นนอกจาก 75 ได้

### คำสั่งที่มี

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run setup` | ตั้งเครื่อง dev คำสั่งเดียว — หา Postgres → เขียน `.env` → migrate → seed |
| `npm run dev` | dev server |
| `npm run build` | build (ดูกับดัก OOM ด้านล่าง) |
| `npm test` | unit test (Vitest) |
| `npm run test:uat` | เทสต์กับฐานข้อมูลจริง — ต้องเปิด Postgres ที่ `localhost:5433` เอง |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run admin` | สร้าง/รีเซ็ตบัญชีแอดมินโดยไม่ต้องพึ่งอีเมล (ต้องมี TTY) — ใช้ตอนปุ่ม "ลืมรหัสผ่าน" ใช้ไม่ได้เพราะไม่มี `RESEND_API_KEY` |
| `npm run discord:setup` | สร้างห้อง/ยศ Discord ตามสเปก — ไม่ใส่อะไร = ดูแผน · `-- --apply` = สร้างจริง |
| `npm run db:status-audit` | สำรวจค่า status ใน DB ก่อนทำ enum |
| `npm run images:sizes [โฟลเดอร์]` | อ่านขนาดภาพจริง + เตือนไฟล์ที่เล็กเกินจะเบลอ |

`vercel-build` = `prisma generate && prisma migrate deploy && node scripts/bootstrap-admin.mjs && next build`
→ **migration รันเองทุก deploy** และ bootstrap แอดมินถ้าตั้ง env ไว้

---

## 3. สถานะ git

- ตอนเขียนบันทึกนี้ ในเครื่องตรงกับ GitHub — คอมมิตก่อนหน้าบันทึกนี้คือ `013eba3` (26 ก.ย. 23:17)
- ย้อนไปอีกคือ 4 PR ของ `electiction` (26 ก.ย.) และ `0a528f3` (31 ส.ค.) ตามลำดับ
- **tag ดีไซน์ล่าสุด = `v8`** (`a529084`, 29 ส.ค.) — หลังจากนั้นมีงานอีกหลายสิบคอมมิตที่ยังไม่ติด tag
- ธรรมเนียมตั้งชื่อเวอร์ชัน: เจ้าของโปรเจกต์สั่งเองว่า "บันทึกเป็น V_" แล้วต้องทำสามอย่าง —
  annotated tag ชี้คอมมิตที่ deploy จริง · เพิ่มแถวใน `docs/DESIGN-VERSIONS.md` · อัปเดตความจำ

**untracked ที่ค้างอยู่** (งานของเซสชันอื่น ไม่ใช่ขยะ — ถามก่อนลบ)

- `design-handoff/how-it-works-variants/*` — ภาพลองหลายเวอร์ชันของหัวข้อ 4 ขั้นตอน
- `public/images/how-it-works/` โฟลเดอร์ลอง 7 ชุด (`infographic`, `site-capture-infographic` ถึง `-v4`, `site-capture-visual-v5`, `site-captures`)

---

## 4. ระบบทำอะไรได้บ้าง

### 4.1 หน้าสาธารณะ

| หน้า | เนื้อหา |
|---|---|
| `/` | หน้าแรก: Hero (คลิปกราฟ + การ์ดโปร Founding 300) · ticker ราคา · ปัญหา-วิธีแก้ · ฟีเจอร์ · ตัวอย่าง · สัญญาณ Telegram · รีวิว · **ราคา** · 4 ขั้นตอน · FAQ · สมัครรับข่าว |
| `/features` · `/features/[slug]` | ฟีเจอร์ของอินดิเคเตอร์ 12 ตัวที่มีภาพจริง (อีก 6 ตัวซ่อนไว้เพราะยังไม่มีภาพ) |
| `/guide` | คู่มือตั้งค่า 3 ชุดอินดิเคเตอร์ (A: SMC · B: Gold Booster+Core · C: ICT SD) |
| `/card` | การ์ดสรุปสินค้าไว้แคปเป็นภาพโฆษณา |
| `/terms` · `/privacy` · `/refund` | หน้ากฎหมาย |
| `/login` · `/register` · `/forgot-password` · `/reset-password` | บัญชี |
| `/unsubscribe` | ยกเลิกรับข่าวจากลิงก์ในอีเมล ไม่ต้องล็อกอิน |

มี `sitemap.ts` · `robots.ts` · `opengraph-image.tsx` · JSON-LD structured data

### 4.2 หน้าสมาชิก `/account/*`

| หน้า | ทำอะไร |
|---|---|
| `/account` | ภาพรวมสมาชิก + ป้ายโปรไฟล์ยืนยันสมาชิก |
| `/account/subscription` | สถานะแพ็กเกจ วันหมดอายุ ราคาที่ล็อกไว้ |
| `/account/billing` · `/account/orders` · `/account/pay/[id]` | ชำระเงิน / ประวัติ / หน้าจ่ายรายออเดอร์ (QR + แนบสลิป) |
| `/account/tradingview` | กรอก TradingView username → ระบบเรียกบอทให้สิทธิ์เอง |
| `/account/discord` | ผูกบัญชี Discord → ได้ยศตามแพ็กเกจ |
| `/account/reviews` | เขียนรีวิว (แอดมินอนุมัติก่อนขึ้นเว็บ) |
| `/account/support` | ช่องทางช่วยเหลือ |

ผูก Telegram ผ่าน deep link `https://t.me/TD_SMC_bot?start=<TelegramGrant.id>`
(Telegram ห้ามบอททักคนก่อน ลูกค้าต้องกด Start เอง)

### 4.3 หน้าแอดมิน `/admin/*`

| หน้า | ทำอะไร |
|---|---|
| `/admin` | แดชบอร์ด |
| `/admin/orders` | อนุมัติ/ปฏิเสธสลิป — **อนุมัติ = แจกสิทธิ์จริง** |
| `/admin/access-queue` | คิวสิทธิ์ TradingView · ปุ่ม **สั่งบอท** (เรียกบอทจริง) vs **อนุมัติ/ยกเลิก** (แค่บันทึกสถานะ) |
| `/admin/members` | จัดการสมาชิก |
| `/admin/telegram` | คิวลิงก์เชิญ + **ปลดผูกบัญชี Telegram** ที่ผูกผิด |
| `/admin/plans` | แพ็กเกจ (เทียบราคาใน DB กับ config แล้วเตือนถ้าไม่ตรง) |
| `/admin/reviews` | อนุมัติรีวิว |
| `/admin/subscribers` · `/admin/newsletter` | รายชื่อผู้สนใจ + ส่งข่าว |
| `/admin/system` | ตรวจว่าแต่ละระบบ "ตั้งค่าแล้ว" และ "ติดต่อได้จริง" หรือยัง |
| `/admin/settings` | แอดมินเปลี่ยนรหัสผ่าน/อีเมลตัวเอง (บังคับยืนยันรหัสก่อนทุกครั้ง) |

### 4.4 ระบบอัตโนมัติ

**วงจรสมาชิก** (`src/lib/lifecycle.ts`) — เปิดสิทธิ์ · ต่ออายุทบวันคงเหลือ · เตือนก่อนหมด · ปิดสิทธิ์
เมื่อจ่ายเงิน/อนุมัติสลิป ระบบทำให้ครบ: TradingView + ลิงก์เข้ากลุ่ม Telegram + ยศ Discord + อีเมล

**งานตั้งเวลา**

| งาน | ใครเรียก | ทำอะไร |
|---|---|---|
| `/api/cron/expire` | Vercel Cron ทุกวัน **01:00 UTC** | ปิดสิทธิ์คนหมดอายุ (TradingView + เตะออก Telegram + ถอดยศ Discord + อีเมล) · เตือนคนใกล้หมด · ล้างตัวนับ rate limit เก่า |
| `/api/cron/reconcile` | **GitHub Actions** (ตั้งทุก 10 นาที · รันจริงห่าง ~3–5 ชม.) | ไล่งานที่สั่งแล้วไม่สำเร็จ เช่น บริดจ์ล่มตอนลูกค้าจ่าย |
| `/api/cron/bridge-health` | **GitHub Actions** (ตั้งทุก 10 นาที · รันจริงห่าง ~3–5 ชม.) | เช็กบริดจ์ TradingView ล่มไหม แจ้งแอดมินทาง Telegram |
| `/api/cron/test-alert` | GitHub Actions กดเอง | ยิงข้อความทดสอบเข้าช่องแอดมิน |

ทำไมแยก: **Vercel Hobby ให้ cron แค่วันละครั้ง** งานถี่จึงไปอยู่ที่ `.github/workflows/bridge-health.yml`
ทุก cron กันด้วย `CRON_SECRET` — **ไม่ตั้ง secret = เส้นทางปิดตาย** (ตั้งใจ ดีกว่าเปิดโล่ง)

> GitHub ไม่รับประกันเวลา cron — 200 รอบล่าสุดห่างกันเฉลี่ย ~3.5 ชม. ไม่ใช่ 10 นาที
> ลูกค้าจ่ายตอนบริดจ์ล่ม อาจรอหลายชั่วโมงกว่า reconcile จะสั่งซ้ำ
>
> ชื่อเครื่องในข้อความเตือนอยู่ที่ `PRIMARY_NAME` / `BACKUP_NAME` ใน `bridge-health/route.ts`
> — ย้ายเครื่องบอทเมื่อไหร่ แก้ตรงนั้นด้วย (ข้อความบอกโฮสต์ที่เว็บยิงไปจริงด้วย)

**CI** (`.github/workflows/ci.yml`) — ยก Postgres ขึ้นมาแล้วรัน `npm ci` → migrate → unit test → UAT กับฐานจริง → build → lint
ต้องมี UAT เพราะตรรกะที่พลาดแล้วเสียเงินจริง (วันหมดอายุ ราคาโปร การล็อกราคา) ทดสอบได้แค่กับฐานข้อมูลจริง
Vercel preview บอกได้แค่ว่า build ผ่านไหม ไม่เคยรันเทสต์

**API อื่น**

| เส้นทาง | ทำอะไร |
|---|---|
| `POST /api/signals` | รับสัญญาณจาก TradingView Alert → ส่งเข้าห้อง Telegram ตาม timeframe + โชว์ Live Feed |
| `DELETE /api/signals` | `?id=` ลบทีละแถว (signal secret ได้) · `?all=true` ล้างทั้งตาราง **ต้องใช้ CRON_SECRET** |
| `POST /api/tradingview/callback` | บอทรายงานผล grant/revoke + รับภาพหลักฐาน `proof` ส่งเข้า DM ลูกค้า |
| `POST /api/telegram/webhook` | รับ `/start` (ผูกบัญชี) + `chat_join_request` (อนุมัติคนเข้ากลุ่ม) |
| `POST /api/webhooks/stripe` | Stripe webhook |
| `POST /api/checkout` · `/api/billing-portal` | Stripe |
| `/api/admin/slip/[id]` | ดูภาพสลิป (แอดมิน) |

### 4.5 งานใหม่จากเครื่องอื่น (26 ก.ย. 2569)

สรุปจาก commit message ของ 4 PR ยังไม่ได้เปิดโค้ดตรวจ

**ทางที่ 2 ได้อินดิเคเตอร์ — เปิดพอร์ตโบรก Wisdom แทนการจ่ายเงิน** (PR #7, #9)

- ลูกค้าส่งเลขบัญชีเทรดที่ `/account/wisdom` → แอดมินตรวจที่ `/admin/wisdom`
  (ปฏิเสธได้พร้อมเหตุผล 6 แบบ) → อนุมัติ · หน้าข้อมูลสาธารณะอยู่ที่ `/wisdom`
- อนุมัติแล้วเรียก `activateMembership` ตัวเดียวกับทางจ่ายเงิน แค่ยอด 0 บาท ช่องทาง `wisdom`
  ได้สิทธิ์ครบเท่าคนจ่ายเงิน (อินดิเคเตอร์ · Telegram · Discord) 1 เดือนตามปฏิทิน
- **ไม่กินที่นั่งโปร 300** เพราะไม่ใช่ช่องทางรายได้ จึงไม่สร้างแถว `Payment`
- กันแจกสิทธิ์ฟรีซ้ำ 4 ชั้น — จองคำขอด้วย `updateMany` · เช็กช่วงต่ออายุซ้ำตอนอนุมัติ ·
  `User.brokerAccountKey` unique ผูกตอนอนุมัติ · ไม่นับเป็นรายได้
- migration ใหม่ `20260926100000_broker_application`
- เป็นการรวมระบบที่น็อตทำแยกไว้เข้ามาใช้ฐานข้อมูลเรา (แก้บั๊กในระบบเดิมของน็อตไป 6 ข้อระหว่างรวม)

**`POST /api/entitlement`** (PR #7) — ให้ระบบ **QVX AI** ของพาร์ตเนอร์มาถามว่าใครมีสิทธิ์อยู่
เพราะระบบนั้นไม่มีงานตามเวลาปิดสิทธิ์เอง ถ้าไม่ถามที่นี่ สิทธิ์ฝั่งนั้นจะไม่มีวันหมด

- secret รับผ่าน `Authorization: Bearer` เท่านั้น · env ใหม่ **`PARTNER_API_SECRET`** ไม่ตั้ง = ปิดตาย (503)
- อีเมลที่ไม่มีในระบบตอบเหมือนคนหมดอายุทุกประการ กันไล่เช็กว่าใครเป็นลูกค้า
- คืนเฉพาะข้อเท็จจริงเรื่องสิทธิ์ ไม่มีชื่อ เบอร์ หรือข้อมูลการจ่ายเงิน

**`npm run discord:setup`** (PR #8) — สร้างห้องและยศในเซิร์ฟเวอร์ Discord ใหม่ของ QVX ตามสเปกน็อต

- ไม่ใส่อะไร = ดูแผนอย่างเดียว ไม่แตะเซิร์ฟเวอร์ · `npm run discord:setup -- --apply` = สร้างจริง
- รันซ้ำได้ ของที่มีแล้วไม่สร้างซ้ำ แต่ตั้งสิทธิ์ใหม่ให้ตรงสเปกทุกรอบ
- จบแล้วพิมพ์ Role ID ที่ต้องเอาไปตั้ง env ให้ และเตือนถ้ายศบอทอยู่ต่ำกว่า "QVX Active"

**เอกสาร** (PR #6)

- `docs/MIGRATE.md` — วิธีเปลี่ยนบัญชี TradingView ของบอท / เปลี่ยนบอท Telegram
  และ **ถ้าค่าลับหลุด ต้องเปลี่ยนอะไรบ้าง** (ใช้คู่กับหัวข้อ 8 ด้านล่าง)
- `docs/HANDOFF.md` ฉบับ 27 ส.ค. — **ถูกแทนด้วยไฟล์นี้แล้ว** ของที่ยังใช้ได้ย้ายมารวมไว้ที่นี่
  (ฉบับนั้นยังอ้างคอมเบสเป็นเครื่องบอทหลัก ซึ่งย้ายไปคอมเฟิร์สตั้งแต่ 28 ส.ค.)

---

## 5. ระบบภายนอกที่เชื่อมอยู่

### 5.1 บอท TradingView — ส่วนที่ซับซ้อนที่สุด

TradingView **ไม่มี API** สำหรับจัดการ invite-only ต้องใช้ **Selenium เปิด Chrome** ที่ล็อกอินบัญชีเจ้าของสคริปต์ค้างไว้
บอทอยู่คนละรีโป (`electiction/Bot-Tradingview`) และรันบนคอมที่บ้าน ไม่ใช่บน Vercel

**อ่าน `TRADINGVIEW.md` ก่อนแตะเรื่องนี้ทุกครั้ง** — กับดักเยอะมาก

| อะไร | ค่า 〔บันทึก〕 |
|---|---|
| เครื่องหลัก | **คอมเฟิร์ส** · Tailscale `desktop-8qjh30a` (100.111.137.19) · Windows user `oneye` · `C:\BotTV\` |
| บัญชี TradingView | `Pyro_Bolt` |
| สคริปต์ที่บอทจัดการ | "Test 2 SMC Unified Suite" — ⚠️ **ยังไม่ยืนยันว่าเป็นตัวจริงที่ลูกค้าต้องได้** |
| ทางออกอินเทอร์เน็ต | Cloudflare quick tunnel (URL สุ่มใหม่ทุกรีสตาร์ต) |
| ตัวคุม | `botkeeper` — ปลุกบริดจ์/tunnel ที่ตาย + **PATCH `TV_BOT_URL` บน Vercel ให้เองเมื่อ URL เปลี่ยน** |
| สำรอง | คอมเบส (ASUS) · server-254 |

**ส่งไฟล์เข้าเครื่องบอท** — SSH/SMB/WinRM ปิดหมด วิธีที่พิสูจน์แล้ว:
commit ไฟล์ลง `public/` → push → รอ deploy → บนเครื่องบอท `curl.exe -o C:\BotTV\<ไฟล์> https://quantvisionx.com/<ไฟล์>`
`print()` ในสคริปต์ต้องเป็น **ASCII ล้วน** (คอนโซลเป็น cp874) และ **ลบออกจาก `public/` เมื่อเสร็จ**

**ภาพหลักฐานสิทธิ์** — ฝั่งเว็บเสร็จ · ฝั่งบอทติดตั้ง patch แล้ว 31 ส.ค. 〔บันทึก〕
**grant ผ่านบอททดสอบแล้วใช้ได้** — DomeDev ได้ `EXPIRY_OK` ทั้งบน server-254 และคอมเฟิร์ส
(`TRADINGVIEW.md`) และเบสยืนยันว่าเคยทดสอบเปิดสิทธิ์แล้วได้จริง
ที่ยังไม่มีบันทึกผลคือ **ภาพหลักฐานสิทธิ์ถึง DM ลูกค้าไหม** (ดูค่า `proof` ที่ callback ตอบ)

### 5.2 Telegram 〔บันทึก〕

| อะไร | ค่า |
|---|---|
| บอท | `@TD_SMC_bot` (id 8670417011) — ตัวเก่า `@addminQVX_bot` เลิกใช้แล้ว |
| กลุ่มลูกค้า `TELEGRAM_CHAT_ID` | **TD_SMC** `-1003853407271` (supergroup, เปิด Topics) |
| กลุ่มแอดมิน `TELEGRAM_ADMIN_CHAT_ID` | **Testtool** `-1004382026522` |
| ห้องสัญญาณ | M5=14 · M15=15 · M30=16 · 1H=17 |
| webhook | `allowed_updates = ["message","chat_join_request"]` — ต้องมี `message` ไม่งั้น `/start` ไม่มา |

**⛔ ห้ามสลับสองกลุ่ม** — กลุ่มแอดมินมีข้อมูลภายใน ถ้าไปอยู่กลุ่มลูกค้า ลูกค้าจะเห็น

**กับดัก:** เพิ่มบอทเป็นแอดมินในกลุ่มธรรมดา Telegram อัปเกรดเป็น supergroup และ **chat id เปลี่ยนทันที**
หา id ใหม่: ยิง `sendMessage` ไป id เก่าแล้วอ่าน `parameters.migrate_to_chat_id` จาก error

ลำดับตั้ง webhook: ตั้ง env → deploy → ค่อย `setWebhook` (ไม่งั้น 401 ช่วงคาบเกี่ยว)
รันด้วย `NEXT_PUBLIC_SITE_URL=https://quantvisionx.com node scripts/telegram-webhook.mjs set`
(`.env` เครื่องนี้ชี้ localhost สคริปต์จะปฏิเสธ — อย่าแก้ `.env` ถาวร)

### 5.3 อื่น ๆ

| ระบบ | ใช้ทำอะไร | เอกสาร |
|---|---|---|
| **Resend** | อีเมล (REST ตรง ไม่เพิ่ม dependency) · ผู้ส่ง `QVX <no-reply@quantvisionx.com>` | `docs/EMAIL.md` |
| **Discord** | ให้ยศตามแพ็กเกจ · webhook ต้องใช้ `discord.com` ไม่ใช่ `discordapp.com` (โดน Cloudflare 1010) | `docs/DISCORD.md` |
| **EasySlip** | ตรวจสลิปอัตโนมัติ (ไม่บังคับ) + ตรวจผู้รับเงิน/ความสดของสลิป | `docs/SLIP.md` |
| **Stripe** | ทางเลือกชำระเงิน — ค่าเริ่มต้นคือ QR (`NEXT_PUBLIC_PAYMENT_MODE` ไม่ตั้ง = `"qr"`) | `docs/PAYMENTS.md` |

---

## 6. ราคา — จุดที่ผิดแล้วเสียหายทางกฎหมาย

| ค่า | ที่อยู่ |
|---|---|
| **Founding 300** — ราคาโปร **฿999/เดือน** สำหรับ 300 คนแรก | `src/config/plans.ts` → `MONTHLY_PROMO` |
| ราคาปกติ **฿1,290/เดือน** | `MONTHLY_REGULAR` |
| จำนวนที่นั่ง **300** | `PROMO_SEATS` |
| แพ็กเกจ 1 / 3 / 6 / 12 เดือน | `plansFor(monthlyTHB)` |

ราคาบนเว็บ **คำนวณสด** จาก `getPromoState()` (`src/lib/pricing.ts`) ซึ่งนับสมาชิกที่จ่ายเงินจริง
ครบ 300 เมื่อไหร่ เว็บเปลี่ยนเป็น ฿1,290 เองทุกจุด · DB ล่ม → ถือว่าโปรเต็ม (ปลอดภัยต่อลูกค้า)

**ล็อกราคา** — สมาชิก Founding ได้ราคาเดิมตลอดตราบที่ต่ออายุต่อเนื่อง
ขาดอายุเกิน `PRICE_LOCK_GRACE_DAYS` (7 วัน) = เสียราคาล็อก
**ยกเว้น** คนที่จ่ายก่อน `PRICE_LOCK_RULE_EFFECTIVE` (30 ส.ค. 2569) ได้ล็อกถาวร
หลักการ: **"พิสูจน์ไม่ได้ = ไม่ริบ"** ข้อมูลไม่ชัดเมื่อไหร่ เอื้อลูกค้าเสมอ

---

## 7. กฎที่ห้ามละเมิด

| กฎ | เหตุผล |
|---|---|
| **ห้าม commit Pine Script** — `*.pine` · `/pine/` · `SMC Unified.txt` · `SMC suit strategy.txt` · `Change SL.txt` · `.pine-backup/` | เป็นซอร์สอินดิเคเตอร์ที่ขายอยู่ เข้า git แล้วลบยาก และหลุดได้ถ้ารีโปเปลี่ยนเป็น public |
| **ทุกไฟล์ใน `public/` = เปิดสาธารณะ** ห้ามวางต้นฉบับ แคช หรือสคริปต์ที่มีความลับ | ต้นฉบับสื่อเก็บที่ `media-src/` (gitignore แล้ว) |
| **ห้ามลบหน้า `/refund` และข้อ 4 ในหน้านั้น** แม้ดูเหมือนโค้ดตาย | การขายออนไลน์ต้องเปิดเผยเงื่อนไขคืนเงิน · ข้อ 4 คุ้มครองคนที่จ่ายเงินก่อนยกเลิกนโยบายคืนเงิน 7 วัน |
| **ห้ามเลื่อน `PRICE_LOCK_RULE_EFFECTIVE` ไปข้างหน้า** | จะริบสิทธิ์ล็อกถาวรของกลุ่มที่ได้รับคำสัญญาไว้แล้ว |
| **ห้ามทำตัวเลขผลตอบแทน backtest ปลอม หรือรีวิวปลอม** | กฎหมายคุ้มครองผู้บริโภคไทย |
| **สื่อกราฟทุกชิ้นเป็น Bar Replay** ห้ามพาดหัวว่าเป็นผลเทรดจริง | ข้อความกำกับอยู่ที่ `mediaNote` ใน `src/config/guide.ts` |
| **ห้ามทับไฟล์ภาพชื่อเดิม** ต้องตั้งชื่อใหม่ (`-v4`, `-v5`) แล้วแก้ path | Next.js แคชภาพตาม URL ทับชื่อเดิมแล้วยังได้ภาพเก่า |
| **ห้ามจัดการรหัสผ่าน TradingView ของเจ้าของสคริปต์** | |
| **อย่าทิ้ง `.env.production.local` ไว้ในเครื่อง** หลังดึงค่ามาใช้ | มีความลับ production |

---

## 8. ค้างอะไรอยู่ — เรียงตามความเร่งด่วน

### 🔴 ความปลอดภัย (ควรทำก่อน) 〔บันทึก〕

| เรื่อง | ต้องทำ |
|---|---|
| **token บอท Telegram หลุดในแชท** (29–30 ส.ค.) ทั้ง `@addminQVX_bot` และ `@TD_SMC_bot` | `/revoke` ใน BotFather แล้วตั้งค่าใหม่บน Vercel + `setWebhook` ใหม่ |
| **รหัสแอดมิน `notnottrade` หลุดในแชท** (30 ส.ค.) | เปลี่ยนที่ `/admin/settings` |
| **`TV_BOT_SECRET` หลุด** — โผล่ในแชท และเคย `type .env` แล้วแคปหน้าจอ (27 ส.ค.) · บริดจ์เปิดออกอินเทอร์เน็ต และเคยเห็นบอทสแกนยิงเข้ามาใน log | หมุนใหม่ทั้งฝั่ง Vercel และ `.env` บนเครื่องบอท (ต้องตรงกัน ไม่งั้น 401) · ใครถือ secret นี้สั่งแจก/ถอนสิทธิ์อินดิเคเตอร์ได้หมด · สุ่มด้วย `openssl rand -hex 32` |
| **รหัส TradingView ของบัญชีเจ้าของสคริปต์ + `INDICATOR_API_KEY`** หลุดชุดเดียวกับข้างบน (27 ส.ค.) | เจ้าของเปลี่ยนรหัส TradingView เอง (Claude ไม่จัดการรหัสนี้) แล้ว**ต้องล็อกอินใหม่ในโปรไฟล์ Chrome ของบอทบนเครื่องบอท** ไม่งั้นบอทหลุด · สุ่ม `INDICATOR_API_KEY` ใหม่ |

ขั้นตอนเปลี่ยนแต่ละตัวอยู่ใน `docs/MIGRATE.md` หัวข้อ "ถ้าค่าลับหลุด ต้องเปลี่ยนอะไรบ้าง"

### 🟠 กระทบลูกค้าโดยตรง

**ภาพขั้นตอนที่ 2 บนหน้าแรกฝังราคา ฿999 ลงในภาพ** ⚠️ ขึ้น production แล้ว
`public/images/how-it-works/site-capture-infographic-v4/qvx-step-02-package.webp`
แสดง ฿999 / ฿2,890 / ฿5,590 / ฿10,790 เป็นพิกเซล — **ครบ 300 ที่นั่งเมื่อไหร่ เว็บเปลี่ยนเป็น ฿1,290
แต่ภาพยังบอก ฿999** = โฆษณาราคาที่ไม่ได้ขายจริงแล้ว
แก้: ทำภาพใหม่ที่ไม่มีตัวเลขราคา ปล่อยให้ราคาอยู่ในหัวข้อราคาที่อัปเดตเอง

**บริดจ์ทั้งสองตัวเว็บยิงไม่ถึงมาหลายสัปดาห์** (ดูตารางหัวไฟล์) — ลูกค้าที่จ่ายตอนนี้จะไม่ได้สิทธิ์อัตโนมัติ
ต้องเปิดคอมเฟิร์สให้ botkeeper อัปเดต `TV_BOT_URL` หรือแก้ `TV_BOT_URL_BACKUP` ให้ชี้คอมเบส

**ภาพหลักฐานสิทธิ์ถึง DM ลูกค้าไหม ยังไม่มีบันทึกผล** — ตัว grant เองทดสอบผ่านแล้ว (หัวข้อ 5.1)

**ยืนยันว่า "Test 2 SMC Unified Suite" คือสคริปต์ตัวจริง** ที่ลูกค้าต้องได้ ก่อนเปิดขายจริงจัง

### 🟡 ควรทำ

| เรื่อง | รายละเอียด |
|---|---|
| **`max-w-*` ใช้ไม่ได้ 4 หน้า** | `.container-x` อยู่นอก `@layer` จึงชนะ utility ของ Tailwind ทุกตัว → `max-w-3xl` ไม่มีผล หน้ากฎหมาย (`LegalShell`) กางเต็ม 1180px ทั้งที่ตั้งใจ 768px บรรทัดยาวเกินอ่านสบาย · หน้าที่โดน: `/features/[slug]` `/features` `/guide` `LegalShell` · **ถ้าแก้ ต้องแก้ `sizes` ของภาพให้ตรงด้วย** (ตอนนี้ตั้งตามความกว้างจริง 1140px) |
| **สคริปต์ชั่วคราว 3 ตัวค้างใน `public/`** | `botpatch.py` · `botpeek.py` · `tvshot.py` — ตรวจแล้วไม่มี secret แต่เปิดเผยโครงสร้างเครื่องบอท ติดตั้งเสร็จแล้วจึงลบได้เลย |
| **ภาพฟีเจอร์ 3 ใบต้นทางเล็ก** | Supertrend · EMA200 · Rejection Block ต้นทางแค่ 960px หาต้นฉบับไม่เจอ ต้องแคปใหม่ (ขอกว้าง ≥2280px) |
| **สคริปต์ `db:status-audit` ยังไม่เคยรันกับ production** | ต้องทำก่อนแปลงคอลัมน์ status เป็น enum ไม่งั้น migrate อาจล้มแล้ว deploy พังทั้งเว็บ |
| **ตรวจ migration `20260829120000_payment_unique_ref_and_indexes`** | รัน `SELECT * FROM "Payment" WHERE "providerRef" LIKE '%:dup:%'` ดูว่ามีแถวซ้ำถูกทำเครื่องหมายไหม |
| **ข้อมูลติดต่อหน้า `/privacy` ไม่ครบ** (PDPA) | ยังไม่ได้ตั้ง `NEXT_PUBLIC_CONTACT_EMAIL` · `NEXT_PUBLIC_LINE_OA_URL` · `NEXT_PUBLIC_LEGAL_ENTITY_NAME` บน production |

### ⚪ ค้างเล็ก / ไอเดีย

- **ตัวเลข backtest ยังไม่ได้เผยแพร่** — `src/config/stats.ts` ยัง `published: false` (ตรวจแล้ว) หัวข้อนี้เลยซ่อนอยู่
  เจ้าของมีตัวเลขจริงแล้ว 〔บันทึก 27 ส.ค.〕: PnL +10,585.56 (+10.59%) · MaxDD 14,168.53 (11.94%) ·
  Win 72.07% (1633/2266) · Avg W/L 1.071 · XAUUSD 5m OANDA · 3 ส.ค. 2024 – 26 ส.ค. 2026 · ทุน 100K
  **ยังขาด Profit Factor** — ได้ครบแล้วค่อยกรอกและตั้ง `published: true` ห้ามเติมตัวเลขเอง
- ยังไม่มีระบบเก็บ error (Sentry ฯลฯ) 〔บันทึก〕
- `countPaidMembers` ดึงทั้งตารางมานับ (มี ISR 5 นาทีคุมอยู่) 〔บันทึก〕
- `maxDuration=300` ของ cron expire อาจถูกตัดเหลือ 60 บน Hobby — ยืนยันไม่ได้ 〔บันทึก〕
- ฟีเจอร์ 6 ตัวยังไม่มีภาพ (HTF · Confluence Score · Zone Lifecycle · PPDD OB · HVB · Stacked OB+FVG)
- สีโลโก้ `#00A747` ไม่ตรงเขียวแบรนด์ `#6EE34A` · ควรมีโลโก้ SVG
- ไอเดีย: discount code · affiliate · บล็อก SEO 〔บันทึก〕
- บริดจ์ควรย้ายไปเครื่องที่เปิด 24 ชม. / VPS 〔บันทึก〕

---

## 9. กับดักที่เจอมาแล้ว — อย่าเสียเวลาซ้ำ

### build / เครื่อง

- **`next build` ล้ม exit `3221226505`** ที่เฟส "Collecting page data" — ไม่ใช่บั๊กโค้ด
  เป็น pagefile แค่ 8 GB กับ 15 worker · แก้ชั่วคราว: ใส่ `cpus: 2` ใน `experimental` ของ `next.config.ts` (**อย่า commit**)
  หรือเช็กเร็ว ๆ แทน build: `npx tsc --noEmit` + `npx vitest run`
- **`prisma:error` โผล่ตอน build ในเครื่อง** = ไม่มี Postgres ที่ `localhost:5433` · `getPromoState()` มี catch รองรับ ไม่ทำให้ build ล้ม
- **`npx prisma generate` หลัง pull ทุกครั้ง** — Prisma client ที่ค้างทำ `next build` แดงทั้งที่ `npm test` เขียว
  (vitest ไม่ type-check) · **รอบนี้เพิ่ง pull migration ของ Wisdom มา ต้องทำก่อน build**
- **Prisma CLI อ่านแค่ `.env` ไม่อ่าน `.env.local`** — `npm run setup` เลยเขียนลง `.env`
- **ฐานข้อมูลที่ Vercel ต้องต่อถึง ห้ามอยู่หลัง Tailscale/VPN** — `prisma migrate deploy` ตอน build จะล้ม preview ทุก PR พัง
- **CI ใช้ฐานชื่อ `qvx_test` โดยตั้งใจ** — `uat/guard.ts` ยอมรันเฉพาะฐานที่อยู่ localhost หรือชื่อมี `uat`/`test` กันเผลอรัน UAT ใส่ production
- **ห้ามรัน `npm run db:seed` ชี้ production** — seed ตอนนี้ปลอดภัยแล้ว (รีวิวตัวอย่างต้องสั่ง `SEED_SAMPLE_REVIEWS=true` และสร้างแบบยังไม่อนุมัติ)
  แต่สำเนาเก่าของรีโปเคยใส่รีวิวปลอมแบบอนุมัติแล้ว = ผิด พ.ร.บ.คุ้มครองผู้บริโภค ตรวจ `DATABASE_URL` ก่อนรันเสมอ
- **`npm run admin` ต่อ production** — `DATABASE_URL='<connection string จริง>' npm run admin` ครอบ single quote
  กัน shell ตีความ `$` `&` ในรหัส และต้องวางค่าจริง ไม่ใช่ข้อความตัวอย่าง
- **Git Bash อาจพังกลางเซสชันยาว** (`fork: Resource temporarily unavailable`) → ใช้ PowerShell แทน
- **PowerShell อ่านไฟล์ไทยเพี้ยน** → ใส่ `[Console]::OutputEncoding = [Text.Encoding]::UTF8` + `Get-Content -Encoding UTF8`
- **ffmpeg filter แตกกับพาธ `C:\...`** (โคลอนชนตัวแยกพารามิเตอร์) → ใช้พาธสัมพัทธ์

### ค่าลับ

- ดูว่าตั้ง env ครบไหมโดยไม่โชว์ค่า: `grep -o '^[A-Z_]*=' .env`
- **ห้าม `cat .env` / `type .env` แล้วแคปหน้าจอ** — หลุดมาแล้วหนึ่งรอบ (ดูหัวข้อ 8)
- env บน Vercel ตั้งเป็น sensitive — `vercel env pull` ได้แค่ `[SENSITIVE]` อ่านค่าจริงกลับไม่ได้ 〔บันทึก〕
  ถ้าต้องตั้ง webhook ที่ต้องใช้ secret เดิม ต้องหมุนค่าใหม่แทน

### คอมเบส (เครื่องบอทสำรอง)

- ปลุกด้วย magic packet ต้องยิงจาก**ในบ้าน** — `~/sentiara-ai/scripts/mac/combase.sh wake` (ผ่านกล่อง x96)
  ถ้าต่อ tailnet ไม่ได้ (เช่นเน็ตมหาลัยบล็อก Tailscale) พิมพ์ `/wol` ในบอท Telegram ที่กล่อง x96 คอยฟัง
  (x96 poll Telegram เฉพาะตอน PC หลักดับ ซึ่งก็คือตอนที่ต้องใช้พอดี) 〔บันทึก 27 ส.ค.〕
- กับดักการรันบริดจ์บนคอมเบส (`schtasks`, python path เต็ม, log, Last Result) อยู่ใน `docs/TRADINGVIEW.md` ครบแล้ว

### โค้ด

- **`cn()` ในโปรเจกต์นี้คือ `clsx` เฉย ๆ ไม่มี tailwind-merge** — class ที่ขัดกันอยู่รอดทั้งคู่ ต้องใช้ prop แทนการ override className
- **ห้ามใส่คอมเมนต์ JSX `{/* */}` ข้าง root element หรือใน `cond && (...)`** → TS1005/TS2657 · ใช้ `//` เหนือ `return` แทน
- **`sizes` ของ `<Image>` ต้องตรงกับความกว้างที่วางจริง** วัดจากเบราว์เซอร์ ไม่ใช่อ่านจาก class — เคยประกาศ 768px ทั้งที่จริง 1138px ภาพเลยเบลอทั้งเว็บ
- **idempotency ใช้ `@unique` + จับ P2002** ไม่ใช่ findFirst แล้วค่อย create (race ได้)
- **login ด้วย username:** `authorize()` กับ `loginUser()` เลือกคอลัมน์จากว่ามี `@` ไหม — **ต้องแก้ทั้งสองที่เสมอ** ช่องกรอกต้องเป็น `type="text"`
- **ปลดผูก Telegram ล้างแค่ `User.telegramUserId`** ห้ามแตะ `TelegramGrant.telegramUserId` (cron ใช้ตัวนั้นเตะคนออก)

### ภาพ / สื่อ

- **พื้นหลังภาพกราฟทุกใบในเว็บ = RGB 8** · ภาพที่น็อตส่งมามักเป็น 15 ต้องกดด้วยเส้นโค้ง
  `curves=all='0/0 0.06/0.034 0.25/0.24 1/1'` (ตัวเดียวกับที่ใช้ทั้งเว็บ)
- **ภาพฟีเจอร์ทำที่ 2280px** (= 2 เท่าของช่อง 1140px) ด้วย lanczos + unsharp ให้เบราว์เซอร์ย่อแทนขยาย
- **เปิด AVIF แล้ว** (`images.formats` ใน `next.config.ts`) — 2048px ได้ไฟล์เล็กกว่า WebP 1200px เดิม
- **Google Drive ของน็อต** — MCP connector list ไฟล์ในโฟลเดอร์ไม่ได้ ใช้ `https://drive.google.com/embeddedfolderview?id=<ID>#list` ในเบราว์เซอร์ แล้วโหลดด้วย `curl -sL "https://drive.google.com/uc?export=download&id=<ID>"` · โฟลเดอร์ "QVX" id `1CAwlBwW5xCixnxKpbhdsrtyiObtDr3eo`

---

## 10. งานที่เสร็จไปแล้วช่วงหลัง (ตามลำดับ)

| ช่วง | งาน |
|---|---|
| 27 ส.ค. | แก้บั๊กเงิน 2 ตัว — ราคาโปรใน JSON-LD ไม่ตรงราคาบนหน้า (Google ตัด rich result) · คนที่ได้ที่นั่งโปรที่ 300 หลุดการล็อกราคาเพราะนับที่นั่งรวมตัวเอง (มี UAT `P-1` กัน) · เพิ่ม `npm run setup` / `npm run admin` · CI · ปุ่ม "สั่งบอท" |
| 28–29 ส.ค. | ดีไซน์ V4–V8 · กรอบการ์ดเขียวทั้งเว็บ · Hero เป็นการ์ดสรุปสินค้า · **ยกเลิกนโยบายคืนเงิน 7 วัน** (มีผลไปข้างหน้า มีข้อคุ้มครองคนเก่า) |
| 29 ส.ค. | ล็อกราคาหมดอายุเมื่อขาดต่อ + grandfather · ป้ายโปรไฟล์สมาชิก · `Payment.providerRef` unique กันบันทึกเงินซ้ำ · รวมค่า status ไว้ที่ `src/config/status.ts` |
| 30 ส.ค. | **แก้ภาพเบลอทั้งเว็บ** (`sizes` ผิด + `object-cover` ครอป) · ภาพใหม่ 4 ใบจากน็อต · ภาพทุกใบ 2280px · AVIF · เอาคลิปชุด A/B/C ออกจาก `/guide` · ลบสื่อที่ไม่ใช้ 24 MB · **คลิป Hero ใหม่** ต้นฉบับ 5634×2160 ไม่มีลายน้ำ "การเล่นซ้ำ" |
| 30 ส.ค. | ล็อกอินด้วย username · หน้า `/admin/settings` · security header กัน clickjacking · กัน `DELETE /api/signals?all` |
| 31 ส.ค. | rate limit (login/register/reset) · timeout 10 วิ ทุก fetch ภายนอก · transaction ตอนเปิดสิทธิ์ · ภาพหลักฐานสิทธิ์ส่งเข้า DM · ภาพ 4 ขั้นตอนเป็นอินโฟกราฟิก · patch บอท · ปุ่มปลดผูก Telegram |
| 1 ก.ย. | ไดรฟ์ D: ของเครื่อง dev เสีย — กู้ทุกโปรเจกต์ไป `E:\d-rescue` |
| 26 ก.ย. | (จากเครื่องอื่น โดย `electiction`) ช่องทาง Wisdom · `POST /api/entitlement` · สคริปต์โครง Discord · `docs/MIGRATE.md` — รายละเอียดหัวข้อ 4.5 |
| 26 ก.ย. | อัปเดตสถานะบริดจ์ใน `docs/TRADINGVIEW.md` (`013eba3`) |

**เทส** 〔บันทึก〕: unit 66 + UAT 10 ผ่านทุกครั้งที่รันล่าสุด

---

## 11. เอกสารอยู่ไหน

| ไฟล์ | เรื่อง |
|---|---|
| `docs/TRADINGVIEW.md` | บอท TradingView ทั้งหมด — กับดักเยอะที่สุดในโปรเจกต์ |
| `docs/MIGRATE.md` | เปลี่ยนบัญชี TradingView / บอท Telegram · ค่าลับหลุดต้องเปลี่ยนอะไร |
| `docs/SETUP.md` | ตั้งค่าเครื่อง dev + วิธีเปิด Postgres ด้วย Docker สำหรับ UAT |
| `docs/TELEGRAM.md` | บอท/กลุ่ม/webhook/ผูกบัญชี |
| `docs/LIFECYCLE.md` | วงจรสมาชิก |
| `docs/PAYMENTS.md` · `docs/SLIP.md` | ชำระเงิน + ตรวจสลิป |
| `docs/DISCORD.md` · `docs/EMAIL.md` · `docs/ADMIN.md` | ระบบย่อย |
| `docs/DESIGN-VERSIONS.md` | ประวัติเวอร์ชันดีไซน์ V4–V8 |
| `public/images/features/README.txt` | สเปกภาพฟีเจอร์ + วิธีทำภาพใหม่ |
| `public/images/how-it-works/README.txt` | ภาพ 4 ขั้นตอน |
| `design-handoff/prompts-4-steps.md` | พรอมต์เจนภาพ 4 ขั้นตอน |
| `src/config/guide.ts` (คอมเมนต์หัวไฟล์ + `heroClip`) | ประวัติการเข้ารหัสคลิป + คำสั่ง ffmpeg |
| `.env.example` | รายชื่อ env ทั้งหมดพร้อมคำอธิบาย |

**ความจำของ Claude** — Claude Code ผูกโฟลเดอร์ความจำกับพาธของโปรเจกต์
เปิดเซสชันที่ `E:\d-rescue\WebPeeNOT` จะใช้โฟลเดอร์
`C:\Users\DomeCB\.claude\projects\E--d-rescue-WebPeeNOT\memory\`

ก๊อปความจำชุดเดิม (จาก `D--WebPeeNOT`) ไปไว้ที่นั่นแล้วเมื่อ 26 ก.ย. 2569 — 9 ไฟล์ ตรวจ hash ตรงทุกไฟล์
**จากนี้ให้ถือชุดของ E: เป็นหลัก** ชุดเดิมบน `D--WebPeeNOT` เก็บไว้เป็นสำรอง ไม่ต้องอัปเดตตาม
