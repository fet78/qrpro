import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { dataFor, designOf, ensureMainCode, labelAssets, LABEL_BUSINESS_SELECT } from "@/server/business";
import { getSettings } from "@/server/settings";
import { renderSheetPdf, LabelCheckError } from "@/lib/labels/pdf";
import { FORMATS, sheetLayout } from "@/lib/labels/formats";
import { loadServerFonts } from "@/lib/labels/fonts-server";

export const runtime = "nodejs";

/**
 * Planche A4 à imprimer soi-même (offre QR Pro active) : le design validé, répété sur 1 à 20 pages,
 * toujours avec le même QR code principal. Téléchargement illimité et gratuit : rien n'est consommé.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.businessId) return new Response("Non authentifié", { status: 401 });
  const pages = Math.min(20, Math.max(1, Number(new URL(req.url).searchParams.get("pages")) || 1));
  const [b, design] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: user.businessId }, select: { ...LABEL_BUSINESS_SELECT, activatedAt: true } }),
    db.labelDesign.findUnique({ where: { businessId: user.businessId } }),
  ]);
  if (!b.activatedAt) return new Response("Activez l'offre QR Pro pour télécharger vos fichiers.", { status: 402 });
  if (!design?.validatedAt) return new Response("Validez d'abord votre étiquette dans « Mon étiquette ».", { status: 409 });
  const doc = designOf(design);
  const { code } = await ensureMainCode(b.id);
  const count = sheetLayout(doc.format).perPage * pages;
  const s = await getSettings();
  try {
    await loadServerFonts();
    const { logo, photos } = await labelAssets(b, doc);
    const items = Array.from({ length: count }, () => dataFor(b, code));
    const pdf = await renderSheetPdf({ doc, items, logoPng: logo, photos, brandName: s.brandName, title: `Étiquettes ${b.slug}` });
    const f = FORMATS[doc.format];
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="etiquettes-${b.slug}-${f.w}x${f.h}mm-${count}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof LabelCheckError) return new Response(`Contrôle de lisibilité échoué : ${e.message}`, { status: 422 });
    throw e;
  }
}
