-- CreateTable
CREATE TABLE "PayoutSessionShare" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "shareTokenHash" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutSessionShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutSessionShare_sessionId_key" ON "PayoutSessionShare"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutSessionShare_shareTokenHash_key" ON "PayoutSessionShare"("shareTokenHash");

-- CreateIndex
CREATE INDEX "PayoutSessionShare_discordGuildId_idx" ON "PayoutSessionShare"("discordGuildId");

-- AddForeignKey
ALTER TABLE "PayoutSessionShare" ADD CONSTRAINT "PayoutSessionShare_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PayoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
