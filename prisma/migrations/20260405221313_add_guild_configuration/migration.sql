-- CreateTable
CREATE TABLE "GuildConfiguration" (
    "id" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "apiKey" TEXT,
    "channelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildConfiguration_discordGuildId_key" ON "GuildConfiguration"("discordGuildId");
