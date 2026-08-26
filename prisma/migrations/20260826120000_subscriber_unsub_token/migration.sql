-- AlterTable: token used by the unsubscribe link in newsletter emails (no login required)
ALTER TABLE "Subscriber" ADD COLUMN "unsubscribeToken" TEXT;
CREATE UNIQUE INDEX "Subscriber_unsubscribeToken_key" ON "Subscriber"("unsubscribeToken");
