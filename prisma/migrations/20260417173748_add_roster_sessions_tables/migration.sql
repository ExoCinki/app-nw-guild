/*
  Warnings:

  - A unique constraint covering the columns `[rosterId,eventId,participantKey]` on the table `RosterParticipantOverride` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `rosterId` to the `RosterParticipantOverride` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Roster_discordGuildId_key";

-- DropIndex
DROP INDEX "RosterParticipantOverride_discordGuildId_eventId_participantKey";

-- AlterTable
ALTER TABLE "Roster" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedByUserId" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "RosterArchive" ADD COLUMN     "rosterId" TEXT;

-- AlterTable
ALTER TABLE "RosterParticipantOverride" ADD COLUMN     "rosterId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "RosterSessionShare" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "shareTokenHash" TEXT NOT NULL,
    "shareUrl" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterSessionShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterSelectedSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterSelectedSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RosterSessionShare_sessionId_key" ON "RosterSessionShare"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterSessionShare_shareTokenHash_key" ON "RosterSessionShare"("shareTokenHash");

-- CreateIndex
CREATE INDEX "RosterSessionShare_discordGuildId_idx" ON "RosterSessionShare"("discordGuildId");

-- CreateIndex
CREATE INDEX "RosterSelectedSession_discordGuildId_idx" ON "RosterSelectedSession"("discordGuildId");

-- CreateIndex
CREATE INDEX "RosterSelectedSession_rosterId_idx" ON "RosterSelectedSession"("rosterId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterSelectedSession_userId_discordGuildId_key" ON "RosterSelectedSession"("userId", "discordGuildId");

-- CreateIndex
CREATE INDEX "Roster_discordGuildId_createdAt_idx" ON "Roster"("discordGuildId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RosterParticipantOverride_rosterId_eventId_participantKey_key" ON "RosterParticipantOverride"("rosterId", "eventId", "participantKey");

-- AddForeignKey
ALTER TABLE "RosterParticipantOverride" ADD CONSTRAINT "RosterParticipantOverride_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterSessionShare" ADD CONSTRAINT "RosterSessionShare_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterSelectedSession" ADD CONSTRAINT "RosterSelectedSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterSelectedSession" ADD CONSTRAINT "RosterSelectedSession_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
