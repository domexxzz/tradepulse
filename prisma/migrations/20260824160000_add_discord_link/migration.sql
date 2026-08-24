-- AlterTable: link a member account to their Discord identity for automatic role grants
ALTER TABLE "User" ADD COLUMN "discordUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "discordUsername" TEXT;
CREATE UNIQUE INDEX "User_discordUserId_key" ON "User"("discordUserId");
