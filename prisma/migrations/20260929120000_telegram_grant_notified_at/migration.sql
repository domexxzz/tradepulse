-- ส่งลิงก์กลุ่ม Telegram ทางอีเมลไปแล้วเมื่อไหร่
-- รอบกวาดรายวันใช้ช่องนี้หาคนที่ยังไม่ได้ลิงก์ โดยไม่ยิงซ้ำให้คนที่ได้ไปแล้ว
ALTER TABLE "TelegramGrant" ADD COLUMN "notifiedAt" TIMESTAMP(3);
