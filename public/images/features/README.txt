รูปในโฟลเดอร์นี้คือ screenshot จริงจาก TradingView ตัดเป็นสัดส่วน 16:10 (960x600 .webp)
ชื่อไฟล์ต้องตรงกับ slug ใน src/config/features.ts แล้วกำหนด image: "/images/features/<slug>.webp"

ตอนนี้มี 10 ไฟล์ ครอบเฉพาะฟีเจอร์ที่มองเห็นได้จริงบนภาพหน้าชาร์ตที่แคปมา
ฟีเจอร์ที่เหลือยังปล่อย image: "" ไว้ เพื่อให้การ์ดใช้ภาพแบรนด์แทน — ดีกว่าเอาภาพที่ไม่ตรงมาใส่

ภาพต้นทางทั้ง 3 ใบอยู่ที่ public/images/charts/ (smc-suite / gold-suite / ict-suite)
ถ้าจะเพิ่มฟีเจอร์ใหม่ ให้ตัดจากภาพชุดนั้นด้วย ffmpeg เช่น
  ffmpeg -i chart.jpeg -vf "crop=1200:750:<x>:<y>,scale=960:600" -c:v libwebp -quality 78 <slug>.webp

หมายเหตุ: ภาพต้นทางแคปจากโหมด Bar Replay ของ TradingView (มีลายน้ำ "การเล่นซ้ำ" จาง ๆ กลางภาพ)
ข้อความกำกับเรื่องนี้อยู่ที่ mediaNote ใน src/config/guide.ts — อย่าเอาไปพาดหัวว่าเป็นผลเทรดสด
