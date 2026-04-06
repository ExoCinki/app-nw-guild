-- AlterTable
ALTER TABLE "Roster" ADD COLUMN     "raidHelperEventsCache" JSONB,
ADD COLUMN     "raidHelperEventsCachedAt" TIMESTAMP(3),
ADD COLUMN     "raidHelperParticipantsCache" JSONB,
ADD COLUMN     "raidHelperParticipantsCachedAt" TIMESTAMP(3);
