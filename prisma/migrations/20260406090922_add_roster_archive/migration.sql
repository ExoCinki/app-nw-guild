-- CreateTable
CREATE TABLE "RosterArchive" (
    "id" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "eventId" TEXT,
    "eventTitle" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RosterArchive_discordGuildId_archivedAt_idx" ON "RosterArchive"("discordGuildId", "archivedAt" DESC);
