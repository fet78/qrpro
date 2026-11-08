import { db } from "@/server/db";
import { appUrl } from "@/lib/env";
import { CODE_RE } from "@/lib/slug";

/**
 * Adresse courte contenue dans les QR codes : /q/CODE → /p/<slug>/<CODE>.
 * Redirection temporaire (307) : si un jour le domaine ou la structure évolue, aucun navigateur
 * ne garde l'ancienne cible en cache. Le scan est compté sur la page d'arrivée.
 */
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  if (!CODE_RE.test(code)) return new Response("Étiquette introuvable", { status: 404 });
  const qr = await db.qrCode.findUnique({ where: { code }, select: { business: { select: { slug: true } } } });
  if (!qr) return new Response("Étiquette introuvable", { status: 404 });
  return Response.redirect(`${appUrl()}/p/${qr.business.slug}/${code}`, 307);
}
