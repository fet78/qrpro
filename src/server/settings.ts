import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import type { Setting } from "@/generated/prisma/client";

/** Réglages de la marque (une ligne). Créée avec les valeurs par défaut si absente. */
export const getSettings = cache(async (): Promise<Setting> => {
  return (await db.setting.findUnique({ where: { id: "main" } })) ?? (await db.setting.create({ data: { id: "main" } }));
});
