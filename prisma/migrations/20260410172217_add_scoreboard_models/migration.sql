-- CreateTable
CREATE TABLE "ScoreboardSession" (
    "id" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreboardSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreboardEntry" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerNameKey" TEXT NOT NULL,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "deaths" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "damageDealt" INTEGER NOT NULL DEFAULT 0,
    "healingDone" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoreboardSession_discordGuildId_createdAt_idx" ON "ScoreboardSession"("discordGuildId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ScoreboardEntry_discordGuildId_playerNameKey_idx" ON "ScoreboardEntry"("discordGuildId", "playerNameKey");

-- CreateIndex
CREATE INDEX "ScoreboardEntry_sessionId_idx" ON "ScoreboardEntry"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreboardEntry_sessionId_playerNameKey_key" ON "ScoreboardEntry"("sessionId", "playerNameKey");

-- AddForeignKey
ALTER TABLE "ScoreboardEntry" ADD CONSTRAINT "ScoreboardEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ScoreboardSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
