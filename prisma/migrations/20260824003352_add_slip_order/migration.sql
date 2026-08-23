-- CreateTable
CREATE TABLE "SlipOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "amountTHB" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "slipData" TEXT,
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlipOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SlipOrder_status_idx" ON "SlipOrder"("status");
ALTER TABLE "SlipOrder" ADD CONSTRAINT "SlipOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
