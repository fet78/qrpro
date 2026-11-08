import { describe, expect, it } from "vitest";
import { quote, recommendedTier, savingPct, unitCents, invoiceNumber, OFFER_NAME, type Tier } from "./pricing";

const TIERS: Tier[] = [
  { id: "a", quantity: 25, priceCents: 2500 },
  { id: "b", quantity: 50, priceCents: 3900 },
  { id: "c", quantity: 100, priceCents: 5900 },
  { id: "d", quantity: 250, priceCents: 11900 },
  { id: "e", quantity: 500, priceCents: 19900 },
];

describe("Tarification", () => {
  it("offre numérique seule : une ligne, le prix unique", () => {
    const q = quote({ activated: false, digitalPriceCents: 3900 });
    expect(q.lines.map((l) => l.label)).toEqual([OFFER_NAME]);
    expect(q.totalCents).toBe(3900);
  });

  it("première commande imprimée : offre + étiquettes, livraison comprise, rien d'autre", () => {
    const q = quote({ activated: false, digitalPriceCents: 3900, tier: TIERS[2], formatLabel: "50 × 50 mm" });
    expect(q.lines).toHaveLength(2);
    expect(q.totalCents).toBe(3900 + 5900);
    expect(q.lines[1]!.label).toContain("100 étiquettes");
  });

  it("compte déjà actif : l'offre n'est jamais facturée deux fois", () => {
    expect(quote({ activated: true, digitalPriceCents: 3900, tier: TIERS[0] }).totalCents).toBe(2500);
    expect(quote({ activated: true, digitalPriceCents: 3900 }).lines).toEqual([]);
  });

  it("prix dégressif : chaque palier coûte moins cher à l'étiquette que le précédent", () => {
    for (let i = 1; i < TIERS.length; i++) expect(unitCents(TIERS[i]!)).toBeLessThan(unitCents(TIERS[i - 1]!));
    expect(savingPct(TIERS[0]!, TIERS)).toBe(0);
    expect(savingPct(TIERS[4]!, TIERS)).toBe(60);
  });

  it("palier conseillé : 100 étiquettes", () => {
    expect(recommendedTier(TIERS)?.quantity).toBe(100);
  });

  it("numéro de facture chronologique", () => {
    expect(invoiceNumber(7, new Date("2026-11-08T10:00:00Z"))).toBe("FA-2026-0007");
  });
});
