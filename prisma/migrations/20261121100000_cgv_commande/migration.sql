-- Preuve d'acceptation des CGV pour chaque commande (date + version du texte).
ALTER TABLE "Order" ADD COLUMN "cgvAcceptedAt" TIMESTAMP(3),
ADD COLUMN "cgvVersion" TEXT NOT NULL DEFAULT '';
