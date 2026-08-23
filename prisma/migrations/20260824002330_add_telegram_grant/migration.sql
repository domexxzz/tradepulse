-- CreateTable
CREATE TABLE "TelegramGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "addedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelegramGrant_status_idx" ON "TelegramGrant"("status");

-- AddForeignKey
ALTER TABLE "TelegramGrant" ADD CONSTRAINT "TelegramGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
