
-- AlterTable
ALTER TABLE "Setting" DROP COLUMN "smsMonthlyCap";

-- CreateTable
CREATE TABLE "EmailUsage" (
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailUsage_pkey" PRIMARY KEY ("day")
);

