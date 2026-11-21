import { env } from "@/lib/env";
import { processNotifications } from "@/server/notify/dispatch";
import { runDailyPurge } from "@/server/purge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reprise des notifications en attente ou en échec temporaire (fournisseur indisponible, serveur redémarré…).
 * À appeler toutes les 10 minutes (cron-job.org, gratuit) : assez pour reprendre un échec temporaire
 * sans consommer inutilement le quota de l'hébergeur et de la base. L'envoi normal, lui, est immédiat
 * (après la réponse au client) et ne dépend pas de cet appel.
 * Le même appel lance, une fois par jour au plus, la purge des données anciennes (RGPD).
 * Protégé par CRON_SECRET (en-tête « Authorization: Bearer <secret> »).
 */
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET non configuré", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Non autorisé", { status: 401 });
  const stats = await processNotifications({ limit: 100 });
  // Une purge en échec ne bloque pas les notifications ; elle sera retentée au prochain passage du jour suivant.
  const purge = await runDailyPurge().catch((e) => {
    console.error("[purge]", e);
    return { ran: false, error: true };
  });
  return Response.json({ ok: true, ...stats, purge });
}
