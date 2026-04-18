-- CreateTable
CREATE TABLE "ScoreboardSessionShare" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "shareTokenHash" TEXT NOT NULL,
    "shareUrl" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreboardSessionShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoreboardSessionShare_sessionId_key" ON "ScoreboardSessionShare"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreboardSessionShare_shareTokenHash_key" ON "ScoreboardSessionShare"("shareTokenHash");

-- CreateIndex
CREATE INDEX "ScoreboardSessionShare_discordGuildId_idx" ON "ScoreboardSessionShare"("discordGuildId");

-- AddForeignKey
ALTER TABLE "ScoreboardSessionShare" ADD CONSTRAINT "ScoreboardSessionShare_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ScoreboardSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
