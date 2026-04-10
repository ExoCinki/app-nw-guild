-- AlterTable
ALTER TABLE "GuildUserAccess" ADD COLUMN     "canReadScoreboard" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canWriteScoreboard" BOOLEAN NOT NULL DEFAULT true;
