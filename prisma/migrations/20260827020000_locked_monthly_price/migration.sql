-- AlterTable: lock the launch-promo monthly price for the first paying members
ALTER TABLE "User" ADD COLUMN "lockedMonthlyTHB" INTEGER;
