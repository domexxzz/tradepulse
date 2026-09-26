-- ทางที่ 2 ของการได้อินดิเคเตอร์: เปิดพอร์ตกับโบรกผ่านลิงก์ QVX แล้วส่งเลขบัญชีให้แอดมินตรวจ
-- อนุมัติแล้วเปิดสิทธิ์ด้วย activateMembership ตัวเดียวกับทางจ่ายเงิน

-- ผูกเลขบัญชีโบรกกับสมาชิก ตอนอนุมัติ — กันบัญชีเดียวรับสิทธิ์ฟรีให้หลายคน
ALTER TABLE "User" ADD COLUMN "brokerAccountKey" TEXT;
CREATE UNIQUE INDEX "User_brokerAccountKey_key" ON "User"("brokerAccountKey");

CREATE TABLE "BrokerApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "broker" TEXT NOT NULL DEFAULT 'wisdom',
    "tradingAccount" TEXT NOT NULL,
    "tradingViewUsername" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isRenewal" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrokerApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BrokerApplication_status_createdAt_idx" ON "BrokerApplication"("status", "createdAt");
CREATE INDEX "BrokerApplication_userId_createdAt_idx" ON "BrokerApplication"("userId", "createdAt");
CREATE INDEX "BrokerApplication_broker_tradingAccount_idx" ON "BrokerApplication"("broker", "tradingAccount");

ALTER TABLE "BrokerApplication" ADD CONSTRAINT "BrokerApplication_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
