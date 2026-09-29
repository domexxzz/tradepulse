-- อีเมลที่ลูกค้าใช้เปิดบัญชีกับโบรก อาจไม่ใช่อีเมลที่สมัคร QVX
-- nullable เพราะคำขอเก่าที่ส่งมาก่อนมีฟิลด์นี้ ต้องอยู่ต่อได้โดยไม่ต้องเติมค่า
ALTER TABLE "BrokerApplication" ADD COLUMN "brokerEmail" TEXT;
