-- CreateTable
CREATE TABLE "ScoreboardSelectedRosterSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "scoreboardSessionId" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreboardSelectedRosterSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoreboardSelectedRosterSession_userId_discordGuildId_scoreboardSessionId_key" ON "ScoreboardSelectedRosterSession"("userId", "discordGuildId", "scoreboardSessionId");

-- CreateIndex
CREATE INDEX "ScoreboardSelectedRosterSession_discordGuildId_idx" ON "ScoreboardSelectedRosterSession"("discordGuildId");

-- CreateIndex
CREATE INDEX "ScoreboardSelectedRosterSession_scoreboardSessionId_idx" ON "ScoreboardSelectedRosterSession"("scoreboardSessionId");

-- CreateIndex
CREATE INDEX "ScoreboardSelectedRosterSession_rosterId_idx" ON "ScoreboardSelectedRosterSession"("rosterId");

-- AddForeignKey
ALTER TABLE "ScoreboardSelectedRosterSession" ADD CONSTRAINT "ScoreboardSelectedRosterSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreboardSelectedRosterSession" ADD CONSTRAINT "ScoreboardSelectedRosterSession_scoreboardSessionId_fkey" FOREIGN KEY ("scoreboardSessionId") REFERENCES "ScoreboardSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreboardSelectedRosterSession" ADD CONSTRAINT "ScoreboardSelectedRosterSession_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
