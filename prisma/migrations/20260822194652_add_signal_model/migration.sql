-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "tf" TEXT NOT NULL,
    "sl" REAL,
    "tp1" REAL,
    "tp2" REAL,
    "source" TEXT NOT NULL DEFAULT 'tradingview',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Signal_createdAt_idx" ON "Signal"("createdAt");

-- CreateIndex
CREATE INDEX "Signal_symbol_tf_createdAt_idx" ON "Signal"("symbol", "tf", "createdAt");
