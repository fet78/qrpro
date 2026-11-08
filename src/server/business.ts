import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/server/db";
import { slugify, isValidSlug, CODE_ALPHABET, CODE_LENGTH } from "@/lib/slug";
import { appUrl } from "@/lib/env";
import { labelData, qrUrl, storedToDoc, defaultDoc } from "@/lib/labels/content";
import type { LabelDoc, LabelData } from "@/lib/labels/doc";
import type { FormatKey } from "@/lib/labels/formats";
import type { Prisma, LabelFormat } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/** Slug libre le plus proche du nom (suffixe -2, -3… si déjà pris). */
export async function availableSlug(name: string, excludeBusinessId?: string): Promise<string> {
  let base = slugify(name) || "entreprise";
  if (base.length < 3) base = `${base}-pro`;
  if (!isValidSlug(base)) base = `${base}-pro`.slice(0, 48);
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? base : `${base.slice(0, 44)}-${i}`;
    const taken = await db.business.findFirst({ where: { slug: candidate, ...(excludeBusinessId ? { id: { not: excludeBusinessId } } : {}) }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base.slice(0, 38)}-${Date.now().toString(36)}`;
}

function randomCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/** Codes uniques (vérifiés en base, et garantis par l'index unique). */
async function uniqueCodes(tx: Tx, count: number): Promise<string[]> {
  const out = new Set<string>();
  while (out.size < count) {
    const batch = Array.from({ length: count - out.size + 4 }, randomCode).filter((c) => !out.has(c));
    const existing = await tx.qrCode.findMany({ where: { code: { in: batch } }, select: { code: true } });
    const taken = new Set(existing.map((e) => e.code));
    for (const c of batch) if (!taken.has(c) && out.size < count) out.add(c);
  }
  return [...out];
}

/** Champs du professionnel utilisés par les variables des étiquettes. */
export const LABEL_BUSINESS_SELECT = {
  id: true, slug: true, name: true, trade: true, phone: true, email: true, website: true, city: true, zone: true,
  logo: true, logoWidth: true, logoHeight: true,
  // Photos du pro (étiquettes d'abord, puis réalisations) : utilisables dans les designs.
  photos: { select: { id: true, width: true, height: true, usage: true }, orderBy: [{ usage: "desc" as const }, { position: "asc" as const }] as { usage?: "desc"; position?: "asc" }[] },
} as const;

type LabelBusiness = { slug: string; name: string; trade: string; phone: string; email: string; website: string; city: string; zone: string; logo: Uint8Array | Buffer | null; logoWidth: number | null; logoHeight: number | null; photos: { id: string; width: number; height: number; usage?: string }[] };

export function dataFor(b: LabelBusiness, code: string): LabelData {
  return {
    ...labelData({ ...b, hasLogo: !!b.logo }, qrUrl(appUrl(), code), code),
    images: Object.fromEntries(b.photos.map((p) => [p.id, { w: p.width, h: p.height }])),
  };
}

/** Photos réellement utilisées par un design (pour le PDF et le SVG autonome). */
export function usedPhotoIds(doc: LabelDoc): string[] {
  return [...new Set(doc.elements.filter((e) => e.type === "image" && !e.hidden).map((e) => (e as { src: string }).src))];
}

export async function photoBytes(businessId: string, ids: string[]): Promise<Record<string, Uint8Array>> {
  if (!ids.length) return {};
  const rows = await db.photo.findMany({ where: { businessId, id: { in: ids } }, select: { id: true, data: true } });
  return Object.fromEntries(rows.map((r) => [r.id, new Uint8Array(r.data)]));
}

export function logoDataUrl(b: { logo: Uint8Array | Buffer | null }): string | null {
  return b.logo ? `data:image/png;base64,${Buffer.from(b.logo).toString("base64")}` : null;
}

/** Design actuel d'un professionnel (document v2 ; ancien design converti ; à défaut, modèle par défaut). */
export function designOf(row: { doc: unknown; templateKey: string; format: string; accent: string; headline: string; subline: string; showLogo: boolean; showPhone: boolean } | null): LabelDoc {
  if (!row) return defaultDoc();
  if (row.doc) return storedToDoc(row.doc, row.format as FormatKey);
  return storedToDoc({ template: row.templateKey, format: row.format, accent: row.accent }, row.format as FormatKey);
}

/**
 * QR code principal du professionnel : UN seul code permanent, imprimé sur toutes ses étiquettes
 * (fichiers numériques comme commandes imprimées). Créé à l'activation de l'offre, idempotent.
 */
export async function ensureMainCode(businessId: string, tx: Tx | typeof db = db): Promise<{ id: string; code: string }> {
  const existing = await tx.qrCode.findFirst({ where: { businessId, main: true }, select: { id: true, code: true } });
  if (existing) return existing;
  const [code] = await uniqueCodes(tx as Tx, 1);
  try {
    return await tx.qrCode.create({ data: { code: code!, businessId, main: true }, select: { id: true, code: true } });
  } catch {
    // Création simultanée (index unique partiel « un QR principal par compte ») : on reprend celui qui existe.
    return await tx.qrCode.findFirstOrThrow({ where: { businessId, main: true }, select: { id: true, code: true } });
  }
}

export async function mainCode(businessId: string): Promise<{ id: string; code: string } | null> {
  return db.qrCode.findFirst({ where: { businessId, main: true }, select: { id: true, code: true } });
}

/**
 * Lot imprimé d'une commande : copie figée du design + quantité. Toutes les étiquettes portent
 * le QR code principal (aucun nouveau code n'est créé).
 */
export async function createPrintBatch(tx: Tx, args: { businessId: string; count: number; doc: LabelDoc }) {
  return tx.batch.create({
    data: { businessId: args.businessId, count: args.count, format: args.doc.format as LabelFormat, design: { doc: args.doc } as unknown as Prisma.InputJsonValue, printed: true },
  });
}

export async function labelAssets(b: { id: string; logo: Uint8Array | Buffer | null }, doc: LabelDoc) {
  return { logo: b.logo ? new Uint8Array(b.logo) : null, photos: await photoBytes(b.id, usedPhotoIds(doc)) };
}

/**
 * Toutes les étiquettes d'un lot, prêtes pour le moteur PDF. Anciens lots : un code par étiquette.
 * Lots récents : `count` fois le QR code principal.
 */
export async function batchLabels(batchId: string): Promise<{ doc: LabelDoc; items: LabelData[]; logo: Uint8Array | null; photos: Record<string, Uint8Array>; slug: string; name: string }> {
  const batch = await db.batch.findUniqueOrThrow({
    where: { id: batchId },
    include: { codes: { orderBy: { position: "asc" }, select: { code: true } }, business: { select: LABEL_BUSINESS_SELECT } },
  });
  const doc = storedToDoc(batch.design, batch.format as FormatKey);
  const b = batch.business;
  const codes = batch.codes.length ? batch.codes.map((c) => c.code) : Array<string>(batch.count).fill((await ensureMainCode(b.id)).code);
  return { doc, items: codes.map((c) => dataFor(b, c)), ...(await labelAssets(b, doc)), slug: b.slug, name: b.name };
}

/** Design d'une étiquette : celui figé dans son lot (anciennes étiquettes numérotées), sinon le design actuel du pro. */
export async function codeDoc(c: { businessId: string; batch: { design: unknown; format: string } | null }): Promise<LabelDoc> {
  if (c.batch) return storedToDoc(c.batch.design, c.batch.format as FormatKey);
  return designOf(await db.labelDesign.findUnique({ where: { businessId: c.businessId } }));
}
