-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "side" TEXT,
    "symbol" TEXT,
    "entry" TEXT,
    "tp" TEXT,
    "sl" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Signal_createdAt_idx" ON "Signal"("createdAt");
