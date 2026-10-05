-- บอททำให้ไม่สำเร็จติดกันกี่ครั้ง และเหตุผลล่าสุด
-- ของเดิมลองซ้ำไม่มีที่สิ้นสุด งานที่ไม่มีวันสำเร็จ (username ไม่มีจริงบน TradingView)
-- จึงวนทุกรอบ cron พร้อมเด้งเตือนแอดมิน 2 ข้อความทุก 5 นาที จนไม่มีใครอ่านแจ้งเตือน
ALTER TABLE "AccessGrant" ADD COLUMN "failCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AccessGrant" ADD COLUMN "lastFailReason" TEXT;
