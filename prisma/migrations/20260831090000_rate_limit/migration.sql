-- ตัวนับ rate limit — กันเดารหัสผ่าน/สมัครรัว/ยิงรีเซ็ตรหัสรัว
-- เก็บใน DB เพราะ serverless แต่ละ request อาจอยู่คนละ instance
-- ตัวนับในหน่วยความจำจึงใช้ร่วมกันไม่ได้ ต้องมีที่เก็บกลาง
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
