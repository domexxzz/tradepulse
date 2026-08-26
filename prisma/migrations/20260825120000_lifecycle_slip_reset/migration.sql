-- วงจรชีวิตสมาชิก: cron รายวันต้องหาแพ็กเกจที่ครบกำหนดได้เร็ว และรู้ว่าปิดสิทธิ์ไปแล้วหรือยัง
ALTER TABLE "Subscription" ADD COLUMN "expiredAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "expiryNotifiedAt" TIMESTAMP(3);
CREATE INDEX "Subscription_status_currentPeriodEnd_idx" ON "Subscription"("status", "currentPeriodEnd");
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- สลิป: กันส่งรูปเดิมซ้ำ (slipHash) และกันสลิปเดิมที่ถ่ายใหม่ (transRef จากผู้ให้บริการตรวจสลิป)
ALTER TABLE "SlipOrder" ADD COLUMN "slipMime" TEXT;
ALTER TABLE "SlipOrder" ADD COLUMN "slipHash" TEXT;
ALTER TABLE "SlipOrder" ADD COLUMN "transRef" TEXT;
ALTER TABLE "SlipOrder" ADD COLUMN "verifyStatus" TEXT;
ALTER TABLE "SlipOrder" ADD COLUMN "verifyNote" TEXT;
ALTER TABLE "SlipOrder" ADD COLUMN "verifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "SlipOrder_slipHash_key" ON "SlipOrder"("slipHash");
CREATE UNIQUE INDEX "SlipOrder_transRef_key" ON "SlipOrder"("transRef");
CREATE INDEX "SlipOrder_userId_idx" ON "SlipOrder"("userId");

-- ตั๋วรีเซ็ตรหัสผ่าน — เก็บเฉพาะ hash ของโทเคน ไม่เก็บตัวโทเคนจริง
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
