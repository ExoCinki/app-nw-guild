-- AlterTable
ALTER TABLE "GuildConfiguration"
ADD COLUMN "enableSecondRoster" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RosterGroup"
ADD COLUMN "rosterIndex" INTEGER NOT NULL DEFAULT 1;

-- DropIndex
DROP INDEX "RosterGroup_rosterId_groupNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "RosterGroup_rosterId_rosterIndex_groupNumber_key" ON "RosterGroup"("rosterId", "rosterIndex", "groupNumber");

-- CreateIndex
CREATE INDEX "RosterGroup_rosterId_rosterIndex_idx" ON "RosterGroup"("rosterId", "rosterIndex");
