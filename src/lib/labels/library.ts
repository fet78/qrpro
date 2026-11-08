import { FORMATS, type FormatKey } from "./formats";
import { T, R, E, Poly, Line, Frame, I, LOGO, QR, NAME, TRADE, PHONE, SCAN, qrSize, resetIds } from "./kit";
import { TEMPLATES_V3 } from "./templates-v3";
import {
  type LabelDoc, type Element, type Palette, type FontKey, PALETTES, normalizeDoc, rescaleDoc,
} from "./doc";

/**
 * Bibliothèque de modèles. Chaque modèle est une COMPOSITION (fonction des dimensions réelles),
 * pas une variation de couleur : position du QR, structure, formes, typographie et hiérarchie changent.
 * Les couleurs passent par les rôles de palette ($primary…) et les polices par $heading/$body :
 * le client peut restyler n'importe quel modèle en un clic sans casser la mise en page.
 */

export const CATEGORIES = ["Métier", "Moderne", "Minimaliste", "Premium", "Industriel", "Illustré", "Photo", "Professionnel", "Élégant", "Créatif"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface TemplateDef {
  key: string;
  name: string;
  category: Category;
  description: string;
  palette: string;
  fonts: { heading: FontKey; body: FontKey };
  corner?: number;
  background?: string;
  /** Formats pris en charge (par défaut : tous sauf le 40 × 40, trop petit pour les compositions riches). */
  formats?: FormatKey[];
  /** Mots-clés de recherche (métiers, ambiance…). */
  keywords?: string;
  /** Le modèle met en scène une photo du pro (avec une variante graphique s'il n'en a pas). */
  usesPhoto?: boolean;
  /**
   * `logo` : le pro a-t-il un logo ? (certaines compositions se recalent sans logo)
   * `photo` : identifiant d'une photo du pro à mettre en scène, ou null.
   */
  build: (w: number, h: number, o: { logo: boolean; photo: string | null }) => Element[];
}

const LEGACY_FORMATS: FormatKey[] = ["F50X50", "F60X40", "F70X50", "F90X60"];
export const formatsOf = (t: TemplateDef): FormatKey[] => t.formats ?? LEGACY_FORMATS;

// ------------------------------------------------------------------ Modèles

const LEGACY: TemplateDef[] = [
  // ───────────── Minimaliste
  {
    key: "classique",
    name: "Classique",
    category: "Minimaliste",
    description: "Fond blanc, cadre fin, lecture immédiate.",
    palette: "mono",
    fonts: { heading: "inter", body: "inter" },
    corner: 2,
    build: (w, h) => {
      if (w === h) {
        const q = qrSize(w, h, 0.54);
        return [Frame(1, w, h, "$secondary", 0.35, 1.5), T(3, 2.4, w - 6, 5.6, NAME, { font: "$heading", bold: true, size: 3.4, align: "center" }), QR((w - q) / 2, 8.6, q), T(3, 8.6 + q + 0.6, w - 6, 3, SCAN, { size: 2.1, color: "$accent", align: "center" }), T(3, h - 6.8, w - 6, 4.4, PHONE, { bold: true, size: 3.4, align: "center" })];
      }
      const q = qrSize(w, h);
      const cx = q + 4;
      return [Frame(1, w, h, "$secondary", 0.35, 1.5), QR(2.2, (h - q) / 2, q), T(cx, 3, w - cx - 2.5, 9, NAME, { font: "$heading", bold: true, size: 3.4, valign: "top" }), T(cx, 12, w - cx - 2.5, 3.5, TRADE, { size: 2, color: "$accent", valign: "top" }), Line(cx, 17.5, 9, "$secondary"), T(cx, 19, w - cx - 2.5, h - 30, SCAN, { size: 2.3, color: "$accent", valign: "top" }), T(cx, h - 8, w - cx - 2.5, 5, PHONE, { bold: true, size: 3.3 })];
    },
  },
  {
    key: "epure",
    name: "Épure",
    category: "Minimaliste",
    description: "Le numéro en grand, rien d'autre.",
    palette: "ardoise",
    fonts: { heading: "inter", body: "inter" },
    corner: 1,
    build: (w, h) => {
      if (w === h) {
        const q = 25;
        return [QR(w - q - 2.5, 2.5, q), T(3, 3, w - q - 7, 4, "SCAN", { bold: true, size: 2.2, tracking: 0.25, color: "$primary", valign: "top" }), R(3, 8.5, 6, 0.8, "$primary"), T(3, 30, w - 6, 5, NAME, { font: "$heading", bold: true, size: 3.2, valign: "bottom" }), T(3, 35.5, w - 6, 3, TRADE, { size: 2, color: "$accent", valign: "top" }), T(3, 40, w - 6, 7, PHONE, { font: "$heading", bold: true, size: 5, valign: "bottom" })];
      }
      const q = qrSize(w, h);
      const tw = w - q - 7;
      return [QR(w - q - 2.2, (h - q) / 2, q), T(3, 3, tw, 3, "SCANNEZ-MOI", { bold: true, size: 2, tracking: 0.22, color: "$primary", valign: "top" }), R(3, 7, 6, 0.8, "$primary"), T(3, 9, tw, h - 23, NAME, { font: "$heading", bold: true, size: 3.4, valign: "top" }), T(3, h - 14, tw, 3, TRADE, { size: 1.9, color: "$accent" }), T(3, h - 10.5, tw, 7.5, PHONE, { font: "$heading", bold: true, size: 4.6, valign: "bottom" })];
    },
  },
  {
    key: "monochrome",
    name: "Monochrome",
    category: "Minimaliste",
    description: "Cadre épais et lettres capitales, très lisible de loin.",
    palette: "mono",
    fonts: { heading: "bebas", body: "inter" },
    corner: 0,
    build: (w, h) => {
      if (w === h) {
        const q = 25;
        return [Frame(1.6, w, h, "$ink", 1.4), T(4, 4, w - 8, 7, NAME, { font: "$heading", size: 6, align: "center", uppercase: true }), QR((w - q) / 2, 11.5, q, 0), R(4, h - 12.5, w - 8, 8.5, "$ink"), T(5, h - 12.5, w - 10, 8.5, PHONE, { font: "$heading", size: 6, align: "center", color: "$paper" })];
      }
      const q = qrSize(w, h) - 1;
      const cx = q + 5.5;
      return [Frame(1.6, w, h, "$ink", 1.4), QR(3.6, (h - q) / 2, q, 0), T(cx, 4, w - cx - 4, h - 20, NAME, { font: "$heading", size: 7, uppercase: true, valign: "top", lineHeight: 1 }), R(cx, h - 13.5, w - cx - 4, 9.5, "$ink"), T(cx + 1, h - 13.5, w - cx - 6, 9.5, PHONE, { font: "$heading", size: 5.6, align: "center", color: "$paper" })];
    },
  },

  // ───────────── Professionnel
  {
    key: "professionnel",
    name: "Bandeau pro",
    category: "Professionnel",
    description: "Bandeau de couleur, logo et téléphone mis en avant.",
    palette: "atlantique",
    fonts: { heading: "inter", body: "inter" },
    corner: 2,
    build: (w, h, o) => {
      const band = w === h ? 11 : Math.round(h * 0.24 * 10) / 10;
      const lx = o.logo ? band + 0.4 : 3;
      const head: Element[] = [R(0, 0, w, band, "$primary", { name: "Bandeau" }), R(2.4, 2.2, band - 4.4, band - 4.4, "$paper", { radius: 1, withLogo: true, name: "Fond du logo" }), LOGO(2.9, 2.7, band - 5.4, band - 5.4), T(lx, 1.6, w - lx - 2.6, band * 0.5 - 1.2, NAME, { font: "$heading", bold: true, size: 3.1, color: "$paper", valign: "bottom", maxLines: 1 }), T(lx, band * 0.52, w - lx - 2.6, band * 0.48 - 1.6, TRADE, { size: 1.8, color: "$secondary", uppercase: true, tracking: 0.04, valign: "top" })];
      if (w === h) {
        const q = 25;
        return [...head, QR((w - q) / 2, band + 1, q), T(3, band + q + 1.3, w - 6, 3, SCAN, { size: 2, color: "$ink", align: "center" }), I(9.5, h - 6.6, 3.4, "phone", "$primary"), T(14, h - 7, w - 18, 4.2, PHONE, { bold: true, size: 3.1, color: "$primary" })];
      }
      const q = h - band - 3;
      const cx = q + 4;
      return [...head, QR(2, band + 1.5, q), T(cx, band + 2.5, w - cx - 2.5, h - band - 13, SCAN, { size: 2.4, valign: "top" }), I(cx, h - 7.6, 3.6, "phone", "$primary"), T(cx + 4.6, h - 8, w - cx - 7, 4.4, PHONE, { bold: true, size: 3, color: "$primary" })];
    },
  },
  {
    key: "personnalise",
    name: "Aux couleurs",
    category: "Professionnel",
    description: "Votre couleur et votre logo, fond teinté.",
    palette: "braise",
    fonts: { heading: "montserrat", body: "inter" },
    corner: 2.5,
    background: "$secondary",
    build: (w, h, o) => {
      const band = w === h ? 11.5 : Math.round(h * 0.25 * 10) / 10;
      const lx = o.logo ? band + 0.4 : 3;
      const head: Element[] = [R(0, 0, w, band, "$primary"), R(2.4, 2.2, band - 4.4, band - 4.4, "$paper", { radius: 1.2, withLogo: true, name: "Fond du logo" }), LOGO(2.9, 2.7, band - 5.4, band - 5.4), T(lx, 1.6, w - lx - 2.6, band - 3.2, NAME, { font: "$heading", bold: true, size: 3.2, color: "$paper" })];
      if (w === h) {
        const q = 25;
        return [...head, QR(3, band + 2, q), T(q + 5, band + 2.5, w - q - 7.5, q - 1, "Une panne ? Un entretien ? Scannez", { font: "$heading", bold: true, size: 2.6, color: "$primary", valign: "top" }), R(3, h - 9, w - 6, 6.5, "$paper", { radius: 3.25 }), I(5, h - 8.2, 4.8, "phone", "$primary"), T(10.8, h - 9, w - 15, 6.5, PHONE, { bold: true, size: 3.2 })];
      }
      const q = h - band - 3.5;
      const cx = q + 4.5;
      return [...head, QR(2.2, band + 1.8, q), T(cx, band + 2.2, w - cx - 2.5, h - band - 14, "Une panne ? Un entretien ? Scannez", { font: "$heading", bold: true, size: 2.6, color: "$primary", valign: "top" }), R(cx, h - 10, w - cx - 2.5, 7, "$paper", { radius: 3.5 }), I(cx + 1.6, h - 9, 5, "phone", "$primary"), T(cx + 7.4, h - 10, w - cx - 11, 7, PHONE, { bold: true, size: 3 })];
    },
  },
  {
    key: "chauffagiste",
    name: "Chauffagiste",
    category: "Professionnel",
    description: "Pictogramme flamme et barre d'appel, pensé pour les chaudières.",
    palette: "braise",
    fonts: { heading: "montserrat", body: "inter" },
    corner: 2,
    build: (w, h) => {
      if (w === h) {
        const q = 24;
        return [E(-9, -9, 23, 23, "$primary", { name: "Pastille" }), I(2.2, 2.2, 7.6, "flame", "$paper", 2.2), T(16, 2.4, w - 18.5, 5, NAME, { font: "$heading", bold: true, size: 3, valign: "top" }), T(16, 7.8, w - 18.5, 3, "Chauffage · Entretien", { size: 1.9, color: "$primary", uppercase: true, tracking: 0.05, valign: "top" }), QR((w - q) / 2, 14, q), R(0, h - 9.5, w, 9.5, "$ink", { name: "Barre d'appel" }), I(4, h - 7.3, 5, "phone", "$primary"), T(10.5, h - 8.2, w - 13, 6.6, PHONE, { bold: true, size: 3.6, color: "$paper" })];
      }
      const bar = Math.max(9, h * 0.2);
      const q = h - bar - 4;
      return [E(-11, -11, 25, 25, "$primary"), I(2.2, 2.2, 7.6, "flame", "$paper", 2.2), QR(w - q - 2.5, 2, q), T(2.6, 15.5, w - q - 7, h - bar - 21.5, NAME, { font: "$heading", bold: true, size: 3.4, valign: "top" }), T(2.6, h - bar - 5.5, w - q - 7, 3, "Chauffage · Entretien", { size: 1.8, color: "$primary", uppercase: true, tracking: 0.05 }), R(0, h - bar, w, bar, "$ink"), I(3.5, h - bar / 2 - 2.6, 5.2, "phone", "$primary"), T(10.5, h - bar + 1, w - 13, bar - 2.6, PHONE, { bold: true, size: 4, color: "$paper" })];
    },
  },
  {
    key: "fiche",
    name: "Fiche d'entretien",
    category: "Professionnel",
    description: "Lignes à compléter au stylo : date de pose et d'entretien.",
    palette: "atlantique",
    fonts: { heading: "robotoslab", body: "inter" },
    corner: 1.5,
    build: (w, h) => {
      if (w === h) {
        const q = 21;
        const lx = q + 4.5;
        const lw = w - lx - 2.5;
        return [R(0, 0, w, 8.5, "$primary"), T(3, 1.5, w - 6, 6, NAME, { font: "$heading", bold: true, size: 3, color: "$paper", maxLines: 1 }), QR(2.5, 10.5, q), T(lx, 11, lw, 3, "Posé le", { size: 1.9, color: "$accent", valign: "top" }), Line(lx, 18, lw, "$ink", { dashed: true, strokeWidth: 0.25 }), T(lx, 20, lw, 3, "Entretien", { size: 1.9, color: "$accent", valign: "top" }), Line(lx, 27, lw, "$ink", { dashed: true, strokeWidth: 0.25 }), T(2.5, 33, w - 5, 3, "Prochain entretien :", { size: 1.9, color: "$accent", valign: "top" }), Line(2.5, 41, w - 5, "$ink", { dashed: true, strokeWidth: 0.25 }), I(2.5, h - 7, 3.6, "phone", "$primary"), T(7, h - 7.4, w - 9.5, 4.4, PHONE, { bold: true, size: 3, color: "$primary" })];
      }
      const q = qrSize(w, h) - 3;
      const lx = q + 4.5;
      const lw = w - lx - 2.5;
      const step = (h - 14) / 3;
      const rows = ["Posé le", "Dernier entretien", "Prochain entretien"];
      return [
        R(0, 0, w, 7.5, "$primary"),
        T(2.5, 1.5, w - 5, 5.2, NAME, { font: "$heading", bold: true, size: 2.8, color: "$paper", maxLines: 1 }),
        QR(2.2, 9.2, q),
        ...rows.flatMap((label, i) => [T(lx, 9 + i * step, lw, 2.6, label, { size: 1.8, color: "$accent", valign: "top" }), Line(lx, 9 + i * step + step - 1.4, lw, "$ink", { dashed: true, strokeWidth: 0.25 })]),
        T(lx, h - 5.4, lw, 3.8, PHONE, { bold: true, size: 2.7, color: "$primary" }),
      ];
    },
  },

  // ───────────── Moderne
  {
    key: "split",
    name: "Split",
    category: "Moderne",
    description: "Bloc de couleur franc d'un côté, QR de l'autre.",
    palette: "glacier",
    fonts: { heading: "montserrat", body: "inter" },
    corner: 2.5,
    build: (w, h) => {
      if (w === h) {
        const top = 20;
        const q = h - top - 3.5;
        return [R(0, 0, w, top, "$primary"), T(3, 2.6, w - 6, 9, NAME, { font: "$heading", bold: true, size: 3.6, color: "$paper", valign: "top" }), T(3, 12.6, w - 6, 5, PHONE, { bold: true, size: 3.2, color: "$secondary", valign: "bottom" }), QR(2.5, top + 1.5, q), T(q + 4.5, top + 2, w - q - 7, q - 1, "Scannez pour nous joindre", { font: "$heading", bold: true, size: 2.6, color: "$primary", valign: "middle" })];
      }
      const block = w * 0.46;
      const q = Math.min(h - 5, w - block - 5);
      return [R(0, 0, block, h, "$primary"), T(2.8, 3, block - 5, h - 19, NAME, { font: "$heading", bold: true, size: 3.6, color: "$paper", valign: "top" }), T(2.8, h - 15, block - 5, 3, TRADE, { size: 1.8, color: "$secondary" }), T(2.8, h - 11, block - 5, 7, PHONE, { bold: true, size: 3.4, color: "$paper", valign: "bottom" }), QR(block + (w - block - q) / 2, (h - q) / 2, q)];
    },
  },
  {
    key: "pastille",
    name: "Pastille",
    category: "Moderne",
    description: "Grand disque de couleur, composition dynamique.",
    palette: "violet",
    fonts: { heading: "spacegrotesk", body: "inter" },
    corner: 3,
    build: (w, h) => {
      if (w === h) {
        const q = 24;
        return [E(w * 0.44, -h * 0.3, w * 0.86, w * 0.86, "$primary", { name: "Disque" }), E(w - 9, h - 9, 16, 16, "$accent", { name: "Point" }), QR(w - q - 3, 3, q), T(3, 3, w - q - 9, 18, NAME, { font: "$heading", bold: true, size: 3.2, valign: "top" }), T(3, 30.5, w - 13, 4, TRADE, { size: 2, color: "$ink", valign: "top" }), T(3, h - 11, w - 14, 8, PHONE, { font: "$heading", bold: true, size: 4, color: "$primary" })];
      }
      const q = qrSize(w, h);
      return [E(w - q - 5, -h * 0.3, h * 1.6, h * 1.6, "$primary"), R(3, h - 18.6, 8, 0.9, "$accent"), QR(w - q - 3, (h - q) / 2, q), T(3, 3, w - q - 8, h - 22, NAME, { font: "$heading", bold: true, size: 3.6, valign: "top" }), T(3, h - 16.5, w - q - 9, 5, TRADE, { size: 1.8, valign: "bottom" }), T(3, h - 10.5, w - q - 9, 7.5, PHONE, { font: "$heading", bold: true, size: 3.3 })];
    },
  },
  {
    key: "diagonale",
    name: "Diagonale",
    category: "Créatif",
    description: "Coupe diagonale énergique, typographie technique.",
    palette: "atlantique",
    fonts: { heading: "spacegrotesk", body: "spacegrotesk" },
    corner: 2,
    build: (w, h) => {
      if (w === h) {
        const q = 24;
        return [Poly(0, 0, w, h, [[0, 0], [1, 0], [1, 0.42], [0, 0.7]], "$primary", { name: "Diagonale" }), Poly(0, 0, w, h, [[0, 0.7], [1, 0.42], [1, 0.47], [0, 0.75]], "$accent"), T(3, 3, w - 6, 9, NAME, { font: "$heading", bold: true, size: 3.6, color: "$paper", valign: "top" }), QR(w - q - 3, h - q - 3, q), T(3, h - 12, w - q - 7.5, 9, PHONE, { font: "$heading", bold: true, size: 3, valign: "bottom" })];
      }
      const q = qrSize(w, h);
      return [Poly(0, 0, w, h, [[0, 0], [0.55, 0], [0.38, 1], [0, 1]], "$primary"), Poly(0, 0, w, h, [[0.55, 0], [0.6, 0], [0.43, 1], [0.38, 1]], "$accent"), T(3, 3, w * 0.36, h - 17, NAME, { font: "$heading", bold: true, size: 3.4, color: "$paper", valign: "top" }), T(3, h - 12, w * 0.32, 9, PHONE, { font: "$heading", bold: true, size: 2.9, color: "$paper", valign: "bottom" }), QR(w - q - 2.5, (h - q) / 2, q)];
    },
  },
  {
    key: "ticket",
    name: "Ticket",
    category: "Créatif",
    description: "Esprit billet avec talon détachable et pointillés.",
    palette: "braise",
    fonts: { heading: "bebas", body: "inter" },
    corner: 2,
    background: "$primary",
    build: (w, h) => {
      const inset = 2;
      if (w === h) {
        const q = 22;
        const sep = inset + q + 3;
        return [R(inset, inset, w - 2 * inset, h - 2 * inset, "$paper", { radius: 1.5, name: "Ticket" }), E(-2.5, sep - 2.5, 5, 5, "$primary"), E(w - 2.5, sep - 2.5, 5, 5, "$primary"), Line(5, sep, w - 10, "$accent", { dashed: true, strokeWidth: 0.3 }), QR((w - q) / 2, inset + 1.5, q), T(4.5, sep + 1.5, w - 9, 6.5, NAME, { font: "$heading", size: 5, align: "center", uppercase: true }), T(4.5, sep + 8, w - 9, 5, PHONE, { bold: true, size: 2.9, align: "center", color: "$primary" })];
      }
      const q = h - 2 * inset - 4;
      const sep = inset + q + 4;
      return [R(inset, inset, w - 2 * inset, h - 2 * inset, "$paper", { radius: 1.5 }), E(sep - 2.5, -2.5, 5, 5, "$primary"), E(sep - 2.5, h - 2.5, 5, 5, "$primary"), { ...Line(sep, h / 2, h - 10, "$accent", { dashed: true, strokeWidth: 0.3 }), x: sep - 0.5, y: 5, w: 1, h: h - 10 }, QR(inset + 2, inset + 2, q), T(sep + 2.5, 5, w - sep - 7, h - 21.5, NAME, { font: "$heading", size: 6, uppercase: true, valign: "top", lineHeight: 1 }), T(sep + 2.5, h - 15.5, w - sep - 7, 5.2, TRADE, { size: 1.8, color: "$accent", valign: "bottom" }), T(sep + 2.5, h - 9.5, w - sep - 7, 5, PHONE, { bold: true, size: 2.9, color: "$primary" })];
    },
  },
  {
    key: "bulle",
    name: "Bulle",
    category: "Créatif",
    description: "Une bulle qui interpelle : « Une panne ? »",
    palette: "glacier",
    fonts: { heading: "montserrat", body: "inter" },
    corner: 2.5,
    build: (w, h) => {
      if (w === h) {
        const q = 22;
        return [Poly(2.5, 2.5, w - 5, 15, [[0, 0], [1, 0], [1, 0.78], [0.3, 0.78], [0.18, 1], [0.18, 0.78], [0, 0.78]], "$primary", { name: "Bulle" }), I(5, 4.3, 7, "message", "$paper", 2), T(13.5, 3.2, w - 18, 9.4, "Une panne ? Scannez-moi", { font: "$heading", bold: true, size: 2.9, color: "$paper" }), QR(3, h - q - 3, q), T(q + 5, h - q - 2, w - q - 7.5, 13, NAME, { font: "$heading", bold: true, size: 2.9, valign: "top" }), T(q + 5, h - 10, w - q - 7.5, 7, PHONE, { bold: true, size: 2.9, color: "$primary", valign: "bottom" })];
      }
      const q = qrSize(w, h);
      const bx = q + 4.5;
      return [QR(2.2, (h - q) / 2, q), Poly(bx, 2.5, w - bx - 2.5, h * 0.45, [[0.08, 0], [1, 0], [1, 1], [0.08, 1], [0.08, 0.62], [0, 0.5], [0.08, 0.38]], "$primary"), T(bx + 4, 3, w - bx - 8, h * 0.45 - 1, "Une panne ? Scannez-moi", { font: "$heading", bold: true, size: 2.8, color: "$paper" }), T(bx + 0.5, h * 0.45 + 4, w - bx - 3, h - h * 0.45 - 13, NAME, { font: "$heading", bold: true, size: 2.6, valign: "top" }), T(bx + 0.5, h - 8, w - bx - 3, 5.5, PHONE, { bold: true, size: 2.9, color: "$primary" })];
    },
  },

  // ───────────── Premium
  {
    key: "premium",
    name: "Nuit dorée",
    category: "Premium",
    description: "Fond nuit, filet doré double, serif élégante.",
    palette: "nuit",
    fonts: { heading: "playfair", body: "inter" },
    corner: 2,
    background: "$paper",
    build: (w, h) => {
      const frames = [Frame(1.2, w, h, "$primary", 0.3, 1.2), Frame(2, w, h, "$primary", 0.15, 0.8)];
      if (w === h) {
        const q = 23;
        return [...frames, T(4, 3.6, w - 8, 6, NAME, { font: "$heading", bold: true, size: 3.4, align: "center" }), T(4, 9.6, w - 8, 3, TRADE, { size: 1.8, align: "center", uppercase: true, tracking: 0.12, color: "$primary" }), QR((w - q) / 2, 13.4, q, 1.6), T(4, h - 9.6, w - 8, 5.5, PHONE, { bold: true, size: 3.2, align: "center", color: "$accent" })];
      }
      const q = qrSize(w, h) - 2;
      const cx = q + 6;
      return [...frames, QR(3.8, (h - q) / 2, q, 1.6), T(cx, 4, w - cx - 4, h - 22, NAME, { font: "$heading", bold: true, size: 3.6, valign: "bottom" }), T(cx, h - 18.5, w - cx - 4, 5, TRADE, { size: 1.8, color: "$primary", valign: "bottom" }), Line(cx, h - 12.5, 10, "$primary", { strokeWidth: 0.25 }), T(cx, h - 11, w - cx - 4, 6.5, PHONE, { bold: true, size: 3.2, color: "$accent" })];
    },
  },
  {
    key: "noirmat",
    name: "Noir mat",
    category: "Premium",
    description: "Noir profond, typographie massive, accent néon.",
    palette: "carbone",
    fonts: { heading: "montserrat", body: "inter" },
    corner: 3,
    background: "$paper",
    build: (w, h) => {
      if (w === h) {
        const q = 24;
        return [QR(3, 3, q, 2.5), T(q + 5, 3, w - q - 7.5, q, NAME, { font: "$heading", bold: true, size: 3.2, valign: "top" }), R(3, q + 6.5, 8, 1, "$primary"), T(3, q + 9, w - 6, 4, TRADE, { size: 2, color: "$accent", valign: "top" }), T(3, h - 9.5, w - 6, 7, PHONE, { font: "$heading", bold: true, size: 4.4, color: "$primary" })];
      }
      const q = qrSize(w, h);
      const cx = q + 5;
      return [QR(2.5, (h - q) / 2, q, 2.5), T(cx, 3, w - cx - 3, h - 18, NAME, { font: "$heading", bold: true, size: 3.6, valign: "top" }), R(cx, h - 14, 8, 1, "$primary"), T(cx, h - 11.5, w - cx - 3, 8.5, PHONE, { font: "$heading", bold: true, size: 3.6, color: "$primary" })];
    },
  },

  // ───────────── Industriel
  {
    key: "chantier",
    name: "Chantier",
    category: "Industriel",
    description: "Bandes de signalisation jaunes et noires, impossible à rater.",
    palette: "chantier",
    fonts: { heading: "oswald", body: "inter" },
    corner: 0,
    build: (w, h) => {
      const stripe = w === h ? 6 : 5;
      const stripes = (y: number): Element[] => {
        const els: Element[] = [R(0, y, w, stripe, "$primary")];
        for (let x = -stripe; x < w + stripe; x += stripe * 1.6) els.push(Poly(x, y, stripe * 1.6, stripe, [[0, 1], [0.5, 0], [1, 0], [0.5, 1]], "$secondary"));
        return els;
      };
      const body = [...stripes(0), ...stripes(h - stripe)];
      if (w === h) {
        const q = 23;
        return [...body, QR(2.6, stripe + 2, q, 0), T(q + 4.6, stripe + 2, w - q - 7, q, "SCANNEZ POUR NOUS JOINDRE", { font: "$heading", bold: true, size: 3.2, valign: "top", uppercase: true }), T(3, stripe + q + 3, w - 6, 4, NAME, { font: "$heading", bold: true, size: 2.6, uppercase: true }), T(3, h - stripe - 6.5, w - 6, 5.5, PHONE, { font: "$heading", bold: true, size: 4, align: "left" })];
      }
      const q = h - 2 * stripe - 3;
      const cx = q + 5;
      return [...body, QR(2.4, stripe + 1.5, q, 0), T(cx, stripe + 1.6, w - cx - 2.5, h - 2 * stripe - 15.5, "SCANNEZ POUR NOUS JOINDRE", { font: "$heading", bold: true, size: 3.2, valign: "top", uppercase: true }), T(cx, h - stripe - 14, w - cx - 2.5, 7, NAME, { size: 1.9, uppercase: true, bold: true, valign: "bottom", maxLines: 2 }), T(cx, h - stripe - 6.8, w - cx - 2.5, 5.6, PHONE, { font: "$heading", bold: true, size: 3.8 })];
    },
  },
  {
    key: "plaque",
    name: "Plaque technique",
    category: "Industriel",
    description: "Façon plaque signalétique d'équipement, rivets et gravure.",
    palette: "ardoise",
    fonts: { heading: "robotoslab", body: "robotoslab" },
    corner: 2.5,
    background: "#D9DCE1",
    build: (w, h) => {
      const rivets = [[2.2, 2.2], [w - 4.2, 2.2], [2.2, h - 4.2], [w - 4.2, h - 4.2]].map(([x, y]) => E(x!, y!, 2, 2, "#9AA1AC", { stroke: "#6B7280", strokeWidth: 0.2, name: "Rivet" }));
      const inner = R(1.2, 1.2, w - 2.4, h - 2.4, "none", { stroke: "#9AA1AC", strokeWidth: 0.35, radius: 1.8 });
      if (w === h) {
        const q = 22;
        return [inner, ...rivets, T(5, 2.8, w - 10, 4, "MAINTENANCE", { font: "$heading", bold: true, size: 2.6, align: "center", tracking: 0.18, color: "$primary" }), Line(5, 8, w - 10, "$primary", { strokeWidth: 0.25 }), QR((w - q) / 2, 9.4, q, 0.6), T(4, 32, w - 8, 4.6, NAME, { font: "$heading", bold: true, size: 2.8, align: "center", uppercase: true }), T(4, 37.5, w - 8, 3, TRADE, { size: 1.8, align: "center", color: "$primary" }), T(4, h - 8.6, w - 8, 4.8, PHONE, { font: "$heading", bold: true, size: 3.2, align: "center" })];
      }
      const q = qrSize(w, h) - 3;
      const cx = q + 6.5;
      return [inner, ...rivets, QR(4.5, (h - q) / 2, q, 0.6), T(cx, 4, w - cx - 5, 4, "MAINTENANCE", { font: "$heading", bold: true, size: 2.4, tracking: 0.18, color: "$primary" }), Line(cx, 9, w - cx - 5, "$primary", { strokeWidth: 0.25 }), T(cx, 10.5, w - cx - 5, h - 25, NAME, { font: "$heading", bold: true, size: 2.9, uppercase: true, valign: "top" }), T(cx, h - 14, w - cx - 5, 3, TRADE, { size: 1.8, color: "$primary" }), T(cx, h - 10.5, w - cx - 5, 5.5, PHONE, { font: "$heading", bold: true, size: 3.2 })];
    },
  },

  // ───────────── Élégant
  {
    key: "certificat",
    name: "Certificat",
    category: "Élégant",
    description: "Fond crème, double filet, ornement et serif classique.",
    palette: "creme",
    fonts: { heading: "playfair", body: "inter" },
    corner: 1.5,
    background: "$paper",
    build: (w, h) => {
      const frames = [Frame(1.2, w, h, "$primary", 0.45, 0.8), Frame(2.3, w, h, "$primary", 0.15, 0.4)];
      const orn = (cx: number, y: number, half: number): Element[] => [Line(cx - half, y, half - 1.6, "$accent", { strokeWidth: 0.2 }), Poly(cx - 1, y - 1, 2, 2, [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]], "$accent"), Line(cx + 1.6, y, half - 1.6, "$accent", { strokeWidth: 0.2 })];
      if (w === h) {
        const q = 21;
        return [...frames, T(4, 3.6, w - 8, 3, "Entretien assuré par", { size: 1.8, align: "center", color: "$accent" }), T(4, 6.6, w - 8, 6, NAME, { font: "$heading", bold: true, size: 3.4, align: "center" }), ...orn(w / 2, 14.2, 10), QR((w - q) / 2, 16.2, q, 0.8), T(4, h - 9.4, w - 8, 5, PHONE, { font: "$heading", bold: true, size: 3, align: "center", color: "$primary" })];
      }
      const q = qrSize(w, h) - 4;
      const cx = q + 6.5;
      const tw = w - cx - 4.5;
      return [...frames, QR(4.2, (h - q) / 2, q, 0.8), T(cx, 4.4, tw, 3, "Entretien assuré par", { size: 1.8, align: "center", color: "$accent" }), T(cx, 7.4, tw, h - 23, NAME, { font: "$heading", bold: true, size: 3.4, align: "center" }), ...orn(cx + tw / 2, h - 13.6, tw / 2), T(cx, h - 11.6, tw, 6.5, PHONE, { font: "$heading", bold: true, size: 3, align: "center", color: "$primary" })];
    },
  },
  {
    key: "lignefine",
    name: "Ligne fine",
    category: "Élégant",
    description: "Composition centrée, filets fins, beaucoup d'air.",
    palette: "bordeaux",
    fonts: { heading: "playfair", body: "inter" },
    corner: 2,
    build: (w, h) => {
      if (w === h) {
        const q = 23;
        return [T(4, 2.8, w - 8, 5.4, NAME, { font: "$heading", bold: true, size: 3.4, align: "center", color: "$primary" }), Line(w / 2 - 6, 9.6, 12, "$accent", { strokeWidth: 0.25 }), QR((w - q) / 2, 11.4, q, 1), T(4, h - 14.4, w - 8, 3.4, TRADE, { size: 1.8, align: "center", uppercase: true, tracking: 0.14, color: "$accent" }), T(4, h - 10.2, w - 8, 6, PHONE, { size: 3.4, align: "center" })];
      }
      const q = qrSize(w, h) - 1;
      const cx = q + 6;
      return [QR(3, (h - q) / 2, q, 1), { ...Line(q + 4.5, h / 2, h - 10, "$accent", { strokeWidth: 0.25 }), x: q + 4, y: 5, w: 1, h: h - 10 }, T(cx, 4, w - cx - 3, h - 22, NAME, { font: "$heading", bold: true, size: 3.4, color: "$primary", valign: "bottom" }), T(cx, h - 18.5, w - cx - 3, 5, TRADE, { size: 1.8, color: "$accent", valign: "bottom" }), T(cx, h - 12, w - cx - 3, 7, PHONE, { size: 3.4 })];
    },
  },
];

/** Nouveaux modèles d'abord (QR intégré, illustrations, photos), puis les compositions historiques. */
export const TEMPLATES: TemplateDef[] = [...TEMPLATES_V3, ...LEGACY];
export const TEMPLATE_KEYS = TEMPLATES.map((t) => t.key);
export function getTemplate(key: string): TemplateDef {
  return TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0]!;
}

export function paletteByKey(key: string): Palette {
  return (PALETTES.find((p) => p.key === key) ?? PALETTES[0]!).palette;
}

/** Construit un document à partir d'un modèle, pour un format donné. */
export function buildTemplate(key: string, format: FormatKey, overrides: { palette?: Palette; fonts?: { heading: FontKey; body: FontKey }; logo?: boolean; photo?: string | null } = {}): LabelDoc {
  const t = getTemplate(key);
  // Format non prévu par le modèle : on compose dans le plus proche puis on adapte (le QR reste valide).
  const supported = formatsOf(t);
  if (!supported.includes(format)) {
    const near = [...supported].sort((a, b) => Math.abs(FORMATS[a].w / FORMATS[a].h - FORMATS[format].w / FORMATS[format].h) - Math.abs(FORMATS[b].w / FORMATS[b].h - FORMATS[format].w / FORMATS[format].h) || FORMATS[a].w - FORMATS[b].w)[0]!;
    return { ...rescaleDoc(buildTemplate(key, near, overrides), format), template: t.key, edited: false };
  }
  const { w, h } = FORMATS[format];
  resetIds();
  const elements = t.build(w, h, { logo: overrides.logo ?? true, photo: overrides.photo ?? null });
  return normalizeDoc({
    version: 2,
    format,
    template: t.key,
    edited: false,
    corner: t.corner ?? 2,
    background: t.background ?? "$paper",
    palette: overrides.palette ?? paletteByKey(t.palette),
    fonts: overrides.fonts ?? t.fonts,
    elements,
  });
}

/** Toile vierge : le QR et le nom, le reste est à composer. */
export function blankDoc(format: FormatKey, palette?: Palette): LabelDoc {
  const { w, h } = FORMATS[format];
  const q = Math.max(22, Math.min(w, h) - 22);
  resetIds();
  return normalizeDoc({
    version: 2,
    format,
    edited: true,
    corner: 2,
    background: "$paper",
    palette: palette ?? paletteByKey("atlantique"),
    fonts: { heading: "inter", body: "inter" },
    elements: [T(3, 3, w - 6, 6, NAME, { font: "$heading", bold: true, size: 3.4, align: "center" }), QR((w - q) / 2, h - q - 3, q)],
  });
}
