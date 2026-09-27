-- CreateTable
CREATE TABLE "BrokerEvent" (
    "id" TEXT NOT NULL,
    "broker" TEXT NOT NULL DEFAULT 'wisdom',
    "type" TEXT NOT NULL,
    "tradingAccount" TEXT,
    "accountName" TEXT,
    "accountEmail" TEXT,
    "amountUSD" DOUBLE PRECISION,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "rawText" TEXT,
    "loggedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrokerEvent_externalId_key" ON "BrokerEvent"("externalId");
CREATE INDEX "BrokerEvent_tradingAccount_occurredAt_idx" ON "BrokerEvent"("tradingAccount", "occurredAt");
CREATE INDEX "BrokerEvent_type_occurredAt_idx" ON "BrokerEvent"("type", "occurredAt");

-- AddForeignKey
ALTER TABLE "BrokerEvent" ADD CONSTRAINT "BrokerEvent_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
