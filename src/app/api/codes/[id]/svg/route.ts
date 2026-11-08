import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { codeDoc, dataFor, logoDataUrl, photoBytes, usedPhotoIds, LABEL_BUSINESS_SELECT } from "@/server/business";
import { loadServerFonts } from "@/lib/labels/fonts-server";
import { renderDoc, blockingIssues } from "@/lib/labels/render";
import { labelSvg, qrOnlySvg } from "@/lib/labels/svg";

export const runtime = "nodejs";

/**
 * Une étiquette en SVG (vectoriel, texte en contours, dimensions réelles) — ou le QR seul avec ?type=qr.
 * ?inline=1 : renvoyé pour affichage / conversion PNG dans le navigateur, sinon en pièce jointe.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non authentifié", { status: 401 });
  const { id } = await params;
  const code = await db.qrCode.findUnique({
    where: { id },
    include: { batch: { select: { design: true, format: true } }, business: { select: LABEL_BUSINESS_SELECT } },
  });
  if (!code || (user.role !== "ADMIN" && code.businessId !== user.businessId)) return new Response("Introuvable", { status: 404 });
  if (user.role !== "ADMIN" && !(await db.business.findUnique({ where: { id: code.businessId }, select: { activatedAt: true } }))?.activatedAt) {
    return new Response("Activez l'offre QR Pro pour télécharger vos fichiers.", { status: 402 });
  }

  await loadServerFonts();
  const doc = await codeDoc(code);
  const label = renderDoc(doc, dataFor(code.business, code.code));
  const photos = await photoBytes(code.business.id, usedPhotoIds(doc));
  const images = Object.fromEntries(Object.entries(photos).map(([k, b]) => [k, `data:${b[0] === 0x89 ? "image/png" : "image/jpeg"};base64,${Buffer.from(b).toString("base64")}`]));
  if (blockingIssues(label).length) return new Response("Contrôle de lisibilité échoué", { status: 422 });

  const sp = new URL(req.url).searchParams;
  const onlyQr = sp.get("type") === "qr";
  const svg = onlyQr ? qrOnlySvg(label) : labelSvg(label, { logoHref: logoDataUrl(code.business), images });
  const name = onlyQr ? `qr-${code.code}.svg` : `etiquette-${code.code}.svg`;
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `${sp.get("inline") ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
