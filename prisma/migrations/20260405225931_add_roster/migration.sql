/*
  Warnings:

  - You are about to drop the column `payoutPoints` on the `GuildConfiguration` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GuildConfiguration" DROP COLUMN "payoutPoints",
ADD COLUMN     "zooMemberRoleId" TEXT,
ADD COLUMN     "zooMemberRoleName" TEXT;

-- CreateTable
CREATE TABLE "Roster" (
    "id" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Roster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterGroup" (
    "id" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "groupNumber" INTEGER NOT NULL,
    "name" TEXT,

    CONSTRAINT "RosterGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterSlot" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "playerName" TEXT,
    "role" TEXT,

    CONSTRAINT "RosterSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Roster_discordGuildId_key" ON "Roster"("discordGuildId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterGroup_rosterId_groupNumber_key" ON "RosterGroup"("rosterId", "groupNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RosterSlot_groupId_position_key" ON "RosterSlot"("groupId", "position");

-- AddForeignKey
ALTER TABLE "RosterGroup" ADD CONSTRAINT "RosterGroup_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterSlot" ADD CONSTRAINT "RosterSlot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RosterGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
