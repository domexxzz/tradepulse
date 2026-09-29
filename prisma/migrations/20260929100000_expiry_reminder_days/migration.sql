-- เตือนใกล้หมดอายุหลายหลัก (7/3/1) ต้องรู้ว่าส่งหลักไหนไปแล้ว
-- ของเดิม expiryNotifiedAt เป็นธงเดียว เตือนได้ครั้งเดียวต่อรอบบิล
ALTER TABLE "Subscription" ADD COLUMN "expiryNotifiedDays" INTEGER;
