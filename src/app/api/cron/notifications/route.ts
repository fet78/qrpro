import { env } from "@/lib/env";
import { processNotifications } from "@/server/notify/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reprise des notifications en attente ou en échec temporaire (fournisseur indisponible, serveur redémarré…).
 * À appeler toutes les 10 minutes (cron-job.org, gratuit) : assez pour reprendre un échec temporaire
 * sans consommer inutilement le quota de l'hébergeur et de la base. L'envoi normal, lui, est immédiat
 * (après la réponse au client) et ne dépend pas de cet appel.
 * Protégé par CRON_SECRET (en-tête « Authorization: Bearer <secret> »).
 */
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET non configuré", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Non autorisé", { status: 401 });
  const stats = await processNotifications({ limit: 100 });
  return Response.json({ ok: true, ...stats });
}
