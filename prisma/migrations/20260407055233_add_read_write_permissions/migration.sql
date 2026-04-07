/*
  Warnings:

  - You are about to drop the column `canAccessConfiguration` on the `GuildUserAccess` table. All the data in the column will be lost.
  - You are about to drop the column `canAccessPayout` on the `GuildUserAccess` table. All the data in the column will be lost.
  - You are about to drop the column `canAccessRoster` on the `GuildUserAccess` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GuildUserAccess" DROP COLUMN "canAccessConfiguration",
DROP COLUMN "canAccessPayout",
DROP COLUMN "canAccessRoster",
ADD COLUMN     "canReadConfiguration" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canReadPayout" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canReadRoster" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canWriteConfiguration" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canWritePayout" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canWriteRoster" BOOLEAN NOT NULL DEFAULT true;
