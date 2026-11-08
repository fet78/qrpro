/**
 * Tarification QR Pro, partagée navigateur / serveur (le serveur recalcule toujours le montant).
 *
 *  1. Offre QR Pro — prix unique, payé une seule fois : page professionnelle en ligne, QR code permanent,
 *     configurateur d'étiquettes et fichiers d'impression ILLIMITÉS (le QR ne change jamais : réimprimer est gratuit).
 *  2. Étiquettes imprimées et livrées — prix dégressif par quantité, impression ET livraison comprises
 *     (aucun frais ajouté au moment de payer). L'offre QR Pro est ajoutée une seule fois, si le compte n'est pas encore actif.
 */

export interface Tier {
  id: string;
  quantity: number;
  /** Prix total TTC, livraison comprise. */
  priceCents: number;
}

export interface Line {
  label: string;
  detail?: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
}

export const OFFER_NAME = "Offre QR Pro";

/** Ce que comprend l'offre numérique (affiché partout de la même façon). */
export const OFFER_FEATURES = [
  "Votre page professionnelle en ligne, modifiable à vie",
  "Votre QR code permanent : il ne change jamais",
  "Le configurateur d'étiquettes et ses 36 modèles",
  "Fichiers prêts à imprimer (PDF A4, PNG 600 dpi, SVG), téléchargements illimités",
  "Réimpressions gratuites, autant que vous voulez",
] as const;

export function unitCents(t: Tier): number {
  return Math.round(t.priceCents / t.quantity);
}

/** Palier mis en avant : le meilleur équilibre prix / quantité pour un artisan (100 si proposé). */
export function recommendedTier(tiers: Tier[]): Tier | undefined {
  return tiers.find((t) => t.quantity === 100) ?? tiers[Math.floor(tiers.length / 2)];
}

/** Économie par étiquette par rapport au plus petit palier, en %. */
export function savingPct(t: Tier, tiers: Tier[]): number {
  const base = tiers.reduce<Tier | undefined>((a, b) => (!a || b.quantity < a.quantity ? b : a), undefined);
  if (!base || base.id === t.id) return 0;
  return Math.max(0, Math.round((1 - unitCents(t) / unitCents(base)) * 100));
}

/** Devis d'une commande : lignes et total. `tier` absent = offre numérique seule. */
export function quote(args: { activated: boolean; digitalPriceCents: number; tier?: Tier | null; formatLabel?: string }): { lines: Line[]; totalCents: number } {
  const lines: Line[] = [];
  if (!args.activated) {
    lines.push({ label: OFFER_NAME, detail: "Page pro, QR code permanent, fichiers d'impression illimités — paiement unique", quantity: 1, unitCents: args.digitalPriceCents, totalCents: args.digitalPriceCents });
  }
  if (args.tier) {
    lines.push({
      label: `${args.tier.quantity} étiquettes autocollantes imprimées${args.formatLabel ? ` (${args.formatLabel})` : ""}`,
      detail: "Impression, découpe, contrôle et livraison suivie comprises",
      quantity: 1,
      unitCents: args.tier.priceCents,
      totalCents: args.tier.priceCents,
    });
  }
  return { lines, totalCents: lines.reduce((s, l) => s + l.totalCents, 0) };
}

export function invoiceNumber(seq: number, date: Date): string {
  return `FA-${date.getFullYear()}-${String(seq).padStart(4, "0")}`;
}
