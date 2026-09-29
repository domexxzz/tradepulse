-- "งานนี้รันล่าสุดเมื่อไหร่" — ใช้จับงานที่หยุดไปเงียบ ๆ
-- แจ้งเตือนที่เตือนแค่ตอนพังจับกรณี "ไม่ได้รันเลย" ไม่ได้ ความเงียบจึงดูเหมือนปกติ
CREATE TABLE "SystemHeartbeat" (
    "name" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "detail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemHeartbeat_pkey" PRIMARY KEY ("name")
);
