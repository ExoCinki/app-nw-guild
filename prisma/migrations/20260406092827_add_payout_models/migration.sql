-- CreateTable
CREATE TABLE "PayoutSession" (
    "id" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "goldPool" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutEntry" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "wars" INTEGER NOT NULL DEFAULT 0,
    "races" INTEGER NOT NULL DEFAULT 0,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "invasions" INTEGER NOT NULL DEFAULT 0,
    "vods" INTEGER NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayoutSession_discordGuildId_idx" ON "PayoutSession"("discordGuildId");

-- CreateIndex
CREATE INDEX "PayoutEntry_discordGuildId_idx" ON "PayoutEntry"("discordGuildId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutEntry_sessionId_discordUserId_key" ON "PayoutEntry"("sessionId", "discordUserId");

-- AddForeignKey
ALTER TABLE "PayoutEntry" ADD CONSTRAINT "PayoutEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PayoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
