-- AlterTable
ALTER TABLE "GuildUserAccess" ADD COLUMN "canReadArchives" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canWriteArchives" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "GlobalAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalAdmin_userId_key" ON "GlobalAdmin"("userId");

-- AddForeignKey
ALTER TABLE "GlobalAdmin" ADD CONSTRAINT "GlobalAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
