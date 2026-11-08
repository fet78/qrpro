-- Demandes d'intervention enrichies + notifications multicanal (file d'envoi, abonnements push).

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "notify" JSONB;

-- AlterTable
ALTER TABLE "InterventionRequest" ADD COLUMN     "availability" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "city" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "clientKey" TEXT,
ADD COLUMN     "note" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "postalCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "problem" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'nouvelle';

-- AlterTable
ALTER TABLE "RequestPhoto" ADD COLUMN     "mime" TEXT NOT NULL DEFAULT 'image/jpeg',
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "size" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "width" SET DEFAULT 0,
ALTER COLUMN "height" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "smsMonthlyCap" INTEGER NOT NULL DEFAULT 40;

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT NOT NULL DEFAULT '',
    "providerId" TEXT NOT NULL DEFAULT '',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOkAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationLog_status_nextAttemptAt_idx" ON "NotificationLog"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "NotificationLog_businessId_createdAt_idx" ON "NotificationLog"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_requestId_channel_key" ON "NotificationLog"("requestId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_businessId_idx" ON "PushSubscription"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "InterventionRequest_clientKey_key" ON "InterventionRequest"("clientKey");

-- CreateIndex
CREATE INDEX "InterventionRequest_businessId_status_idx" ON "InterventionRequest"("businessId", "status");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "InterventionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Reprise : les demandes déjà traitées passent au statut « terminee », et taille des photos existantes.
UPDATE "InterventionRequest" SET "status" = 'terminee' WHERE "handledAt" IS NOT NULL;
UPDATE "InterventionRequest" SET "readAt" = "createdAt";
UPDATE "RequestPhoto" SET "size" = octet_length("data");
