-- CreateTable
CREATE TABLE "GuildUserAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "canAccessRoster" BOOLEAN NOT NULL DEFAULT true,
    "canAccessPayout" BOOLEAN NOT NULL DEFAULT true,
    "canAccessConfiguration" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildUserAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BannedDiscordUser" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "reason" TEXT,
    "bannedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BannedDiscordUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuildUserAccess_discordGuildId_idx" ON "GuildUserAccess"("discordGuildId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildUserAccess_userId_discordGuildId_key" ON "GuildUserAccess"("userId", "discordGuildId");

-- CreateIndex
CREATE UNIQUE INDEX "BannedDiscordUser_discordId_key" ON "BannedDiscordUser"("discordId");

-- AddForeignKey
ALTER TABLE "GuildUserAccess" ADD CONSTRAINT "GuildUserAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BannedDiscordUser" ADD CONSTRAINT "BannedDiscordUser_bannedByUserId_fkey" FOREIGN KEY ("bannedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
