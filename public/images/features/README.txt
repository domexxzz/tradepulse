รูปในโฟลเดอร์นี้คือ screenshot จริงจาก TradingView ตัดเป็นสัดส่วน 16:10 (960x600 .webp)
กำหนดที่ image: "/images/features/<ชื่อไฟล์>.webp" ใน src/config/features.ts
ฟีเจอร์ที่ image เป็นค่าว่างจะถูกซ่อนจากเว็บทั้งหมด (ดูตัวกรอง hasScreenshot ในไฟล์นั้น)

ที่มาของรูป มีสองรุ่น
- รุ่นแรก  ตัดจากคลิปที่แคปด้วยโหมด Bar Replay จึงมีลายน้ำ "การเล่นซ้ำ" จาง ๆ กลางภาพ
           ภาพต้นทางอยู่ที่ public/images/charts/ (smc-suite / gold-suite / ict-suite)
- รุ่นสอง  ตัดจากลิงก์ snapshot ของ TradingView (tradingview.com/x/...) ซึ่งไม่มีลายน้ำ
           ลงท้ายชื่อไฟล์ด้วย -snap เมื่อเป็นการแทนที่รูปรุ่นแรกของฟีเจอร์เดิม

⚠️ ห้ามทับไฟล์ชื่อเดิมเมื่อเปลี่ยนรูปของฟีเจอร์ที่มีรูปอยู่แล้ว
Next.js แคชภาพที่ optimize แล้วตาม URL ทับชื่อเดิมจะยังได้ภาพเก่าทั้งบน dev และ production
ให้ตั้งชื่อใหม่แล้วแก้ path ใน features.ts แทน (เหตุผลเดียวกับหมายเหตุที่ tradingView.snapshotUrl ใน config/site.ts)

วิธีตัดรูปใหม่จาก snapshot
  curl -o snap.png https://s3.tradingview.com/snapshots/<ตัวแรกพิมพ์เล็ก>/<id>.png
  ffmpeg -i snap.png -vf "crop=<w>:<h>:<x>:<y>,scale=960:600" -c:v libwebp -quality 80 <slug>.webp
เลือกกรอบให้เห็นฟีเจอร์นั้นชัด และเลี่ยงแกนเวลากับไอคอนปฏิทินเศรษฐกิจที่ขอบล่าง
