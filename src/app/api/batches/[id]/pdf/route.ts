import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { batchLabels } from "@/server/business";
import { getSettings } from "@/server/settings";
import { renderSheetPdf, LabelCheckError } from "@/lib/labels/pdf";
import { FORMATS } from "@/lib/labels/formats";
import { loadServerFonts } from "@/lib/labels/fonts-server";

export const runtime = "nodejs";

/**
 * Planche A4 d'un lot. Accès : le propriétaire du lot, ou un administrateur (fichier de production).
 * Le PDF est régénéré à chaque téléchargement depuis les codes en base (le contenu de la page peut avoir changé).
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non authentifié", { status: 401 });
  const { id } = await params;
  const batch = await db.batch.findUnique({ where: { id }, select: { businessId: true } });
  if (!batch || (user.role !== "ADMIN" && batch.businessId !== user.businessId)) return new Response("Introuvable", { status: 404 });

  const { doc, items, logo, photos, slug } = await batchLabels(id);
  const s = await getSettings();
  try {
    await loadServerFonts();
    const pdf = await renderSheetPdf({ doc, items, logoPng: logo, photos, brandName: s.brandName, title: `Étiquettes ${slug}` });
    const f = FORMATS[doc.format];
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="etiquettes-${slug}-${f.w}x${f.h}mm-${items.length}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof LabelCheckError) return new Response(`Contrôle de lisibilité échoué : ${e.message}`, { status: 422 });
    throw e;
  }
}
