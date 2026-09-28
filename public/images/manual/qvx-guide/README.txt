ภาพจากคู่มือ "การใช้งาน QVX" (PDF) ใช้ในบท /manual/entry-sl-tp, /manual/telegram-signals
และ /manual/settings — กำหนดที่ image: { src, width, height, caption } ใน src/config/manual.ts

━━ ที่มาของไฟล์ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ไฟล์    หน้าใน PDF
  entry-sl-tp            17
  settings-structure     18
  settings-zone-style    19
  settings-tp-sl         20
  settings-gold-core     21
  settings-alerts        22
  telegram-alert         23
  telegram-channels      24 (ภาพบน)
  telegram-plan          24 (ภาพล่าง)

วิธีทำซ้ำ
  1. pdftoppm -r 300 -png -f 17 -l 24 "คู่มือการใช้งาน QVX.pdf" p
  2. ตัดเฉพาะกรอบภาพออกจากหน้า แล้วเซฟเป็น webp quality 86

━━ ทำไมไฟล์เล็กกว่าโฟลเดอร์อื่น ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

โฟลเดอร์ features/ กำหนดขั้นต่ำไว้ 1140px เพราะ export จาก TradingView ได้เองตามต้องการ
แต่ไฟล์ในโฟลเดอร์นี้ฝังมาในคู่มือ PDF ที่ความละเอียดต่ำอยู่แล้ว (แผงตั้งค่าบางหน้า
เหลือแค่ ~416px — ดูด้วย pdfimages -list) เรนเดอร์ที่ DPI สูงกว่านี้ก็ได้แค่ภาพขยาย
ไม่ได้รายละเอียดเพิ่ม

หน้า /manual/[slug] จึงวางภาพกว้างแค่ครึ่งหนึ่งของไฟล์ (ดู placedWidth ในไฟล์นั้น)
เพื่อให้คมบนจอ 2x ทุกใบ ถ้าได้ screenshot ใหม่จาก TradingView โดยตรงเมื่อไหร่
ให้วางทับไฟล์เดิมแล้วแก้ width/height ใน manual.ts ให้ตรง ภาพจะใหญ่ขึ้นเองตามกฎนั้น
