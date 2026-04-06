-- AlterTable
ALTER TABLE "PayoutSession" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedByUserId" TEXT,
ADD COLUMN     "name" TEXT;
