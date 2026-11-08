import "server-only";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { fingerprint } from "@/server/auth/tokens";
import { isProd } from "@/lib/env";

/**
 * Compteur à fenêtre fixe stocké en base (fonctionne avec plusieurs instances serverless).
 * Renvoie false quand la limite est atteinte. Hors production, les plafonds sont multipliés par 20
 * (tests répétés depuis la même machine) ; en production ils s'appliquent tels quels.
 */
export async function rateLimit(scope: string, subject: string, maxProd: number, windowSeconds: number): Promise<boolean> {
  const max = isProd() ? maxProd : maxProd * 20;
  const key = `${scope}:${fingerprint(subject)}`;
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (!row || row.resetAt <= now) {
    await db.rateLimit.upsert({ where: { key }, create: { key, count: 1, resetAt }, update: { count: 1, resetAt } });
    return true;
  }
  if (row.count >= max) return false;
  await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return true;
}

/** Adresse IP du client (en-têtes posés par Vercel / le proxy). Utilisée uniquement hachée. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
