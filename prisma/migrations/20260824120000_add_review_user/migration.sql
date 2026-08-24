-- AlterTable: link reviews to the member who wrote them
ALTER TABLE "Review" ADD COLUMN "userId" TEXT;
CREATE INDEX "Review_userId_idx" ON "Review"("userId");
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
