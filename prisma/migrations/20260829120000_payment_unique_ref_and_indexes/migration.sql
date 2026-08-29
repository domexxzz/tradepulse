-- ปิดช่องโหว่บันทึกเงินซ้ำ + เพิ่ม index ในจุดที่คิวรีบ่อยที่สุด
--
-- เดิม recordPayment() กันซ้ำด้วย findFirst แล้วค่อย create ซึ่งเป็น check-then-act
-- ที่ race ได้: webhook สองตัวมาพร้อมกัน ต่างคนต่างไม่เจอ แล้วต่างสร้างใบเสร็จ
-- ให้ฐานข้อมูลบังคับแทน แล้วโค้ดจับ P2002

-- ขั้นที่ 1: ทำเครื่องหมายแถวซ้ำที่อาจมีอยู่แล้ว ก่อนสร้าง unique index
--
-- ⚠️ ไม่ลบแถวทิ้ง เพราะเป็นข้อมูลการเงิน — ต่อท้าย ':dup:<id>' ให้ค่าไม่ชนกันแทน
-- แถวที่เก่าที่สุดของแต่ละ providerRef เก็บค่าเดิมไว้ (ถือว่าเป็นรายการจริง)
-- ที่เหลือถูกทำเครื่องหมาย ค้นทีหลังได้ด้วย:
--   SELECT * FROM "Payment" WHERE "providerRef" LIKE '%:dup:%';
UPDATE "Payment" p
SET "providerRef" = p."providerRef" || ':dup:' || p."id"
WHERE p."providerRef" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Payment" q
    WHERE q."providerRef" = p."providerRef"
      AND (
        q."createdAt" < p."createdAt"
        OR (q."createdAt" = p."createdAt" AND q."id" < p."id")
      )
  );

-- ขั้นที่ 2: บังคับ unique จริงที่ระดับฐานข้อมูล
CREATE UNIQUE INDEX "Payment_providerRef_key" ON "Payment"("providerRef");

-- ขั้นที่ 3: index ที่ขาด
-- Payment.status  = countPaidMembers() ยิงทุกครั้งที่เรนเดอร์หน้าแรก (full scan อยู่เดิม)
-- Payment.userId  = ประวัติการชำระเงิน และการเช็คสิทธิ์ราคาล็อก
-- AccessGrant.*   = ตารางนี้ไม่มี index เลยทั้งที่คิวรีด้วยสองคอลัมน์นี้ตลอด
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX "AccessGrant_status_idx" ON "AccessGrant"("status");
CREATE INDEX "AccessGrant_userId_idx" ON "AccessGrant"("userId");
