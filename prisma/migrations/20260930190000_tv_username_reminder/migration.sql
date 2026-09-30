-- ทวงให้กรอก TradingView username ไปแล้วกี่ครั้ง / ครั้งล่าสุดเมื่อไหร่
-- ไม่กรอก = จ่ายเงินแล้วแต่ไม่ได้ของ เพราะบอทไม่รู้ว่าจะเพิ่มสิทธิ์ให้ใคร
-- และเป็นขั้นตอนเดียวในระบบที่ทำแทนลูกค้าไม่ได้ จึงต้องมีอะไรไปทวงเขา
ALTER TABLE "User" ADD COLUMN "tvRemindedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "tvRemindCount" INTEGER NOT NULL DEFAULT 0;
