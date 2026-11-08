import { isFormatKey, type FormatKey } from "./formats";
import { parseDoc, type LabelDoc, type LabelData, type Palette } from "./doc";
import { buildTemplate, getTemplate, paletteByKey } from "./library";
import { ACCENTS, isAccentKey } from "./palette";
import { phoneFr } from "@/lib/format";

/** Adresse lisible de la page d'une étiquette (affichée au pro, partagée). */
export function publicUrl(base: string, slug: string, code: string): string {
  return `${base.replace(/\/$/, "")}/p/${slug}/${code}`;
}

/**
 * Contenu du QR : adresse courte et permanente /q/CODE, redirigée vers /p/<slug>/<code>.
 * Moins de caractères = moins de modules = QR plus petit et plus lisible à taille égale.
 * Les étiquettes imprimées avant (adresse longue) restent valables.
 */
export function qrUrl(base: string, code: string): string {
  return `${base.replace(/\/$/, "")}/q/${code}`;
}

/** Données d'une étiquette précise (variables du design + URL du QR). */
export function labelData(b: { name: string; trade: string; phone: string; email: string; website: string; city: string; zone: string; logoWidth: number | null; logoHeight: number | null; hasLogo: boolean }, url: string, code: string): LabelData {
  return {
    name: b.name,
    trade: b.trade,
    phone: phoneFr(b.phone),
    email: b.email,
    website: b.website,
    city: b.city,
    zone: b.zone,
    url,
    code,
    logo: b.hasLogo && b.logoWidth && b.logoHeight ? { w: b.logoWidth, h: b.logoHeight } : null,
  };
}

/** Données d'exemple pour l'aperçu (code fictif ABCDEFG). */
export function sampleCode() {
  return "ABCDEFG";
}

/**
 * Design enregistré → document v2. Accepte un document v2 ({ doc }), un document v2 brut,
 * ou un ancien design v1 (modèle + couleur + textes), converti vers le modèle équivalent.
 */
export function storedToDoc(raw: unknown, fallbackFormat: FormatKey = "F50X50"): LabelDoc {
  const r = raw as Record<string, unknown> | null;
  const asDoc = parseDoc(r && typeof r === "object" && "doc" in r ? r.doc : r);
  if (asDoc) return asDoc;
  const format = r && isFormatKey(r.format) ? (r.format as FormatKey) : fallbackFormat;
  const legacy = r && typeof r.template === "string" ? r.template : "classique";
  const doc = buildTemplate(getTemplate(legacy).key, format);
  if (r && isAccentKey(r.accent) && (legacy === "personnalise" || legacy === "premium")) {
    const a = ACCENTS[r.accent as keyof typeof ACCENTS];
    const palette: Palette = legacy === "premium" ? { ...doc.palette, primary: a.light, accent: a.light } : { ...doc.palette, primary: a.main, secondary: a.soft };
    return { ...doc, palette };
  }
  return doc;
}

export function defaultDoc(format: FormatKey = "F50X50"): LabelDoc {
  return buildTemplate("professionnel", format, { palette: paletteByKey("atlantique") });
}
