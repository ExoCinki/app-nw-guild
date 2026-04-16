-- CreateTable
CREATE TABLE "RosterParticipantOverride" (
    "id" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "participantKey" TEXT NOT NULL,
    "nameOverride" TEXT,
    "roleOverride" TEXT,
    "isMerc" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterParticipantOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RosterParticipantOverride_discordGuildId_eventId_idx" ON "RosterParticipantOverride"("discordGuildId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterParticipantOverride_discordGuildId_eventId_participantKey_key" ON "RosterParticipantOverride"("discordGuildId", "eventId", "participantKey");
