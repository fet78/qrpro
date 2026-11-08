-- Éditeur v3 : nouveaux formats, images importées dans les étiquettes.
ALTER TYPE "LabelFormat" ADD VALUE IF NOT EXISTS 'F40X40';
ALTER TYPE "LabelFormat" ADD VALUE IF NOT EXISTS 'F90X60';
ALTER TABLE "Photo" ADD COLUMN "usage" TEXT NOT NULL DEFAULT 'gallery';
