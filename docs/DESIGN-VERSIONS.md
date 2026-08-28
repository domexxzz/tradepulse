# เวอร์ชันหน้าตาเว็บ และวิธีหยิบกลับมาทีละชิ้น

ทุกเวอร์ชันเก็บไว้ใน git หมด ย้อนไปมาได้ตลอด ไม่มีอันไหนหายไป
เจ้าของโปรเจกต์เรียกเวอร์ชันด้วยชื่อสั้น (V4 / V5) เวลาสั่งงาน ไม่ได้เรียกด้วย commit hash

| ref | คืออะไร | commit |
|---|---|---|
| `v5` | **ตัวที่ deploy อยู่ตอนนี้** — V4 + ภาพชุด SMC / Gold / ICT พื้นหลังเข้มเท่าภาพในฟีเจอร์ | `0ecff3a` |
| `v4` | หัวหน้าเว็บเป็นการ์ดสรุปสินค้า + บล็อกโปร Founding 300 + กรอบการ์ดเขียวทั้งเว็บ | `3a6d8b4` |
| `v1-classic` | หน้าตาแบบเดิมก่อนรื้อ | `33666f4` |
| `v2-redesign` | ดีไซน์ใหม่เต็มรูปแบบ (ไม่ได้ใช้) | `72165ad` |
| `v2-redesign-trimmed` | ดีไซน์ใหม่ + ตัดสัญญาณสด / รับประกัน 7 วัน / เครื่องมือขั้นสูง | `d72bfa4` |
| `design/v2-redesign` | branch ชี้ที่ `d72bfa4` — เอาไว้ checkout ทำงานต่อได้เลย | |

## V5 มีอะไรบ้าง (นับจาก V4)

ภาพนิ่งทุกใบทั้งเว็บพื้นหลังอยู่ที่ RGB 8 เท่ากันหมด — เข้มกว่าพื้นการ์ด (`--surface`
= 12,18,14) ภาพจึงยุบลงไปดูเป็นจอ ใช้เส้นโค้งสองชุดเพราะต้นฉบับพื้นไม่เท่ากัน:

```
ภาพฟีเจอร์ 12 ใบ + smc/ict   bg 15 -> 8   curves=all='0/0 0.06/0.034 0.25/0.24 1/1'
gold-suite                    bg 19 -> 8   curves=all='0/0 0.075/0.031 0.26/0.245 1/1'
```

⚠️ ยังเหลือ `public/videos/qvx-hero.mp4` กับ poster ที่ยังเป็น RGB 15 — เป็นสื่อ
ชิ้นเดียวในเว็บที่ยังสว่างกว่าที่อื่น ไม่ได้แก้เพราะต้องเข้ารหัสวิดีโอใหม่ทับของที่จูนมาแล้ว

## V4 มีอะไรบ้าง

- หัวหน้าเว็บเป็นการ์ดสรุปสินค้า (`HeroCard` + `ProductCard asHero`) แทน Hero เดิม
- บล็อกโปร Founding 300 (`PromoCard`) ทั้งบนหน้าแรกและในหน้าราคา
- กรอบการ์ดเขียวนุ่มทั้งเว็บ (`.card-frame` + โทเคน `--border` / `--border-card`)
- โซนราคาโชว์ยอดเต็มเป็นตัวใหญ่ + ป้าย "ประหยัด 23 / 25 / 28 / 30%"
- ภาพกราฟในฟีเจอร์ 12 ใบ พื้นหลังเข้มขึ้น (เปลี่ยนชื่อเป็น `-v3`)

⚠️ ราคาในภาพตัวอย่างที่ลูกค้าส่งมา (2,790 / 5,390 / 10,490) **ไม่ตรง** กับราคาจริงใน
`config/plans.ts` (2,890 / 5,590 / 10,790) — ยึดราคาจริงไว้ ยังไม่ได้เปลี่ยนตามภาพ

ทั้งหมด push ขึ้น GitHub แล้ว ไม่หายแม้เครื่องพัง

> ⚠️ **ราคาและรูปไม่ได้อยู่ในเวอร์ชันหน้าตา** — ราคา Founding 300 กับภาพชาร์ตชุดใหม่
> อยู่ใน `v1-classic` ที่ใช้อยู่แล้ว ไม่ต้องหยิบมาจาก v2 และห้ามย้อน `src/config/plans.ts`
> กลับไปก่อน `fe5431e` เพราะราคาจะกลับเป็นชุดเก่า (990 / 2,670 / 4,740 / 7,990)

---

## วิธีหยิบทีละชิ้น

หลักการเดียวกันหมด — ดึงเฉพาะไฟล์ที่ต้องการจาก tag แล้วลองรัน:

```bash
git checkout v2-redesign -- <ไฟล์ที่ต้องการ>
```

ไม่ชอบก็ย้อนไฟล์นั้นกลับ:

```bash
git checkout v1-classic -- <ไฟล์เดิม>
```

---

## แต่ละชิ้นอยู่ไฟล์ไหน

### 1. แผงสำรวจฟีเจอร์ (แทนการ์ด 12 ใบ)

ภาพใหญ่ 960px + แถบเลือกด้านข้าง แทนกริดการ์ดที่ภาพเล็กจนอ่านป้ายบนกราฟไม่ออก

```
src/components/marketing/FeatureExplorer.tsx
src/components/marketing/ExplorerPanel.tsx
```

ต้องแก้ `src/app/page.tsx` ให้เรียก `<FeatureExplorer />` แทน `<CoreFeatures />` + `<AllFeatures />`
ฟิลด์ `short` ใน `src/config/features.ts` มีอยู่แล้วใน `v1-classic` ไม่ต้องหยิบเพิ่ม

### 2. พื้นหลังสนามจุด 3D

```
src/components/common/Background3D.tsx
src/app/globals.css        # ต้องเอาไปด้วย — ใช้คลาส .bg3d__field
```

เขียนด้วย canvas 2D ไม่ได้ใช้ three.js (ประหยัดไป ~600KB)

### 3. Hero ที่คลิปพ้น fold

```
src/components/marketing/Hero.tsx
src/app/globals.css        # ใช้คลาส .hero-terminal, .hero-market-depth
```

ขอบล่างคลิปขยับจาก 943px เป็น 824px พ้นขอบจอ 915px

### 4. หน้าราคาแบบสวิตช์ + การ์ดใบเดียว

```
src/components/marketing/PlanSelector.tsx
src/components/marketing/Pricing.tsx
src/components/marketing/TrustCenter.tsx
```

### 5. ส่วน "ตรวจเองได้ / สิ่งที่เราไม่ทำ"

```
src/components/marketing/ProofLedger.tsx
```

### 6. ส่วนอื่น ๆ ของดีไซน์ใหม่

```
src/components/marketing/DecisionPath.tsx          # ปัญหา→ทางแก้ + ขั้นตอน
src/components/marketing/ProductTour.tsx           # กดดูจุดต่าง ๆ บนกราฟ
src/components/marketing/ProductWorkbench.tsx      # ต้องมี ConfigurationShowcase + ProductConfidence ด้วย
src/components/marketing/ConfigurationShowcase.tsx
src/components/marketing/ProductConfidence.tsx
```

### 7. หน้า /guide แบบใหม่

```
src/app/guide/page.tsx
src/components/guide/SuiteSection.tsx
src/components/guide/GuideChart.tsx
src/components/guide/GuideComparison.tsx
src/components/guide/GuideNavigator.tsx
src/components/guide/SettingsAccordion.tsx
src/components/guide/SetupChecklist.tsx
```

### 8. เรียงลำดับ section ใหม่ (หลักฐานมาก่อนแคตตาล็อก)

```
src/app/page.tsx
src/config/site.ts        # ลำดับเมนูให้ตรงกับลำดับ section
```

อันนี้หยิบเดี่ยว ๆ ไม่ได้ เพราะ `page.tsx` อ้างถึงคอมโพเนนต์ในข้อ 1–7
ถ้าจะเอาข้อนี้ ต้องเอาข้ออื่นที่มันเรียกไปด้วย

---

## เนื้อหาที่แก้ใน `v2-redesign-trimmed` เท่านั้น

สี่อย่างนี้อยู่ใน `d72bfa4` ไม่ได้อยู่ใน `v2-redesign`:

- เปลี่ยนคำว่า "กราฟจริง" เป็น "ตัวอย่างกราฟ"
- เริ่มใช้งาน 4 ขั้น: สมัครใช้งาน / เลือกแพ็กเกจ / รับสิทธิ์ / เข้าใช้งาน
- ตัด section สัญญาณสด
- ตัดการรับประกันคืนเงิน 7 วันออกจากหน้าขาย

ดูรายละเอียดว่าแตะไฟล์ไหนบ้าง:

```bash
git show --stat d72bfa4
```

> หมายเหตุ: ถ้าจะเอาข้อ "ตัดการรับประกัน 7 วัน" มาใช้จริง ต้องแก้หน้า
> `/refund` กับ `/terms` ด้วย เพราะสองหน้านั้นยังเขียนว่ารับประกัน 7 วันอยู่
> และเป็นข้อความที่ผูกพันตามกฎหมาย

---

## ย้อนกลับทั้งหมดทีเดียว

กลับไปดีไซน์ใหม่ทั้งชุด:

```bash
git checkout design/v2-redesign
```

กลับมาหน้าตาปัจจุบัน:

```bash
git checkout main
```

---

## หัวหน้าเว็บ: การ์ดสรุปสินค้า (แทน Hero เดิม)

ตั้งแต่ commit `HEAD` เป็นต้นไป หัวหน้าแรกเป็น **การ์ดสรุปสินค้าใบเดียว**
(คำอธิบาย + คลิปกราฟ + ราคา อยู่ในกรอบเดียว) แทน Hero เลย์เอาท์เดิม

| ไฟล์ | สถานะ |
|---|---|
| `src/components/marketing/HeroCard.tsx` | กรอบ section ของหัวหน้าเว็บ — ถือ `id="top"`, เส้นเลเซอร์, trustItems, บรรทัดคำเตือน |
| `src/components/marketing/ProductCard.tsx` | ตัวการ์ด ใช้ร่วมกับหน้า `/card` — โหมดหัวหน้าเว็บเปิดด้วย prop `asHero` |
| `src/components/marketing/Hero.tsx` | **ยังอยู่ ไม่ได้ลบ** แต่ไม่มีใครเรียกแล้ว |

ย้อนกลับไปใช้ Hero เดิม — แก้ที่ `src/app/page.tsx` สองบรรทัด:

```
import { Hero } from "@/components/marketing/Hero";   // แทน HeroCard
<Hero monthlyTHB={promo.monthlyTHB} />                // แทน <HeroCard ... />
```

ไม่ต้องแตะไฟล์อื่น เพราะ Hero เดิมถือ `id="top"` กับเส้นเลเซอร์อยู่ในตัวอยู่แล้ว

### สลับสื่อในการ์ดหัวหน้าเว็บ

ค่าเริ่มต้นใช้ **คลิป Bar Replay** (`heroClip`) ซึ่งมีลายน้ำ "การเล่นซ้ำ" ติดอยู่ในพิกเซล
ถ้าอยากได้ภาพนิ่งที่ไม่มีลายน้ำแทน ให้เอาเงื่อนไข `asHero` ออกจากบล็อก `<figure>`
ใน `ProductCard.tsx` แล้วให้ใช้ `<Image>` ทั้งสองโหมด — ภาพชาร์ตทั้งสามชุดสะอาดหมด
