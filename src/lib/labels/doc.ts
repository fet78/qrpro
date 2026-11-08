import { z } from "zod";
import { FORMATS, FORMAT_KEYS, type FormatKey } from "./formats";
import { GRAPHICS } from "./graphics";

/** Graphismes « art » : proportions conservées lors d'un changement de format. */
const ART_RATIO: Record<string, true> = Object.fromEntries(Object.entries(GRAPHICS).filter(([, g]) => g.kind === "art" && !g.stretch).map(([k]) => [k, true]));

/**
 * Document d'étiquette (éditeur v2). Tout est en millimètres, origine en haut à gauche.
 * Les calques sont dessinés dans l'ordre du tableau ; le QR code est TOUJOURS au premier plan,
 * noir sur fond blanc avec sa zone de sécurité (imposé par normalizeDoc, impossible à contourner).
 *
 * Couleurs : un hexadécimal (#RRGGBB) ou un rôle de la palette ("$primary", "$secondary",
 * "$accent", "$ink", "$paper") — changer la palette restyle tout le design.
 * Polices : une famille (FONT_KEYS) ou un rôle ("$heading", "$body").
 * Textes : peuvent contenir des variables {nom}, {telephone}… remplacées par les données du pro,
 * avec une valeur de repli facultative : {metier|Entretien · Dépannage}.
 */

export const DOC_VERSION = 2;

// ------------------------------------------------------------------ Polices

export const FONTS = {
  inter: { label: "Inter", style: "Moderne", regular: "Inter_400Regular.ttf", bold: "Inter_700Bold.ttf" },
  montserrat: { label: "Montserrat", style: "Géométrique", regular: "Montserrat_500Medium.ttf", bold: "Montserrat_800ExtraBold.ttf" },
  spacegrotesk: { label: "Space Grotesk", style: "Créatif", regular: "SpaceGrotesk_400Regular.ttf", bold: "SpaceGrotesk_700Bold.ttf" },
  oswald: { label: "Oswald", style: "Industriel", regular: "Oswald_400Regular.ttf", bold: "Oswald_700Bold.ttf" },
  bebas: { label: "Bebas Neue", style: "Affiche", regular: "BebasNeue_400Regular.ttf", bold: "BebasNeue_400Regular.ttf" },
  robotoslab: { label: "Roboto Slab", style: "Robuste", regular: "RobotoSlab_400Regular.ttf", bold: "RobotoSlab_700Bold.ttf" },
  playfair: { label: "Playfair Display", style: "Élégant", regular: "PlayfairDisplay_400Regular.ttf", bold: "PlayfairDisplay_700Bold.ttf" },
} as const;
export type FontKey = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as FontKey[];
export type FontRef = FontKey | "$heading" | "$body";

/** Associations de polices prêtes à l'emploi (titres / textes). */
export const FONT_PAIRS: { key: string; label: string; heading: FontKey; body: FontKey }[] = [
  { key: "moderne", label: "Moderne", heading: "inter", body: "inter" },
  { key: "geometrique", label: "Géométrique", heading: "montserrat", body: "inter" },
  { key: "industriel", label: "Industriel", heading: "oswald", body: "inter" },
  { key: "affiche", label: "Affiche", heading: "bebas", body: "montserrat" },
  { key: "robuste", label: "Robuste", heading: "robotoslab", body: "inter" },
  { key: "elegant", label: "Élégant", heading: "playfair", body: "inter" },
  { key: "creatif", label: "Créatif", heading: "spacegrotesk", body: "spacegrotesk" },
];

// ------------------------------------------------------------------ Couleurs

export const PALETTE_ROLES = ["primary", "secondary", "accent", "ink", "paper"] as const;
export type PaletteRole = (typeof PALETTE_ROLES)[number];
export type Palette = Record<PaletteRole, string>;
export const ROLE_LABELS: Record<PaletteRole, string> = { primary: "Principale", secondary: "Secondaire", accent: "Accent", ink: "Texte", paper: "Fond" };

/** Harmonies de couleurs prêtes à l'emploi (contrastes vérifiés par les tests). */
export const PALETTES: { key: string; label: string; palette: Palette }[] = [
  { key: "atlantique", label: "Atlantique", palette: { primary: "#1D4ED8", secondary: "#DBEAFE", accent: "#C2410C", ink: "#0B1F4D", paper: "#FFFFFF" } },
  { key: "braise", label: "Braise", palette: { primary: "#C2410C", secondary: "#FFEDD5", accent: "#1F2937", ink: "#1C1917", paper: "#FFFFFF" } },
  { key: "foret", label: "Forêt", palette: { primary: "#166534", secondary: "#DCFCE7", accent: "#A16207", ink: "#14231A", paper: "#FFFFFF" } },
  { key: "ardoise", label: "Ardoise", palette: { primary: "#334155", secondary: "#E2E8F0", accent: "#0369A1", ink: "#0F172A", paper: "#FFFFFF" } },
  { key: "nuit", label: "Nuit dorée", palette: { primary: "#C9A54C", secondary: "#1E293B", accent: "#E9CF7A", ink: "#F8F5EC", paper: "#0F172A" } },
  { key: "carbone", label: "Carbone", palette: { primary: "#FACC15", secondary: "#27272A", accent: "#FFFFFF", ink: "#FAFAFA", paper: "#111111" } },
  { key: "creme", label: "Crème", palette: { primary: "#7C2D12", secondary: "#EADBC8", accent: "#9A3412", ink: "#292524", paper: "#FBF7F0" } },
  { key: "glacier", label: "Glacier", palette: { primary: "#0E7490", secondary: "#CFFAFE", accent: "#BE123C", ink: "#083344", paper: "#FFFFFF" } },
  { key: "bordeaux", label: "Bordeaux", palette: { primary: "#881337", secondary: "#FFE4E6", accent: "#8A6A2F", ink: "#2A0A14", paper: "#FFFFFF" } },
  { key: "violet", label: "Améthyste", palette: { primary: "#6D28D9", secondary: "#EDE9FE", accent: "#B45309", ink: "#1E1035", paper: "#FFFFFF" } },
  { key: "chantier", label: "Chantier", palette: { primary: "#FACC15", secondary: "#171717", accent: "#F97316", ink: "#111111", paper: "#FFFFFF" } },
  { key: "plan", label: "Plan technique", palette: { primary: "#7DD3FC", secondary: "#1E3A5F", accent: "#FDE68A", ink: "#F0F9FF", paper: "#0B2545" } },
  { key: "cuivre", label: "Cuivre", palette: { primary: "#A3542A", secondary: "#F3E6DA", accent: "#2F4F4F", ink: "#1F1A17", paper: "#FFFDF9" } },
  { key: "sauge", label: "Sauge", palette: { primary: "#3F6B52", secondary: "#E3EEE6", accent: "#B7791F", ink: "#1B2B22", paper: "#FFFFFF" } },
  { key: "mono", label: "Monochrome", palette: { primary: "#111111", secondary: "#E5E5E5", accent: "#525252", ink: "#111111", paper: "#FFFFFF" } },
];

export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
export type ColorRef = string; // "#RRGGBB" | "$role"

export function resolveColor(c: ColorRef | undefined, palette: Palette): string | null {
  if (!c || c === "none") return null;
  if (c.startsWith("$")) return palette[c.slice(1) as PaletteRole] ?? null;
  return HEX_RE.test(c) ? c.toUpperCase() : null;
}

// ------------------------------------------------------------------ Variables

export const VARIABLES = [
  { key: "nom", label: "Nom de l'entreprise" },
  { key: "metier", label: "Métier" },
  { key: "telephone", label: "Téléphone" },
  { key: "email", label: "Email" },
  { key: "site", label: "Site internet" },
  { key: "ville", label: "Ville" },
  { key: "zone", label: "Zone d'intervention" },
  { key: "code", label: "Code de l'étiquette" },
] as const;
export type VariableKey = (typeof VARIABLES)[number]["key"];

export interface LabelData {
  name: string;
  trade: string;
  phone: string;
  email: string;
  website: string;
  city: string;
  zone: string;
  /** URL permanente contenue dans le QR. */
  url: string;
  code: string;
  logo: { w: number; h: number } | null;
  /** Photos du pro utilisables dans les étiquettes (id → dimensions en px). */
  images?: Record<string, { w: number; h: number }>;
}

export function resolveText(text: string, d: LabelData): string {
  const values: Record<VariableKey, string> = {
    nom: d.name,
    metier: d.trade,
    telephone: d.phone,
    email: d.email,
    site: d.website.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    ville: d.city,
    zone: d.zone,
    code: d.code,
  };
  return text.replace(/\{([a-z]+)(?:\|([^}]*))?\}/g, (m, key: string, fallback?: string) => {
    if (!(key in values)) return m;
    return values[key as VariableKey] || fallback || "";
  });
}

// ------------------------------------------------------------------ Éléments

export type ShapeKind = "rect" | "ellipse" | "polygon" | "line";

interface Base {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Nom affiché dans les calques. */
  name?: string;
  locked?: boolean;
  hidden?: boolean;
  opacity?: number;
  /** Affiché uniquement si le pro a un logo (ex. pastille blanche derrière le logo). */
  withLogo?: boolean;
}

export interface TextEl extends Base {
  type: "text";
  text: string;
  font: FontRef;
  bold: boolean;
  size: number;
  color: ColorRef;
  align: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  uppercase?: boolean;
  /** Espacement des lettres en em (ex. 0.08). */
  tracking?: number;
  lineHeight?: number;
  /** Nombre maximal de lignes (1 = jamais de retour à la ligne, ex. un numéro de téléphone). */
  maxLines?: number;
}

export interface ShapeEl extends Base {
  type: "shape";
  shape: ShapeKind;
  fill: ColorRef;
  stroke?: ColorRef;
  strokeWidth?: number;
  radius?: number;
  /** Polygone : points normalisés 0..1 dans la boîte. */
  points?: [number, number][];
  dashed?: boolean;
}

export interface IconEl extends Base {
  type: "icon";
  icon: string;
  color: ColorRef;
  strokeWidth?: number;
}

export interface LogoEl extends Base {
  type: "logo";
}

/** Illustration, forme, badge, ornement ou motif de la bibliothèque (graphics.ts). */
export interface GraphicEl extends Base {
  type: "graphic";
  graphic: string;
  color: ColorRef;
  /** Épaisseur du trait (dessins au trait et motifs). */
  strokeWidth?: number;
  /** Densité des motifs (1 = normale). */
  density?: number;
}

/** Photo importée par le pro (recadrée pour remplir son cadre, coins arrondis possibles). */
export interface ImageEl extends Base {
  type: "image";
  src: string;
  radius?: number;
}

export interface QrEl extends Base {
  type: "qr";
  /** Rayon des coins du panneau blanc (mm). */
  radius?: number;
}

export type Element = TextEl | ShapeEl | IconEl | LogoEl | GraphicEl | ImageEl | QrEl;
export type ElementType = Element["type"];

export interface LabelDoc {
  version: 2;
  format: FormatKey;
  /** Modèle d'origine (bibliothèque), pour l'adaptation automatique de format. */
  template?: string;
  /** true dès que le client a modifié la composition. */
  edited?: boolean;
  corner: number;
  background: ColorRef;
  palette: Palette;
  fonts: { heading: FontKey; body: FontKey };
  elements: Element[];
}

// ------------------------------------------------------------------ Règles de lisibilité

/**
 * QR + zone blanche, en mm. L'adresse courte (/q/CODE, 29 modules) permet 16 mm avec des modules
 * de 0,43 mm : lisible par n'importe quel smartphone à 15–20 cm. La taille des modules est contrôlée en plus.
 */
export const MIN_QR_MM = 16;
/** Marge de sécurité intérieure (découpe), en mm. */
export const SAFE_MM = 1.5;
/** Taille de texte minimale conseillée (≈ 5 pt). */
export const MIN_TEXT_MM = 1.8;
export const MAX_ELEMENTS = 40;

let seq = 0;
export function newId(prefix = "el"): string {
  seq = (seq + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Remet le document dans un état sûr : un seul QR, carré, au premier plan, assez grand,
 * entièrement dans l'étiquette ; éléments bornés. Appliqué à chaque modification et côté serveur.
 */
export function normalizeDoc(doc: LabelDoc): LabelDoc {
  const { w, h } = FORMATS[doc.format];
  const qrs = doc.elements.filter((e): e is QrEl => e.type === "qr");
  let qr: QrEl = qrs[0] ?? { id: "qr", type: "qr", x: (w - 26) / 2, y: (h - 26) / 2, w: 26, h: 26, radius: 1.2 };
  const maxQr = Math.min(w, h) - 2;
  const size = Math.max(MIN_QR_MM, Math.min(maxQr, Math.max(qr.w, qr.h)));
  qr = {
    ...qr,
    w: size,
    h: size,
    x: clamp(qr.x, 1, w - size - 1),
    y: clamp(qr.y, 1, h - size - 1),
    hidden: false,
    opacity: 1,
    radius: clamp(qr.radius ?? 1.2, 0, 4),
    name: "QR code",
  };
  const others = doc.elements
    .filter((e) => e.type !== "qr")
    .slice(0, MAX_ELEMENTS - 1)
    .map((e) => ({ ...e, w: Math.max(0.3, e.w), h: Math.max(0.3, e.h) }));
  return { ...doc, corner: clamp(doc.corner, 0, 8), elements: [...others, qr] };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Adapte un design à un autre format : positions et tailles mises à l'échelle,
 * textes et icônes proportionnels à la plus petite dimension, QR conservé carré.
 */
export function rescaleDoc(doc: LabelDoc, format: FormatKey): LabelDoc {
  const a = FORMATS[doc.format];
  const b = FORMATS[format];
  const sx = b.w / a.w;
  const sy = b.h / a.h;
  const s = Math.min(sx, sy);
  const elements = doc.elements.map((e) => {
    if (e.type === "qr" || e.type === "icon" || e.type === "logo" || (e.type === "graphic" && e.graphic in ART_RATIO)) {
      const size = Math.max(e.w, e.h) * s;
      const cx = (e.x + e.w / 2) * sx;
      const cy = (e.y + e.h / 2) * sy;
      const nw = e.type === "qr" ? size : e.w * s;
      const nh = e.type === "qr" ? size : e.h * s;
      return { ...e, x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    }
    const moved = { ...e, x: e.x * sx, y: e.y * sy, w: e.w * sx, h: e.h * sy };
    if (e.type === "text") return { ...moved, size: e.size * s };
    return moved;
  });
  return normalizeDoc({ ...doc, format, elements });
}

// ------------------------------------------------------------------ Schéma (validation serveur)

const num = (min: number, max: number) => z.number().finite().min(min).max(max);
const color = z.string().max(12).refine((c) => c === "none" || HEX_RE.test(c) || (c.startsWith("$") && PALETTE_ROLES.includes(c.slice(1) as PaletteRole)), "Couleur invalide");
const fontRef = z.string().refine((f) => f === "$heading" || f === "$body" || f in FONTS, "Police inconnue");
const base = {
  id: z.string().min(1).max(60),
  x: num(-200, 400),
  y: num(-200, 400),
  w: num(0.1, 400),
  h: num(0.1, 400),
  name: z.string().max(40).optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  opacity: num(0, 1).optional(),
  withLogo: z.boolean().optional(),
};

export const elementSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("text"),
    text: z.string().max(160),
    font: fontRef,
    bold: z.boolean(),
    size: num(0.8, 30),
    color,
    align: z.enum(["left", "center", "right"]),
    valign: z.enum(["top", "middle", "bottom"]).optional(),
    uppercase: z.boolean().optional(),
    tracking: num(-0.1, 0.5).optional(),
    lineHeight: num(0.8, 2).optional(),
    maxLines: z.number().int().min(1).max(8).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("shape"),
    shape: z.enum(["rect", "ellipse", "polygon", "line"]),
    fill: color,
    stroke: color.optional(),
    strokeWidth: num(0, 5).optional(),
    radius: num(0, 100).optional(),
    points: z.array(z.tuple([num(-1, 2), num(-1, 2)])).min(3).max(24).optional(),
    dashed: z.boolean().optional(),
  }),
  z.object({ ...base, type: z.literal("icon"), icon: z.string().max(40), color, strokeWidth: num(0.5, 4).optional() }),
  z.object({ ...base, type: z.literal("logo") }),
  z.object({ ...base, type: z.literal("graphic"), graphic: z.string().max(40), color, strokeWidth: num(0.05, 8).optional(), density: num(0.3, 3).optional() }),
  z.object({ ...base, type: z.literal("image"), src: z.string().regex(/^[a-z0-9]{10,40}$/), radius: num(0, 50).optional() }),
  z.object({ ...base, type: z.literal("qr"), radius: num(0, 4).optional() }),
]);

export const docSchema = z.object({
  version: z.literal(2),
  format: z.enum(FORMAT_KEYS as [FormatKey, ...FormatKey[]]),
  template: z.string().max(40).optional(),
  edited: z.boolean().optional(),
  corner: num(0, 8),
  background: color,
  palette: z.object(Object.fromEntries(PALETTE_ROLES.map((r) => [r, z.string().regex(HEX_RE)])) as Record<PaletteRole, z.ZodString>),
  fonts: z.object({ heading: z.enum(FONT_KEYS as [FontKey, ...FontKey[]]), body: z.enum(FONT_KEYS as [FontKey, ...FontKey[]]) }),
  elements: z.array(elementSchema).min(1).max(MAX_ELEMENTS),
});

export function parseDoc(raw: unknown): LabelDoc | null {
  const r = docSchema.safeParse(raw);
  return r.success ? normalizeDoc(r.data as LabelDoc) : null;
}
