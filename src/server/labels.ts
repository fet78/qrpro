import "server-only";
import { db } from "@/server/db";
import { designOf, dataFor, logoDataUrl, mainCode, LABEL_BUSINESS_SELECT } from "@/server/business";
import { sampleCode } from "@/lib/labels/content";

/** Tout ce dont l'éditeur, les commandes et les aperçus ont besoin pour dessiner les étiquettes d'un pro. */
export async function labelContext(businessId: string) {
  const b = await db.business.findUniqueOrThrow({ where: { id: businessId }, select: { ...LABEL_BUSINESS_SELECT, activatedAt: true, design: true } });
  return {
    slug: b.slug,
    activated: !!b.activatedAt,
    doc: designOf(b.design),
    validated: !!b.design?.validatedAt,
    /** Données d'aperçu : vraies coordonnées du pro ; son vrai QR une fois l'offre active, un code d'exemple avant. */
    data: dataFor(b, (b.activatedAt ? (await mainCode(b.id))?.code : null) ?? sampleCode()),
    logoDataUrl: logoDataUrl(b),
    /** Photos utilisables dans les designs (étiquettes d'abord). */
    photos: b.photos.map((p) => ({ id: p.id, w: p.width, h: p.height, usage: p.usage === "label" ? ("label" as const) : ("gallery" as const) })),
  };
}
