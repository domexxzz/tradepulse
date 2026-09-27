-- AlterTable
ALTER TABLE "AiMessage" ADD COLUMN "sources" TEXT[] DEFAULT ARRAY[]::TEXT[];
