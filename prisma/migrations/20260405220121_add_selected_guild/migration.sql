-- CreateTable
CREATE TABLE "SelectedGuild" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelectedGuild_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SelectedGuild_userId_key" ON "SelectedGuild"("userId");

-- AddForeignKey
ALTER TABLE "SelectedGuild" ADD CONSTRAINT "SelectedGuild_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
