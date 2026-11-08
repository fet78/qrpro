-- Nouvelle offre commerciale : une offre QR Pro à prix unique (un QR code principal, impressions illimitées)
-- + étiquettes imprimées livrées à prix dégressif, livraison comprise. Fin des crédits par étiquette.

-- AlterEnum
ALTER TYPE "OrderKind" ADD VALUE 'ACTIVATION';

-- Business : activation + coordonnées de facturation
ALTER TABLE "Business"
ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "activationSource" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "billCity" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "billLine1" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "billLine2" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "billName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "billPostal" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "billSiret" TEXT NOT NULL DEFAULT '';

-- Les comptes qui ont déjà payé ou déjà posé des étiquettes restent actifs (leurs QR codes doivent continuer à fonctionner).
UPDATE "Business" b SET "activatedAt" = NOW(), "activationSource" = 'reprise'
WHERE EXISTS (SELECT 1 FROM "QrCode" q WHERE q."businessId" = b."id")
   OR EXISTS (SELECT 1 FROM "Order" o WHERE o."businessId" = b."id" AND o."paidAt" IS NOT NULL);

ALTER TABLE "Business" DROP COLUMN "credits";

-- Order : lignes facturées, facture, adresse de facturation
ALTER TABLE "Order" ADD COLUMN     "billCity" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "billLine1" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "billLine2" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "billName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "billPostal" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "billSiret" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "includesActivation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "lines" JSONB;
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");

-- Tarifs imprimés : prix total livraison comprise (nouvelle grille)
DELETE FROM "PrintTier";
ALTER TABLE "PrintTier" DROP COLUMN "unitPriceCents",
ADD COLUMN     "priceCents" INTEGER NOT NULL;
INSERT INTO "PrintTier" ("id", "quantity", "priceCents", "active") VALUES
  ('tier_25', 25, 2500, true),
  ('tier_50', 50, 3900, true),
  ('tier_100', 100, 5900, true),
  ('tier_250', 250, 11900, true),
  ('tier_500', 500, 19900, true);

-- QrCode : QR principal (un par compte), sans lot
ALTER TABLE "QrCode" ADD COLUMN     "main" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "batchId" DROP NOT NULL,
ALTER COLUMN "position" SET DEFAULT 0;
CREATE UNIQUE INDEX "QrCode_one_main_per_business" ON "QrCode"("businessId") WHERE "main";

-- Setting : prix de l'offre, séquence des factures
ALTER TABLE "Setting" DROP COLUMN "freeCredits",
ADD COLUMN     "digitalPriceCents" INTEGER NOT NULL DEFAULT 3900,
ADD COLUMN     "invoiceSeq" INTEGER NOT NULL DEFAULT 0;

-- Anciennes offres
DROP TABLE "Pack";
DROP TABLE "ShippingRate";
