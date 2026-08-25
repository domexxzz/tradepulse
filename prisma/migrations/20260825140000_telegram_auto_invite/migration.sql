-- เชิญเข้ากลุ่ม Telegram อัตโนมัติด้วยลิงก์ส่วนตัวที่ใช้ได้ครั้งเดียว
-- ต้องรู้ Telegram user id ของสมาชิกถึงจะนำออกจากกลุ่มตอนหมดอายุได้
ALTER TABLE "User" ADD COLUMN "telegramUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramUsername" TEXT;
CREATE UNIQUE INDEX "User_telegramUserId_key" ON "User"("telegramUserId");

ALTER TABLE "TelegramGrant" ADD COLUMN "inviteLink" TEXT;
ALTER TABLE "TelegramGrant" ADD COLUMN "telegramUserId" TEXT;
ALTER TABLE "TelegramGrant" ADD COLUMN "invitedAt" TIMESTAMP(3);
CREATE INDEX "TelegramGrant_userId_idx" ON "TelegramGrant"("userId");
