# QVX AI

ผู้ช่วยความรู้การเทรดในหน้าสมาชิก `/account/ai` — ย้ายมาจากระบบแยกของน็อต
(ChatGPT site + Supabase `jfpcqrouklzxqqefwmwd` + OpenAI) มาอยู่ในเว็บนี้ ใช้ฐานข้อมูล Neon ตัวเดียวกัน

## ใครใช้ได้

| ใคร | ใช้ได้ไหม |
|---|---|
| สมาชิกที่สิทธิ์อินดิเคเตอร์ยังไม่หมดอายุ (จ่ายเงิน หรือรับผ่าน Wisdom) | ✅ |
| สมาชิกที่หมดอายุแล้ว | ❌ ล็อกทันที ไม่ต้องรอ cron |
| แอดมิน | ✅ เสมอ (ไว้ทดสอบ) |

ไม่มีตารางสิทธิ์ AI แยก — ตัดสินจาก `getUserSubscription()` ทุกครั้งที่ถาม
ของเดิมบน Supabase เปิดแล้วไม่มีวันหมด เพราะไม่มีอะไรไปปิดให้

**โควตา** 300 คำถามที่ตอบสำเร็จต่อเดือนปฏิทิน (เที่ยงคืนวันที่ 1 เวลาไทย) · ถามแล้ว AI พังไม่นับ
· กันกดรัว 8 ครั้ง/นาที/คน · ค่าทั้งหมดอยู่ใน `src/config/ai.ts`

## เปิดใช้งาน — ตั้งบน Vercel

| ตัวแปร | ต้องตั้ง | หมายเหตุ |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | key ของบัญชี QVX เอง · ไม่ตั้ง = หน้าแชตขึ้นว่า "กำลังเตรียมเปิดให้บริการ" |
| `OPENAI_MODEL` | ไม่ต้อง | ว่าง = `gpt-6-luna` ตัวที่น็อตทดสอบบน production แล้ว |
| `MARKET_WEBHOOK_TOKEN` | ถ้าจะให้ AI เห็นราคาสด | `openssl rand -hex 32` · ไม่ตั้ง = `/api/market/snapshot` ตอบ 503 |
| `OPENAI_BASE_URL` | เฉพาะเมื่อใช้ Grok | Grok (xAI) ใช้ API แบบเดียวกัน: `https://api.x.ai/v1` + `OPENAI_MODEL=grok-4.3` + key ของ xAI |

ตั้งแล้วต้อง redeploy ถึงมีผล

## ความรู้เรื่องอินดิเคเตอร์

`src/lib/ai/knowledge.ts` — สรุปจาก "คู่มือการใช้งาน QVX" (25 หน้า) ฟีเจอร์ สี ลำดับการวิเคราะห์ ค่าที่แนะนำ ห้อง Telegram
และความหมายของทุกช่องใน `qvx` ที่อินดิเคเตอร์ส่งมา (gold_buy = Buy/Sell Scalping · ict_buy = ICT Buy · zones.kind OB/FVG/SD/RJB · state)
ต่อท้ายคำสั่งของน็อตตอนส่งให้โมเดล — คำสั่งของน็อตไม่ได้แก้ · **ไม่มีโค้ด Pine ในรีโป** (กฎห้าม commit Pine)

## ราคาสด — ย้าย webhook ของ TradingView มาที่นี่

อินดิเคเตอร์ **QVX AI** (สคริปต์ส่วนตัวของน็อต แยกจาก Test 2 ตัวที่ขาย) ส่งข้อมูลตลาดทุก ~20 วินาที
ตอนนี้ alert ยังยิงไป Supabase ของน็อต ต้องเปลี่ยนที่ TradingView:

1. เปิด alert ของ QVX AI → Notifications → Webhook URL
   เปลี่ยนเป็น `https://quantvisionx.com/api/market/snapshot`
2. ในอินดิเคเตอร์ ตั้ง token ให้ตรงกับ `MARKET_WEBHOOK_TOKEN` (ตัวใหม่ ไม่ใช้ของ Supabase ซ้ำ)
3. **ต้องลบ alert แล้วสร้างใหม่** ถ้าแก้ตัวสคริปต์ — alert เก่าจำสคริปต์เวอร์ชันเดิม

รูปแบบ payload เหมือนเดิมทุกอย่าง (`schema_version: 1`, `event: "market_snapshot"`) ไม่ต้องแก้ Pine
ต่างจากของเดิมข้อเดียว: **รับแท่งที่ยังไม่ปิดด้วย** (ของเดิมในโค้ดรับเฉพาะ `confirmed: true`
แต่บันทึกของน็อตบอกว่าตัวส่งส่งแท่งที่ยังวิ่งทุก 20 วินาที และคำสั่ง AI รองรับอยู่แล้ว)

**ข้อมูลใช้ได้นานเท่าหนึ่งแท่งของกราฟ + 5 นาที** (ไม่ต่ำกว่า 15 นาที ไม่เกิน 65 นาที)
อินดิเคเตอร์ส่งตอนแท่งปิด (`ส่งเมื่อแท่งปิดเท่านั้น` เปิดเป็นค่าเริ่มต้น) — alert บนกราฟ M30 ส่งทุก 30 นาที ใช้ได้ 35 นาที
เก่ากว่านั้น AI จะบอกว่าวิเคราะห์ "ตอนนี้" ไม่ได้ · โซนที่ส่งมาเป็นของ TF กราฟ (`chart_tf`) — กราฟ M30 ได้โซน M30

ตรวจแล้วว่ารูปแบบที่ `QVX_AI.pine` ส่ง (schema 1 · timeframes M1–D1 · ค่า null · ขนาด ~4 KB) ผ่านตัวรับของเว็บทุกช่อง

เช็กว่าข้อมูลเข้าไหม (ฐาน production):

```sql
select "tickerId", "chartTf", confirmed, "receivedAt" from "MarketSnapshot" order by "receivedAt" desc;
```

## โครงสร้าง

| ไฟล์ | ทำอะไร |
|---|---|
| `src/lib/ai/chat.ts` | ตัดสินสิทธิ์ · จองโควตา · ประวัติ 12 ข้อความ · เรียกโมเดล · บันทึก |
| `src/lib/ai/instructions.ts` | คำสั่งประจำตัว AI — **ยกของน็อตมาทั้งก้อน** ไม่ได้แก้เนื้อหา |
| `src/lib/ai/openai.ts` | เรียก OpenAI Responses API |
| `src/lib/ai/market.ts` | ตรวจ payload จาก TradingView · สร้างบริบทตลาดให้โมเดล |
| `src/app/api/ai/chat/route.ts` | หน้าแชตเรียกทางนี้ |
| `src/app/api/market/snapshot/route.ts` | webhook จาก TradingView |
| `src/app/account/ai/page.tsx` + `components/account/AiChat.tsx` | หน้าแชต |

ตาราง: `AiConversation` · `AiMessage` · `AiUsage` (หนึ่งแถวต่อคำถาม ใช้นับโควตาและดูค่า token) · `MarketSnapshot`

**ทำไมจองโควตาก่อนถาม** — สร้างแถว `PENDING` ก่อนเรียกโมเดล แล้วค่อยนับ
ยิงพร้อมกันหลายคำขอตอนเหลือโควตาข้อสุดท้ายจะเห็นกันและกัน ไม่หลุดเกิน · ค้างเกิน 5 นาทีถือว่าตาย ไม่นับ

## ดูค่าใช้จ่าย

```sql
select date_trunc('day', "createdAt") d, count(*) q, sum("inputTokens") i, sum("outputTokens") o
from "AiUsage" where status = 'SUCCESS' group by 1 order by 1 desc limit 30;
```

## ต่างจากของเดิมของน็อต

| เรื่อง | ของเดิม (Supabase) | ที่นี่ |
|---|---|---|
| สิทธิ์ | ตาราง `ai_entitlements` เปิดแล้วไม่หมด | ตามสมาชิกภาพจริง หมดพร้อมอินดิเคเตอร์ |
| บัญชีผู้ใช้ | Supabase Auth แยก ต้องสมัครอีกรอบ | บัญชีเดียวกับเว็บ |
| จำบทสนทนา | หน้าเว็บไม่ส่ง `conversation_id` → ไม่จำ | จำ 12 ข้อความล่าสุด มีประวัติแชต |
| นับโควตา | อัปเดตตัวนับหลังตอบ (ยิงพร้อมกันหลุดเกินได้) | จองก่อนถาม |
| ค่า OpenAI | บัญชีน็อต | บัญชี QVX |

**Supabase ของน็อตยังรันอยู่** — ปิดหรือไม่เป็นเรื่องของน็อต หลังย้าย webhook แล้วฝั่งโน้นจะไม่มีราคาสดเข้า

## ทดสอบ

```bash
npm test                 # src/lib/__tests__/ai.test.ts — เวลาไทย · อ่านคำตอบ · ตรวจ payload
npm run test:uat         # uat/ai.uat.ts — ใช้โมเดลปลอม ไม่เรียก OpenAI จริง
```

ทดสอบหน้าแชตในเครื่องโดยไม่ใช้ key จริง: เปิดเซิร์ฟเวอร์จำลองที่ตอบรูปแบบเดียวกับ Responses API
แล้วตั้ง `OPENAI_API_KEY=อะไรก็ได้` + `OPENAI_BASE_URL=http://127.0.0.1:<พอร์ต>/v1` ใน `.env.development.local`
(ลบไฟล์ทิ้งเมื่อเสร็จ)
