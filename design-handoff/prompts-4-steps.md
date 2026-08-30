# พรอมต์สร้างภาพ 4 ขั้นตอน (ChatGPT / GPT Image)

## วิธีใช้

1. สั่งทีละใบ **4 ครั้ง**
2. ทุกครั้งวาง **บล็อก STYLE ทั้งก้อนแบบเดิมเป๊ะ ๆ** เปลี่ยนแค่บรรทัด SCENE
3. ถ้าใบไหนหลุดสไตล์ ให้สั่งใหม่ อย่าสั่งว่า "แก้ให้เหมือนใบที่แล้ว" — มันจำไม่ได้
4. ได้ครบ 4 ใบแล้วส่งไฟล์มา ผมปรับสี ย่อขนาด แปลงเป็น webp แล้วต่อเข้าเว็บให้

---

## บล็อกที่ต้องวางเหมือนกันทุกครั้ง

```
STYLE (keep identical across all images):
Flat vector illustration, minimal, clean geometric shapes.
Dark background, near-black with a slight green tint (#0D1410).
Single accent color: bright lime green (#6EE34A). Everything else is
dark grey, white, or the accent green — no other hues at all.
Thin consistent line weight. Soft subtle glow only, no neon, no heavy bloom.
Flat front-facing perspective, no isometric, no 3D render, no photo.
Generous empty space around the subject. Centered composition.
Aspect ratio 16:10.
NO TEXT, NO LETTERS, NO NUMBERS, NO WATERMARK anywhere in the image.
```

---

## SCENE ของแต่ละใบ

**ใบที่ 1 — สมัครสมาชิก**
```
SCENE: A simple rounded input form floating in space, with a small
envelope icon beside it and a green checkmark badge on its corner.
```

**ใบที่ 2 — เลือกแพ็กเกจ**
```
SCENE: Three rounded cards side by side of slightly different heights,
the middle one highlighted in the accent green, with a small QR code
symbol floating beside them.
```

**ใบที่ 3 — แจ้ง TradingView Username**
```
SCENE: A user profile circle icon connected by a thin line to a rounded
input field, with a small key symbol at the end of the line.
```

**ใบที่ 4 — รับสิทธิ์ใช้งาน**
```
SCENE: A simplified candlestick chart inside a rounded frame, with two
horizontal marker lines across it and an unlocked padlock icon at the
top corner.
```

---

## ถ้าผลลัพธ์ไม่โอเค ลองเปลี่ยนตรงนี้ก่อน

| อาการ | แก้ |
|---|---|
| รกเกินไป มีของเยอะ | เติม `Only one subject. Nothing else in frame.` |
| มีตัวหนังสือโผล่ | ย้ำ `absolutely no text or symbols resembling letters` |
| สีเขียวเพี้ยน | ปล่อยไว้ ส่งมาให้ผมปรับ — เร็วกว่าสั่งซ้ำ |
| แต่ละใบคนละสไตล์ | ตรวจว่าวางบล็อก STYLE ครบทั้งก้อนจริงไหม |
| ดูเป็น 3D render | เติม `2D only, completely flat, no shading, no depth` |

---

## หมายเหตุ

ขอ **พื้นหลังทึบ** ดีกว่าโปร่งใส เพราะภาพจะไปวางบนพื้นการ์ดสีเดียวกันอยู่แล้ว
และไฟล์โปร่งใสจาก AI มักมีขอบฟุ้งเป็นรัศมีขาวจาง ๆ ที่มองไม่เห็นตอนดูบนพื้นขาว
แต่จะเห็นชัดมากตอนวางบนพื้นดำ
