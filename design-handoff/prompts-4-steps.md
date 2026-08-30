# พรอมต์สร้างภาพ 4 ขั้นตอน (ChatGPT / GPT Image)

ภาพชุดนี้ใช้ในหัวข้อ "เริ่มใช้งานได้ใน 4 ขั้นตอน" บนหน้าแรก
ค่าทุกตัวในไฟล์นี้วัดจากไฟล์ภาพและโค้ดที่ใช้งานจริง ไม่ได้ประมาณเอา

| สเปก | ค่า |
|---|---|
| ขนาด | 1600 × 1000 px (16:10) |
| พื้นหลัง | `#080808` — เท่ากับภาพกราฟทุกใบในเว็บ |
| เขียวแบรนด์ | `#6EE34A` |
| เส้นสีอ่อน | `#EEF4EC` |
| ช่องวางจริงบนเว็บ | กว้างแค่ ~215px (การ์ด 1 ใน 4 คอลัมน์) |
| ไฟล์ที่เว็บใช้ | `.webp` |

## วิธีใช้

1. สั่งทีละใบ **4 ครั้ง**
2. ทุกครั้งวาง **บล็อก STYLE ทั้งก้อนแบบเดิมเป๊ะ ๆ** เปลี่ยนแค่ส่วน SCENE
3. ถ้าใบไหนหลุดสไตล์ ให้สั่งใหม่ อย่าสั่งว่า "แก้ให้เหมือนใบที่แล้ว" — มันจำไม่ได้
4. ได้ครบ 4 ใบแล้วส่งไฟล์มา ผมปรับสี ย่อขนาด แปลงเป็น webp แล้วต่อเข้าเว็บให้

**เจนทั้งสี่ใบรวดเดียวในแชทเดียว** อย่าเว้นข้ามวันแล้วค่อยกลับมาเจนใบที่เหลือ
และถ้าเครื่องมือล็อก seed ได้ ให้ใช้ seed เดียวกันทั้งสี่ใบ

---

## ⚠️ ห้ามมีตัวหนังสือในภาพ

AI เขียน **ภาษาไทยในภาพไม่ได้** เกือบทุกตัว ออกมาเป็นตัวอักษรมั่วที่อ่านไม่ออก
ภาษาอังกฤษก็ยังเพี้ยนบ่อย

และเว็บ **มีข้อความอธิบายอยู่ใต้ภาพทุกช่องอยู่แล้ว** (ชื่อขั้นตอน + คำอธิบาย)
ถ้าใส่ข้อความซ้ำเข้าไปในภาพอีกจะได้สามอย่างนี้ตามมา

- อ่านซ้ำซ้อน
- ตัวหนังสือในภาพเล็กจนอ่านไม่ออก เพราะช่องวางจริงกว้างแค่ 215px
- โปรแกรมอ่านหน้าจอกับ Google อ่านข้อความที่อยู่ในภาพไม่ได้

**ให้ภาพเล่าด้วยรูปอย่างเดียว** แล้วปล่อยให้ข้อความบนเว็บทำหน้าที่อธิบาย

---

## บล็อกที่ต้องวางเหมือนกันทุกครั้ง

```
STYLE (keep identical across all four images):
Minimal flat vector line illustration. Thin uniform strokes of even weight,
outline only, no fills. Straight-on 2D view, no perspective, no isometric angle.
Single centered subject with generous empty space around it.

Strict palette, nothing else: background is pure near-black #080808;
all line work is off-white #EEF4EC; one accent green #6EE34A used on a
single focal element only.

Lighting: a soft green radial glow (#3D9C24, low opacity) bleeding in from the
lower-left and upper-right edges, like light diffusing behind dark glass.
A few faint diagonal light streaks across the background.
The glow never touches or tints the line work.

Absolutely no text, no letters, no words, no numbers, no logo, no watermark.
No gradient on the strokes. No drop shadow. No 3D, no photorealism, no glossy plastic.

16:10 aspect ratio, 1600x1000 pixels.
```

ถ้าเครื่องมือมีช่อง negative prompt แยก ใส่อันนี้ด้วย

```
text, letters, words, numbers, typography, watermark, signature, logo,
UI screenshot, photorealistic, 3D render, glossy, plastic, drop shadow,
heavy gradient, neon bloom, multiple accent colors, red, blue, orange,
purple, cluttered, busy background, isometric
```

---

## SCENE ของแต่ละใบ

แต่ละใบมีบรรทัด **สื่ออะไร** กำกับไว้ — คือสิ่งที่ภาพต้องทำให้คนเข้าใจ
ถ้าเจนออกมาแล้วคนดูไม่ได้ความรู้สึกนั้น ให้เจนใหม่ ต่อให้ภาพสวยแค่ไหนก็ตาม

### ใบที่ 1 — สมัครสมาชิก

> ข้อความบนเว็บใต้ภาพ: *"สร้างบัญชีด้วยอีเมล ใช้เวลาไม่ถึงนาที"*

**สื่ออะไร:** เริ่มง่าย ใช้แค่อีเมล และ **จบเร็ว**
เครื่องหมายถูกคือตัวบอกว่าเสร็จแล้ว จึงต้องเป็นจุดเดียวที่เป็นสีเขียว

```
SCENE: An outlined envelope on the left, its flap drawn as a simple triangle,
slightly overlapping a rounded rectangular card to its right. Inside the card
are two empty input-field outlines stacked vertically with a small gap between them.

A solid filled circle sits on the card's top-right corner, overlapping the corner,
with a check mark cut out of it. This badge is the only green element in the image;
the envelope, the card and the two fields all stay off-white.
```

### ใบที่ 2 — เลือกแพ็กเกจ

> ข้อความบนเว็บใต้ภาพ: *"เลือกระยะเวลาที่ต้องการ ชำระผ่าน PromptPay แล้วแนบสลิป"*

**สื่ออะไร:** มีให้เลือกหลายแบบ และ **เลือกได้** — ใบกลางที่เขียวคือตัวที่ถูกเลือก
QR คือ PromptPay ซึ่งเป็นวิธีจ่ายจริงของเว็บ **อย่าตัดออก**

```
SCENE: Three rounded rectangular cards standing side by side with even gaps.
Each card holds a simple outlined parcel box icon near its top, and below it three
short horizontal list rows, each row preceded by a small circle bullet.

The middle card is the selected one: it is noticeably taller than the two beside it,
and its border and its parcel icon are green. The left and right cards stay entirely
off-white.

A small square QR code pattern sits in the upper-right area of the frame, drawn in
green, clearly separate from the cards.
```

### ใบที่ 3 — แจ้ง TradingView Username

> ข้อความบนเว็บใต้ภาพ: *"กรอกในหน้าบัญชี เพื่อให้ทีมงานเพิ่มสิทธิ์ให้ถูกบัญชี"*

**สื่ออะไร:** ชื่อผู้ใช้ที่กรอกคือสิ่งที่ **เชื่อมตัวคนเข้ากับสิทธิ์**
ต้องอ่านออกว่าเป็นเส้นเดียวไหลจากซ้ายไปขวา ไม่ใช่ของสามชิ้นวางกระจาย

```
SCENE: Three elements aligned on one horizontal axis, connected left to right by a
single thin line that reads as one continuous flow.

On the left, an outlined circle containing a simple head-and-shoulders silhouette.
In the middle, a long empty rounded input field. At the right end, a small side-view
key whose teeth point outward to the right.

The connecting line and the key are green. The avatar circle and the input field
stay off-white.
```

### ใบที่ 4 — รับสิทธิ์ใช้งาน

> ข้อความบนเว็บใต้ภาพ: *"หลังตรวจสอบ เพิ่มอินดิเคเตอร์เข้ากราฟ พร้อมลิงก์เข้ากลุ่ม Telegram"*

**สื่ออะไร:** ปลดล็อกแล้ว ได้เครื่องมือขึ้นกราฟจริง

⚠️ แท่งเทียนต้องดูเป็น **ภาพวาดประกอบ ไม่ใช่ผลการเทรดจริง**
ห้ามมีตัวเลขราคา เปอร์เซ็นต์ หรือกำไรขาดทุนใด ๆ ในภาพเด็ดขาด
(เว็บนี้ห้ามแสดงผลตอบแทนที่ไม่ได้เกิดขึ้นจริง)

```
SCENE: A rounded rectangular panel framing a simple candlestick chart of about ten
candles at varying heights, each drawn as a thin body with a wick above and below.

One horizontal green line runs across the tops of the candles and a second across the
bottoms, each line ending in a small solid dot at both ends, like a marked range.
Roughly a third of the candles are green; the rest stay off-white and grey.

An open padlock sits on the panel's upper-right corner, its shackle swung up and open
to the right, drawn in green. The panel outline stays off-white.

The chart is decorative and abstract: no axis, no price scale, no numbers, no percentages.
```

---

## ถ้าผลลัพธ์ไม่โอเค ลองเปลี่ยนตรงนี้ก่อน

| อาการ | แก้ |
|---|---|
| รกเกินไป มีของเยอะ | เติม `Only one subject. Nothing else in frame.` |
| มีตัวหนังสือโผล่ | ย้ำ `absolutely no text or symbols resembling letters` |
| สีเขียวไปโดนหลายชิ้น | ย้ำ `exactly one green element, everything else off-white` |
| สีเขียวเพี้ยน | ปล่อยไว้ ส่งมาให้ผมปรับ — เร็วกว่าสั่งซ้ำ |
| แต่ละใบคนละสไตล์ | ตรวจว่าวางบล็อก STYLE ครบทั้งก้อนจริงไหม |
| ดูเป็น 3D render | เติม `2D only, completely flat, no shading, no depth` |
| พื้นหลังสว่างเกิน | ปล่อยไว้ ผมกดโทนให้ตอนแปลงไฟล์ |

---

## ได้ภาพมาแล้วทำต่อยังไง

ส่งไฟล์มาให้ผมก็ได้ ทำให้ทั้งหมด — หรือทำเองตามนี้

**1. กดโทนพื้นหลัง + ย่อ + แปลงเป็น webp ในคำสั่งเดียว**

```bash
ffmpeg -i ภาพที่เจนมา.png \
  -vf "curves=all='0/0 0.06/0.034 0.25/0.24 1/1',scale=1600:1000:flags=lanczos" \
  -c:v libwebp -quality 88 qvx-step-01-register-v2.webp
```

เส้นโค้งนี้กดพื้นหลังจาก 15 ลงมา 8 โดยไม่แตะสีเส้นกับความสว่างของไอคอน
เป็นตัวเดียวกับที่ใช้กับภาพกราฟทุกใบในเว็บ

**2. ห้ามทับไฟล์ชื่อเดิม**

Next.js แคชภาพตาม URL ทับชื่อเดิมแล้วจะยังเห็นภาพเก่าทั้งบนเครื่องและบนเว็บจริง
ให้ลงท้าย `-v2` แล้วแก้ path ใน `steps` ที่ `src/config/features.ts`

**3. แก้ `imageAlt` ให้ตรงภาพใหม่**

ถ้าเนื้อหาในภาพเปลี่ยนไปจากเดิม ต้องแก้ `imageAlt` ตามด้วย
เพราะคนที่ใช้โปรแกรมอ่านหน้าจอได้ยินแค่บรรทัดนั้น

**4. เช็คขนาดปิดท้าย**

```bash
npm run images:sizes how-it-works
```

---

## หมายเหตุ

ขอ **พื้นหลังทึบ** ดีกว่าโปร่งใส เพราะภาพจะไปวางบนพื้นการ์ดสีเข้มอยู่แล้ว
และไฟล์โปร่งใสจาก AI มักมีขอบฟุ้งเป็นรัศมีขาวจาง ๆ ที่มองไม่เห็นตอนดูบนพื้นขาว
แต่จะเห็นชัดมากตอนวางบนพื้นดำ

ภาพชุดที่ใช้อยู่ตอนนี้เจนมาจากไฟล์นี้เวอร์ชันก่อนหน้า และขึ้นเว็บแล้ว
ดูของจริงได้ที่ `public/images/how-it-works/` — ต้นฉบับ PNG อยู่ที่ `media-src/how-it-works/`
