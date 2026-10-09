-- กันแจ้งเตือนข้อความเดิมถล่มกลุ่มแอดมิน (ด่านสุดท้าย ไม่ขึ้นกับบั๊กของเส้นทางไหน)
CREATE TABLE "AlertThrottle" (
    "key" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "suppressed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertThrottle_pkey" PRIMARY KEY ("key")
);
