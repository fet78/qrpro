import { z } from "zod";
import { FORM_KINDS, DEFAULT_PROBLEMS } from "./requests";
import { FONTS, type FontKey } from "@/lib/labels/doc";

/**
 * Configuration de la vitrine publique d'un professionnel (colonne Business.page).
 * Tout est facultatif : une section ou un bouton ne s'affiche que si l'information existe.
 */

// ------------------------------------------------------------------ Styles

export const PAGE_STYLES = {
  moderne: { label: "Moderne", description: "Bandeau couleur, cartes nettes. Polyvalent et rassurant.", font: "inter" as FontKey, dark: false },
  immersif: { label: "Immersif", description: "Grande photo de réalisation en couverture, boutons sur verre dépoli.", font: "montserrat" as FontKey, dark: true },
  epure: { label: "Épuré", description: "Éditorial et aéré : grande typographie, filets fins, pas de cartes.", font: "playfair" as FontKey, dark: false },
  nuit: { label: "Nuit", description: "Fond sombre premium, accents lumineux. Très haut de gamme.", font: "montserrat" as FontKey, dark: true },
  chaleureux: { label: "Chaleureux", description: "Tons doux, grandes cartes arrondies, esprit artisan de confiance.", font: "robotoslab" as FontKey, dark: false },
} as const;
export type PageStyle = keyof typeof PAGE_STYLES;
export const PAGE_STYLE_KEYS = Object.keys(PAGE_STYLES) as PageStyle[];

// ------------------------------------------------------------------ Sections

export const SECTIONS = {
  install: { label: "Votre installation", hint: "Affichée uniquement quand on scanne une étiquette renseignée" },
  emergency: { label: "Message important", hint: "Bandeau d'alerte (sécurité, urgence)" },
  highlights: { label: "Points forts", hint: "Ex. : devis gratuit, intervention sous 24 h" },
  about: { label: "Présentation", hint: "Description de l'entreprise" },
  services: { label: "Services", hint: "Prestations et indications de prix" },
  gallery: { label: "Réalisations", hint: "Galerie de photos" },
  trust: { label: "Certifications & garanties", hint: "RGE, Qualibat, assurance décennale…" },
  hours: { label: "Horaires", hint: "Avec statut ouvert / fermé en direct" },
  zone: { label: "Zone d'intervention", hint: "Zone, adresse et itinéraire" },
  review: { label: "Avis Google", hint: "Invite vos clients à laisser un avis" },
  tips: { label: "Conseils et documents", hint: "Gestes utiles, notices" },
  payments: { label: "Moyens de paiement", hint: "Carte, chèque, virement…" },
  request: { label: "Demande d'intervention", hint: "Formulaire de contact et de devis" },
} as const;
export type SectionKey = keyof typeof SECTIONS;
export const SECTION_KEYS = Object.keys(SECTIONS) as SectionKey[];
export const DEFAULT_SECTIONS: { key: SectionKey; visible: boolean }[] = [
  "install", "emergency", "highlights", "about", "services", "gallery", "trust", "hours", "zone", "review", "tips", "payments", "request",
].map((key) => ({ key: key as SectionKey, visible: true }));

// ------------------------------------------------------------------ Boutons d'action

export const ACTIONS = {
  call: { label: "Appeler" },
  whatsapp: { label: "WhatsApp" },
  sms: { label: "SMS" },
  email: { label: "Email" },
  request: { label: "Demande d'intervention" },
  quote: { label: "Demande de devis" },
  emergency: { label: "Urgence" },
  message: { label: "Message" },
  directions: { label: "Itinéraire" },
  save: { label: "Enregistrer le contact" },
  share: { label: "Partager" },
  review: { label: "Laisser un avis" },
  website: { label: "Site internet" },
} as const;
export type ActionKey = keyof typeof ACTIONS;
export const ACTION_KEYS = Object.keys(ACTIONS) as ActionKey[];
export const DEFAULT_ACTIONS: ActionKey[] = ["call", "request", "quote", "emergency", "message", "whatsapp", "directions", "save", "share", "review"];

// ------------------------------------------------------------------ Confiance

export const CERT_KINDS = {
  rge: "RGE",
  qualibat: "Qualibat",
  qualipac: "QualiPAC",
  qualigaz: "Qualigaz",
  qualibois: "Qualibois",
  qualisol: "Qualisol",
  pgn: "Professionnel du Gaz (PG)",
  fluides: "Attestation de capacité fluides frigorigènes",
  decennale: "Assurance décennale",
  rcpro: "Responsabilité civile pro",
  garantie: "Garantie",
  autre: "Autre",
} as const;
export type CertKind = keyof typeof CERT_KINDS;

export const PAYMENT_METHODS = { cb: "Carte bancaire", cheque: "Chèque", especes: "Espèces", virement: "Virement", plusieurs: "Paiement en plusieurs fois", cheque_energie: "Chèque énergie", maprimerenov: "MaPrimeRénov' (selon éligibilité)" } as const;
export type PaymentKey = keyof typeof PAYMENT_METHODS;

export const LINK_KINDS = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok", autre: "Lien" } as const;
export type LinkKind = keyof typeof LINK_KINDS;

// ------------------------------------------------------------------ Schéma

const httpUrl = z.union([z.literal(""), z.string().trim().max(400).url("Adresse web invalide").refine((u) => /^https:\/\//i.test(u), "L'adresse doit commencer par https://")]);
const phone = z.union([z.literal(""), z.string().trim().regex(/^[\d\s+().-]{6,20}$/, "Numéro invalide")]);

export const pageConfigSchema = z.object({
  style: z.enum(PAGE_STYLE_KEYS as [PageStyle, ...PageStyle[]]),
  font: z.union([z.literal(""), z.enum(Object.keys(FONTS) as [FontKey, ...FontKey[]])]),
  tagline: z.string().trim().max(90, "90 caractères maximum"),
  coverPhotoId: z.string().max(40),
  sections: z.array(z.object({ key: z.enum(SECTION_KEYS as [SectionKey, ...SectionKey[]]), visible: z.boolean() })).max(SECTION_KEYS.length),
  actions: z.array(z.enum(ACTION_KEYS as [ActionKey, ...ActionKey[]])).max(ACTION_KEYS.length),
  primaryAction: z.enum(["call", "request", "whatsapp"]),
  stickyBar: z.boolean(),
  whatsapp: phone,
  smsEnabled: z.boolean(),
  googleReviewUrl: httpUrl,
  googleMapsUrl: httpUrl,
  links: z.array(z.object({ kind: z.enum(Object.keys(LINK_KINDS) as [LinkKind, ...LinkKind[]]), url: httpUrl.refine((u) => !!u, "Adresse requise") })).max(8, "8 liens maximum"),
  highlights: z.array(z.string().trim().min(1).max(40, "40 caractères maximum")).max(6, "6 points forts maximum"),
  foundedYear: z.union([z.literal(0), z.number().int().min(1900).max(2100)]),
  certifications: z
    .array(
      z.object({
        kind: z.enum(Object.keys(CERT_KINDS) as [CertKind, ...CertKind[]]),
        label: z.string().trim().max(60),
        detail: z.string().trim().max(80),
        validUntil: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")]),
        url: httpUrl,
      }),
    )
    .max(10, "10 certifications maximum"),
  payments: z.array(z.enum(Object.keys(PAYMENT_METHODS) as [PaymentKey, ...PaymentKey[]])).max(10),
  requestKinds: z.boolean(),
  requestPhotos: z.boolean(),
  /** Formulaire de demande personnalisable. */
  requestTypes: z.array(z.enum(FORM_KINDS)).min(1, "Proposez au moins un type de demande").max(FORM_KINDS.length),
  requestProblems: z.array(z.string().trim().min(1).max(40, "40 caractères maximum")).max(12, "12 problèmes maximum"),
  requestAddress: z.enum(["off", "optional", "required"]),
  requestAvailability: z.boolean(),
  requestIntro: z.string().trim().max(200, "200 caractères maximum"),
});
export type PageConfig = z.infer<typeof pageConfigSchema>;

export const DEFAULT_PAGE: PageConfig = {
  style: "moderne",
  font: "",
  tagline: "",
  coverPhotoId: "",
  sections: DEFAULT_SECTIONS,
  actions: DEFAULT_ACTIONS,
  primaryAction: "call",
  stickyBar: true,
  whatsapp: "",
  smsEnabled: false,
  googleReviewUrl: "",
  googleMapsUrl: "",
  links: [],
  highlights: [],
  foundedYear: 0,
  certifications: [],
  payments: [],
  requestKinds: true,
  requestPhotos: true,
  requestTypes: [...FORM_KINDS],
  requestProblems: DEFAULT_PROBLEMS,
  requestAddress: "optional",
  requestAvailability: true,
  requestIntro: "",
};

/** Configuration stockée → configuration complète et valide (champs manquants complétés, sections nouvelles ajoutées). */
export function parsePageConfig(raw: unknown): PageConfig {
  const merged = { ...DEFAULT_PAGE, ...(raw && typeof raw === "object" ? (raw as object) : {}) };
  const r = pageConfigSchema.safeParse(merged);
  const cfg = r.success ? r.data : DEFAULT_PAGE;
  const seen = new Set(cfg.sections.map((s) => s.key));
  // Pages créées avant les boutons Devis / Urgence / Message : ils s'ajoutent après « Demande ».
  let actions = cfg.actions;
  const stored = raw && typeof raw === "object" ? (raw as { actions?: unknown }).actions : undefined;
  if (Array.isArray(stored) && stored.includes("request") && !["quote", "emergency", "message"].some((k) => stored.includes(k))) {
    const i = actions.indexOf("request");
    actions = [...actions.slice(0, i + 1), "quote", "emergency", "message", ...actions.slice(i + 1)] as typeof actions;
  }
  return { ...cfg, actions, sections: [...cfg.sections, ...DEFAULT_SECTIONS.filter((s) => !seen.has(s.key))] };
}

// ------------------------------------------------------------------ Aides

/** Numéro mobile français → lien WhatsApp international (wa.me), sinon null. */
export function whatsappLink(raw: string, text?: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (/^0[1-9]\d{8}$/.test(d)) d = `33${d.slice(1)}`;
  if (!/^\d{8,15}$/.test(d)) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Un numéro est-il un mobile (06/07) ? Utile pour proposer SMS et WhatsApp à bon escient. */
export function isMobile(raw: string): boolean {
  const d = raw.replace(/[^\d+]/g, "");
  return /^0[67]\d{8}$/.test(d) || /^\+33[67]\d{8}$/.test(d);
}

export function certIsValid(validUntil: string, now = new Date()): boolean {
  return !validUntil || new Date(`${validUntil}T23:59:59`) >= now;
}
