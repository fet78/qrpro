import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { verifyFileSignature } from "@/server/notify/signed";

/**
 * Pièce jointe d'une demande (photo ou PDF). Accès : le professionnel concerné, l'admin,
 * ou un lien signé à durée limitée envoyé dans la notification email.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const signed = verifyFileSignature(id, sp.get("e"), sp.get("s"));
  const user = signed ? null : await getCurrentUser();
  if (!signed && !user) return new Response("Lien expiré ou non autorisé. Connectez-vous à votre espace pour voir cette pièce jointe.", { status: 401 });
  const p = await db.requestPhoto.findUnique({ where: { id }, select: { data: true, mime: true, name: true, request: { select: { businessId: true } } } });
  if (!p || (!signed && user!.role !== "ADMIN" && p.request.businessId !== user!.businessId)) return new Response("Introuvable", { status: 404 });
  const pdf = p.mime === "application/pdf";
  return new Response(new Uint8Array(p.data), {
    headers: {
      "Content-Type": pdf ? "application/pdf" : "image/jpeg",
      "Content-Disposition": `${pdf && sp.get("dl") ? "attachment" : "inline"}; filename="${(p.name || (pdf ? "document.pdf" : "photo.jpg")).replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'",
      "Referrer-Policy": "no-referrer",
    },
  });
}
