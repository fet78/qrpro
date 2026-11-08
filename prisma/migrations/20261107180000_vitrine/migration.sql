-- Vitrine publique : configuration, galerie, statistiques, demandes enrichies.
ALTER TABLE "Business" ADD COLUMN "page" JSONB;
ALTER TABLE "Service" ADD COLUMN "price" TEXT NOT NULL DEFAULT '';
ALTER TABLE "InterventionRequest" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'autre';
ALTER TABLE "InterventionRequest" ADD COLUMN "urgency" TEXT NOT NULL DEFAULT 'flexible';
ALTER TABLE "InterventionRequest" ADD COLUMN "contactPref" TEXT NOT NULL DEFAULT 'appel';

CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'image/jpeg',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Photo_businessId_idx" ON "Photo"("businessId");
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PageEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "withCode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PageEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PageEvent_businessId_createdAt_idx" ON "PageEvent"("businessId", "createdAt");
ALTER TABLE "PageEvent" ADD CONSTRAINT "PageEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RequestPhoto" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestPhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RequestPhoto_requestId_idx" ON "RequestPhoto"("requestId");
ALTER TABLE "RequestPhoto" ADD CONSTRAINT "RequestPhoto_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "InterventionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
