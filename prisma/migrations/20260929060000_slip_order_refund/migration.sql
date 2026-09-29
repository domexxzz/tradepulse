-- บันทึกการคืนเงิน แยกจาก status เพราะ REJECTED แปลว่าสลิปไม่ผ่าน ไม่ใช่คืนเงิน
-- และคืนเงินเกิดได้ทั้งตอน SUBMITTED และ APPROVED
ALTER TABLE "SlipOrder" ADD COLUMN "refundedAt" TIMESTAMP(3);
ALTER TABLE "SlipOrder" ADD COLUMN "refundTHB" INTEGER;
ALTER TABLE "SlipOrder" ADD COLUMN "refundNote" TEXT;
ALTER TABLE "SlipOrder" ADD COLUMN "refundedById" TEXT;
