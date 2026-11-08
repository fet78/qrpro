import type { Element } from "./doc";
import type { FormatKey } from "./formats";
import type { TemplateDef } from "./library";
import { T, T1, R, E, G, I, IMG, LOGO, QR, Frame, Line, NAME, TRADE, PHONE, qrFor } from "./kit";

/**
 * Bibliothèque v3 : le QR est INTÉGRÉ à la composition (taille minimale fiable, jamais l'élément dominant).
 * Illustrations métier, formes organiques, motifs, badges et photos du pro.
 *
 * Conventions : rect = 60×40, 70×50, 90×60 (s = facteur d'échelle par rapport au 60×40),
 * carré = 40×40 et 50×50 (ss = facteur par rapport au 50×50). Marges de 2,5 mm (découpe : 1,5 mm).
 */

const r2 = (v: number) => Math.round(v * 100) / 100;
/** Taille de texte : proportionnelle au format, jamais sous le minimum lisible. */
const fs = (v: number) => Math.max(1.9, r2(v));
const ALL: FormatKey[] = ["F40X40", "F50X50", "F60X40", "F70X50", "F90X60"];
const NO_XS: FormatKey[] = ["F50X50", "F60X40", "F70X50", "F90X60"];
const RECT: FormatKey[] = ["F60X40", "F70X50", "F90X60"];
const SCANME = "Scannez-moi";

function dims(w: number, h: number) {
  const sq = w === h;
  return { sq, s: Math.min(w / 60, h / 40), ss: w / 50, q: qrFor(w, h) };
}

/** Photo du pro si disponible, sinon composition graphique de remplacement (jamais un cadre vide). */
function photoOr(x: number, y: number, w: number, h: number, photo: string | null, fallback: () => Element[], radius = 0): Element[] {
  return photo ? [IMG(x, y, w, h, photo, radius)] : fallback();
}

export const TEMPLATES_V3: TemplateDef[] = [
  // ───────────────────────────────────────────── Moderne
  {
    key: "flux",
    name: "Flux",
    category: "Moderne",
    description: "Deux vagues de couleur, QR discret en haut à droite.",
    keywords: "vague eau plomberie chauffage moderne bleu",
    palette: "atlantique",
    fonts: { heading: "montserrat", body: "inter" },
    corner: 2.5,
    formats: ALL,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      const waves = [G(-1, h * 0.46, w + 2, h * 0.54 + 1, "vague2", "$secondary", { name: "Vague claire" }), G(-1, h * 0.6, w + 2, h * 0.4 + 1, "vague", "$primary", { name: "Vague" })];
      if (sq) {
        return [
          ...waves,
          T(2.5, 2.5, w - 5, 7.5 * ss, NAME, { font: "$heading", bold: true, size: fs(3.1 * ss), valign: "top" }),
          T(2.5, 2.5 + 7.7 * ss, w - 5, 3.2 * ss, TRADE, { size: fs(1.9 * ss), color: "$primary", uppercase: true, tracking: 0.05, valign: "top" }),
          T1(2.5, 2.5 + 11.2 * ss, w - 5, 5 * ss, PHONE, { font: "$heading", bold: true, size: fs(3.4 * ss), color: "$ink" }),
          QR(w - q - 2.5, h - q - 2.5, q),
          T(2.5, h - 8 * ss, w - q - 7, 5.5 * ss, SCANME, { bold: true, size: fs(2.1 * ss), color: "$paper", valign: "bottom" }),
        ];
      }
      const W = w - q - 7;
      return [
        ...waves,
        T(2.5, 2.5, W, 10.5 * s, NAME, { font: "$heading", bold: true, size: fs(3.3 * s), valign: "top" }),
        T(2.5, 2.5 + 10.8 * s, W, 3.4 * s, TRADE, { size: fs(1.9 * s), color: "$primary", uppercase: true, tracking: 0.05, valign: "top" }),
        QR(w - q - 2.5, 2.5, q),
        T1(2.5, h - 7.6 * s, W + 1, 5.6 * s, PHONE, { font: "$heading", bold: true, size: fs(3.7 * s), color: "$paper" }),
      ];
    },
  },
  {
    key: "trame",
    name: "Trame",
    category: "Moderne",
    description: "Panneau en trame de points dégradée qui accueille le QR.",
    keywords: "points dégradé moderne graphique orange",
    palette: "braise",
    fonts: { heading: "montserrat", body: "inter" },
    corner: 2,
    formats: ALL,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      if (sq) {
        const top = h * 0.52;
        return [
          R(0, top, w, h - top, "$primary", { name: "Panneau" }),
          G(0, top, w, h - top, "trame", "$paper", { opacity: 0.28, density: 1.1, name: "Trame" }),
          T(2.5, 2.5, w - 5, 7.5 * ss, NAME, { font: "$heading", bold: true, size: fs(3.1 * ss), valign: "top" }),
          T(2.5, 2.5 + 7.7 * ss, w - 5, 3.2 * ss, TRADE, { size: fs(1.9 * ss), color: "$accent", valign: "top" }),
          T1(2.5, 2.5 + 11 * ss, w - 5, 5 * ss, PHONE, { font: "$heading", bold: true, size: fs(3.4 * ss), color: "$primary" }),
          QR(w - q - 2.5, h - q - 2.5, q),
          T(2.5, top + 2, w - q - 7, h - top - 4.5, "Scannez pour nous contacter", { bold: true, size: fs(2 * ss), color: "$paper", valign: "bottom" }),
        ];
      }
      const px = w * 0.58;
      return [
        R(px, 0, w - px, h, "$primary", { name: "Panneau" }),
        G(px, 0, w - px, h, "trame", "$paper", { opacity: 0.28, density: 1.1, name: "Trame" }),
        QR(px + (w - px - q) / 2, (h - q) / 2, q),
        T(2.5, 3, px - 5, 11 * s, NAME, { font: "$heading", bold: true, size: fs(3.3 * s), valign: "top" }),
        R(2.5, 3 + 11.6 * s, 7 * s, 0.7 * s, "$primary", { name: "Trait" }),
        T(2.5, 3 + 13 * s, px - 5, 7 * s, TRADE, { size: fs(2 * s), color: "$accent", valign: "top" }),
        T1(2.5, h - 8 * s, px - 5, 5.5 * s, PHONE, { font: "$heading", bold: true, size: fs(3.5 * s), color: "$primary" }),
      ];
    },
  },

  // ───────────────────────────────────────────── Métier
  {
    key: "braise",
    name: "Braise",
    category: "Métier",
    description: "Colonne de couleur et flamme dessinée : chauffage, poêles, chaudières.",
    keywords: "chauffage chaudière flamme poêle bois gaz fioul chauffagiste orange",
    palette: "braise",
    fonts: { heading: "oswald", body: "inter" },
    corner: 2,
    formats: ALL,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      if (sq) {
        const band = h * 0.3;
        return [
          R(0, 0, w, band, "$primary", { name: "Bandeau" }),
          G(2, band * 0.14, band * 0.72, band * 0.72, "flamme", "$paper", { strokeWidth: 4.5, name: "Flamme" }),
          T(2.5 + band * 0.72 + 0.5, 1.8, w - band * 0.72 - 5, band - 3.6, NAME, { font: "$heading", bold: true, size: fs(3.2 * ss), color: "$paper", uppercase: true, lineHeight: 1.05 }),
          T1(2.5, band + 1.5, w - 5, 5.2 * ss, PHONE, { font: "$heading", bold: true, size: fs(3.6 * ss), color: "$primary" }),
          QR(w - q - 2.5, h - q - 2.5, q),
          T(2.5, band + 1.5 + 5.6 * ss, w - q - 6.5, h - band - 4 - 5.6 * ss, TRADE, { size: fs(1.95 * ss), color: "$ink", valign: "top" }),
        ];
      }
      const col = w * 0.3;
      const x0 = col + 3;
      return [
        R(0, 0, col, h, "$primary", { name: "Colonne" }),
        G(col * 0.2, h * 0.12, col * 0.6, h * 0.42, "flamme", "$paper", { strokeWidth: 4, name: "Flamme" }),
        T(1.8, h * 0.6, col - 3.6, h * 0.36, "{metier|Chauffage}", { size: fs(1.9 * s), bold: true, color: "$paper", align: "center", valign: "top" }),
        T(x0, 3, w - x0 - 2.5, 10 * s, NAME, { font: "$heading", bold: true, size: fs(3.6 * s), uppercase: true, valign: "top", lineHeight: 1.05 }),
        T1(x0, 3 + 10.4 * s, w - x0 - 2.5, 5 * s, PHONE, { font: "$heading", bold: true, size: fs(3.4 * s), color: "$primary" }),
        QR(w - q - 2.5, h - q - 2.5, q),
        T(x0, h - q - 2.5, w - x0 - q - 4.5, q, "Scannez pour nous contacter", { size: fs(2 * s), color: "$accent", valign: "bottom" }),
      ];
    },
  },
  {
    key: "eauvive",
    name: "Eau vive",
    category: "Métier",
    description: "Grande goutte qui porte le QR : plomberie, sanitaire, dépannage fuite.",
    keywords: "plomberie plombier eau goutte fuite sanitaire salle de bain bleu",
    palette: "glacier",
    fonts: { heading: "montserrat", body: "inter" },
    corner: 2.5,
    formats: ALL,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      if (sq) {
        return [
          G(w - q - 9 * ss, -6 * ss, q + 12 * ss, q + 14 * ss, "goutte_forme", "$secondary", { name: "Goutte" }),
          G(0, h - 3.2 * ss, w, 3.2 * ss, "ondes", "$secondary", { strokeWidth: 0.35, name: "Ondes" }),
          QR(w - q - 2.5, 3.5 * ss, q),
          I(2.5, 3.5 * ss, 6 * ss, "droplet", "$primary", 2),
          T(2.5, 3.5 * ss + 6.8 * ss, w - q - 7, q - 7.2 * ss, SCANME, { bold: true, size: fs(2.1 * ss), color: "$primary", valign: "top" }),
          T(2.5, q + 5 * ss, w - 5, 8 * ss, NAME, { font: "$heading", bold: true, size: fs(3 * ss), valign: "top" }),
          T1(2.5, q + 13.3 * ss, w - 5, 3 * ss, TRADE, { size: fs(1.9 * ss), color: "$accent" }),
          T1(2.5, h - 3.6 * ss - 5 * ss, w - 5, 5 * ss, PHONE, { font: "$heading", bold: true, size: fs(3.4 * ss), color: "$primary" }),
        ];
      }
      const W = w - q - 9;
      return [
        G(w - q - 11 * s, -7 * s, q + 15 * s, h + 10 * s, "goutte_forme", "$secondary", { name: "Goutte" }),
        G(0, h - 3.4 * s, w * 0.6, 3.4 * s, "ondes", "$secondary", { strokeWidth: 0.35, name: "Ondes" }),
        QR(w - q - 3.5, (h - q) / 2 + 2 * s, q),
        I(2.5, 3, 5 * s, "droplet", "$primary", 2),
        T(2.5 + 6 * s, 3, W - 6 * s, 5 * s, TRADE, { size: fs(1.9 * s), color: "$accent", uppercase: true, tracking: 0.04 }),
        T(2.5, 3 + 6.4 * s, W, 11 * s, NAME, { font: "$heading", bold: true, size: fs(3.3 * s), valign: "top" }),
        T1(2.5, h - 4 * s - 6 * s, W, 6 * s, PHONE, { font: "$heading", bold: true, size: fs(3.6 * s), color: "$primary" }),
      ];
    },
  },
  {
    key: "pac",
    name: "Air & énergie",
    category: "Métier",
    description: "Pompe à chaleur dessinée dans une vignette : PAC, climatisation, ventilation.",
    keywords: "pompe à chaleur pac climatisation clim ventilation énergie renouvelable vert",
    palette: "sauge",
    fonts: { heading: "spacegrotesk", body: "inter" },
    corner: 2.5,
    formats: ALL,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      if (sq) {
        const tw = w - q - 7;
        return [
          R(2.5, 3.5 * ss, tw, tw * 0.72, "$secondary", { radius: 2 * ss, name: "Vignette" }),
          G(3.3, 3.5 * ss + 0.8, tw - 1.6, tw * 0.72 - 1.6, "pac", "$primary", { strokeWidth: 3.6, name: "Pompe à chaleur" }),
          QR(w - q - 2.5, 3.5 * ss, q),
          T(2.5, 3.5 * ss + tw * 0.72 + 1, tw, q - tw * 0.72 - 1, SCANME, { bold: true, size: fs(2 * ss), color: "$primary", valign: "top" }),
          T(2.5, q + 5 * ss, w - 5, 8 * ss, NAME, { font: "$heading", bold: true, size: fs(3 * ss), valign: "top" }),
          T1(2.5, q + 13.3 * ss, w - 5, 3 * ss, TRADE, { size: fs(1.9 * ss), color: "$accent" }),
          T1(2.5, h - 2.5 - 5 * ss, w - 5, 5 * ss, PHONE, { font: "$heading", bold: true, size: fs(3.4 * ss), color: "$primary" }),
        ];
      }
      const W = w - q - 7;
      const tile = { w: 15 * s, h: 10.5 * s };
      return [
        R(2.5, 2.5, tile.w, tile.h, "$secondary", { radius: 2 * s, name: "Vignette" }),
        G(3.3, 3.2, tile.w - 1.6, tile.h - 1.4, "pac", "$primary", { strokeWidth: 3.6, name: "Pompe à chaleur" }),
        T(2.5 + tile.w + 2, 2.5, W - tile.w - 2, tile.h, TRADE, { size: fs(1.95 * s), color: "$accent", uppercase: true, tracking: 0.03 }),
        T(2.5, 2.5 + tile.h + 1.6 * s, W, 10.5 * s, NAME, { font: "$heading", bold: true, size: fs(3.3 * s), valign: "top" }),
        T1(2.5, h - 2.5 - 5.6 * s, W, 5.6 * s, PHONE, { font: "$heading", bold: true, size: fs(3.5 * s), color: "$primary" }),
        QR(w - q - 2.5, h - q - 2.5, q),
        T(w - q - 2.5, 2.5, q, h - q - 6, SCANME, { bold: true, size: fs(2.1 * s), color: "$primary", align: "right", valign: "bottom" }),
      ];
    },
  },
  {
    key: "entretien",
    name: "Carnet d'entretien",
    category: "Métier",
    description: "Lignes à compléter au stylo : dernier et prochain entretien.",
    keywords: "entretien chaudière annuel date contrat maintenance vignette",
    palette: "ardoise",
    fonts: { heading: "inter", body: "inter" },
    corner: 1.5,
    formats: NO_XS,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      const k = sq ? ss : s;
      const band = (sq ? 11 : 10.5) * k;
      const W = w - q - 7;
      const head = [
        R(0, 0, w, band, "$primary", { name: "Bandeau" }),
        I(2.5, (band - 5 * k) / 2, 5 * k, "wrench", "$paper", 2),
        T(2.5 + 6.4 * k, 1.6, w - 5 - 6.4 * k, band - 3.2, NAME, { font: "$heading", bold: true, size: fs(3 * k), color: "$paper" }),
      ];
      const y0 = band + 2.2 * k;
      const gap = sq ? 7.4 * k : 7 * k;
      return [
        ...head,
        T1(2.5, y0, W, 3 * k, "Dernier entretien", { size: fs(2 * k), color: "$accent", bold: true }),
        Line(2.5, y0 + 6 * k, W, "$ink", { dashed: true, strokeWidth: 0.25, name: "Ligne à compléter" }),
        T1(2.5, y0 + gap, W, 3 * k, "Prochain entretien", { size: fs(2 * k), color: "$accent", bold: true }),
        Line(2.5, y0 + gap + 6 * k, W, "$ink", { dashed: true, strokeWidth: 0.25, name: "Ligne à compléter" }),
        QR(w - q - 2.5, band + (h - band - q) / 2, q),
        T1(2.5, h - 2.5 - 5 * k, W, 5 * k, PHONE, { bold: true, size: fs(3.2 * k), color: "$primary" }),
      ];
    },
  },

  // ───────────────────────────────────────────── Photo
  {
    key: "photocarte",
    name: "Photo carte",
    category: "Photo",
    usesPhoto: true,
    description: "Votre photo (chantier, équipe, réalisation) avec le QR posé dessus.",
    keywords: "photo réalisation chantier équipe artisan image",
    palette: "ardoise",
    fonts: { heading: "inter", body: "inter" },
    corner: 2,
    formats: NO_XS,
    build: (w, h, o) => {
      const { sq, s, ss, q } = dims(w, h);
      if (sq) {
        const ph = h * 0.44;
        return [
          ...photoOr(0, 0, w, ph, o.photo, () => [R(0, 0, w, ph, "$primary", { name: "Fond" }), G(0, 0, w, ph, "points", "$paper", { opacity: 0.22 }), G(w * 0.3, ph * 0.14, w * 0.4, ph * 0.72, "maison", "$paper", { strokeWidth: 3.5, name: "Illustration" })]),
          QR(w - q - 2.5, h - q - 2.5, q),
          T(2.5, ph + 2, w - q - 7, 10 * ss, NAME, { font: "$heading", bold: true, size: fs(2.8 * ss), valign: "top" }),
          T(2.5, ph + 2 + 10.2 * ss, w - q - 7, 4 * ss, TRADE, { size: fs(1.9 * ss), color: "$accent", valign: "top" }),
          T1(2.5, h - 2.5 - 5 * ss, w - q - 7, 5 * ss, PHONE, { bold: true, size: fs(3 * ss), color: "$primary" }),
        ];
      }
      const pw = w * 0.44;
      const x0 = pw + 3;
      const W = w - x0 - 2.5;
      return [
        ...photoOr(0, 0, pw, h, o.photo, () => [R(0, 0, pw, h, "$primary", { name: "Fond" }), G(0, 0, pw, h, "points", "$paper", { opacity: 0.22 }), G(pw * 0.2, h * 0.06, pw * 0.6, h * 0.36, "maison", "$paper", { strokeWidth: 3.5, name: "Illustration" })]),
        QR((pw - q) / 2, h - q - 2.5, q, 1.6),
        T(x0, 3, W, 12 * s, NAME, { font: "$heading", bold: true, size: fs(3.3 * s), valign: "top" }),
        T(x0, 3 + 12.4 * s, W, 7 * s, TRADE, { size: fs(2 * s), color: "$accent", valign: "top" }),
        R(x0, h - 12 * s, 6 * s, 0.7 * s, "$primary", { name: "Trait" }),
        T1(x0, h - 2.5 - 6.5 * s, W, 6 * s, PHONE, { bold: true, size: fs(3.4 * s), color: "$primary" }),
      ];
    },
  },
  {
    key: "photobandeau",
    name: "Photo bandeau",
    category: "Photo",
    usesPhoto: true,
    description: "Bandeau photo en haut, coordonnées sur fond de couleur.",
    keywords: "photo bandeau image réalisation équipe",
    palette: "atlantique",
    fonts: { heading: "montserrat", body: "inter" },
    corner: 2.5,
    formats: NO_XS,
    build: (w, h, o) => {
      const { sq, s, ss, q } = dims(w, h);
      const k = sq ? ss : s;
      const ph = h * (sq ? 0.42 : 0.46);
      const W = w - q - 7;
      return [
        ...photoOr(0, 0, w, ph, o.photo, () => [R(0, 0, w, ph, "$secondary", { name: "Fond" }), G(0, 0, w, ph, "grille", "$primary", { strokeWidth: 0.12, opacity: 0.35 }), G(w * 0.3, ph * 0.12, w * 0.4, ph * 0.76, "tuyaux", "$primary", { strokeWidth: 3.5, name: "Illustration" })]),
        R(0, ph, w, h - ph, "$primary", { name: "Panneau" }),
        QR(w - q - 2.5, h - q - 2.5, q),
        T(2.5, ph + 1.8, W, (sq ? 10 : 9.4) * k, NAME, { font: "$heading", bold: true, size: fs(3 * k), color: "$paper", valign: "top" }),
        T1(2.5, h - 2.5 - 5.4 * k, W, 5.4 * k, PHONE, { font: "$heading", bold: true, size: fs(3.4 * k), color: "$paper" }),
      ];
    },
  },
  {
    key: "portrait",
    name: "Portrait",
    category: "Photo",
    usesPhoto: true,
    description: "Photo ronde de l'artisan ou de l'équipe : une signature humaine.",
    keywords: "photo ronde portrait artisan équipe visage confiance",
    palette: "cuivre",
    fonts: { heading: "playfair", body: "inter" },
    corner: 2.5,
    formats: RECT,
    build: (w, h, o) => {
      const { s, q } = dims(w, h);
      const d = 14 * s;
      const W = w - q - 7;
      return [
        E(2.5 - 0.6, 2.5 - 0.6, d + 1.2, d + 1.2, "$primary", { name: "Anneau" }),
        ...photoOr(2.5, 2.5, d, d, o.photo, () => [E(2.5, 2.5, d, d, "$secondary", { name: "Médaillon" }), I(2.5 + d * 0.25, 2.5 + d * 0.25, d * 0.5, "user", "$primary", 1.8)], d / 2),
        T(2.5 + d + 2.5, 2.5, W - d - 2.5, d, TRADE, { size: fs(1.95 * s), color: "$primary", uppercase: true, tracking: 0.04 }),
        T(2.5, 2.5 + d + 1.8 * s, W, 9.6 * s, NAME, { font: "$heading", bold: true, size: fs(3.4 * s), valign: "top" }),
        T1(2.5, h - 2.5 - 5.4 * s, W, 5.4 * s, PHONE, { bold: true, size: fs(3.3 * s), color: "$primary" }),
        QR(w - q - 2.5, (h - q) / 2, q),
      ];
    },
  },

  // ───────────────────────────────────────────── Premium
  {
    key: "sceau",
    name: "Sceau doré",
    category: "Premium",
    description: "Fond nuit, filets et sceau dorés : une finition haut de gamme.",
    keywords: "premium luxe or doré noir élégant sceau qualité",
    palette: "nuit",
    fonts: { heading: "playfair", body: "inter" },
    corner: 3,
    formats: NO_XS,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      if (sq) {
        return [
          Frame(1.6, w, h, "$primary", 0.3, 2),
          T(3.5, 3.5, w - 7, 9 * ss, NAME, { font: "$heading", bold: true, size: fs(3.1 * ss), color: "$primary", align: "center" }),
          G(w / 2 - 9 * ss, 12.8 * ss, 18 * ss, 3 * ss, "separateur", "$primary", { strokeWidth: 3, name: "Séparateur" }),
          G(4, h - q - 3.5, 11 * ss, 11 * ss, "sceau", "$primary", { name: "Sceau" }),
          I(4 + 3 * ss, h - q - 3.5 + 3 * ss, 5 * ss, "award", "$paper", 2),
          QR(w - q - 3.5, h - q - 3.5, q),
          T1(3.5, h - 3.5 - 5 * ss, w - q - 9, 5 * ss, PHONE, { bold: true, size: fs(2.5 * ss), color: "$ink" }),
        ];
      }
      const W = w - q - 9.5;
      const b = 9.5 * s;
      return [
        Frame(1.6, w, h, "$primary", 0.3, 2),
        G(3.5, 3.5, b, b, "sceau", "$primary", { name: "Sceau" }),
        I(3.5 + b * 0.26, 3.5 + b * 0.26, b * 0.48, "award", "$paper", 2),
        T(3.5 + b + 2, 3.5, W - b - 2, b, TRADE, { size: fs(1.9 * s), color: "$accent", uppercase: true, tracking: 0.08 }),
        T(3.5, 3.5 + b + 1.6 * s, W, 10 * s, NAME, { font: "$heading", bold: true, size: fs(3.4 * s), color: "$primary", valign: "top" }),
        T1(3.5, h - 3.5 - 5 * s, W, 5 * s, PHONE, { bold: true, size: fs(3.2 * s), color: "$ink" }),
        QR(w - q - 3.5, (h - q) / 2, q),
      ];
    },
  },
  {
    key: "arche",
    name: "Arche",
    category: "Élégant",
    description: "Le QR abrité sous une arche, typographie à empattements.",
    keywords: "élégant arche crème beige raffiné classique",
    palette: "creme",
    fonts: { heading: "playfair", body: "inter" },
    corner: 2.5,
    formats: ALL,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      if (sq) {
        const aw = q + 5 * ss;
        return [
          G(w - aw - 1.5, h - q - 9 * ss, aw, q + 9 * ss + 0.5, "arche", "$secondary", { name: "Arche" }),
          QR(w - aw - 1.5 + (aw - q) / 2, h - q - 2, q),
          T(2.5, 2.5, w - 5, 8 * ss, NAME, { font: "$heading", bold: true, size: fs(3.2 * ss), color: "$primary", valign: "top" }),
          T1(2.5, 2.5 + 8.4 * ss, w - 5, 3.2 * ss, TRADE, { size: fs(1.9 * ss), color: "$accent" }),
          T1(2.5, 2.5 + 11.9 * ss, w - 5, 4.6 * ss, PHONE, { bold: true, size: fs(3.2 * ss), color: "$ink" }),
          T(2.5, h - q - 2, w - aw - 4.5, q - 0.5, SCANME, { size: fs(2 * ss), color: "$accent", valign: "bottom" }),
        ];
      }
      const aw = q + 6 * s;
      const W = w - aw - 7;
      return [
        G(2, 2, aw, h - 2, "arche", "$secondary", { name: "Arche" }),
        QR(2 + (aw - q) / 2, h - q - 3, q),
        T(aw + 5, 3.5, W, 3.2 * s, TRADE, { size: fs(1.9 * s), color: "$accent", uppercase: true, tracking: 0.08 }),
        T(aw + 5, 3.5 + 4 * s, W, 12 * s, NAME, { font: "$heading", bold: true, size: fs(3.5 * s), color: "$primary", valign: "top" }),
        G(aw + 5, 3.5 + 16.6 * s, 14 * s, 2.4 * s, "separateur", "$primary", { strokeWidth: 3, name: "Séparateur" }),
        T1(aw + 5, h - 3 - 5.5 * s, W, 5.5 * s, PHONE, { bold: true, size: fs(3.3 * s), color: "$ink" }),
      ];
    },
  },

  // ───────────────────────────────────────────── Industriel
  {
    key: "plan",
    name: "Plan technique",
    category: "Industriel",
    description: "Fond bleu nuit quadrillé, dessin technique de radiateur.",
    keywords: "plan technique blueprint industriel bleu radiateur ingénierie",
    palette: "plan",
    fonts: { heading: "spacegrotesk", body: "spacegrotesk" },
    corner: 1.5,
    formats: ALL,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      const grid = G(0, 0, w, h, "grille", "$secondary", { strokeWidth: 0.14, density: 0.8, name: "Quadrillage" });
      const frame = Frame(1.8, w, h, "$primary", 0.25, 0.6);
      if (sq) {
        const tw = w - q - 7.5;
        return [
          grid,
          frame,
          QR(w - q - 3, 3, q),
          G(3, 4 * ss, tw, q - 3 * ss, "radiateur", "$primary", { strokeWidth: 3.4, name: "Radiateur" }),
          T(3, q + 4.6 * ss, w - 6, 8 * ss, NAME, { font: "$heading", bold: true, size: fs(2.9 * ss), uppercase: true, valign: "top" }),
          T1(3, q + 12.8 * ss, w - 6, 3 * ss, TRADE, { size: fs(1.9 * ss), color: "$primary" }),
          T1(3, h - 3 - 5 * ss, w - 6, 5 * ss, PHONE, { font: "$heading", bold: true, size: fs(3.2 * ss), color: "$accent" }),
        ];
      }
      const W = w - q - 9;
      return [
        grid,
        frame,
        G(3.5, 3.5, 13 * s, 9.5 * s, "radiateur", "$primary", { strokeWidth: 3.4, name: "Radiateur" }),
        T(3.5 + 14 * s, 3.5, W - 14 * s, 9.5 * s, TRADE, { size: fs(1.9 * s), color: "$primary", uppercase: true, tracking: 0.04 }),
        T(3.5, 3.5 + 11 * s, W, 10 * s, NAME, { font: "$heading", bold: true, size: fs(3.2 * s), uppercase: true, valign: "top" }),
        T1(3.5, h - 3.5 - 5.4 * s, W, 5.4 * s, PHONE, { font: "$heading", bold: true, size: fs(3.4 * s), color: "$accent" }),
        QR(w - q - 3.5, (h - q) / 2, q, 0.6),
      ];
    },
  },
  {
    key: "securite",
    name: "Sécurité",
    category: "Industriel",
    description: "Bandes de signalisation jaune et noir, lettres d'affiche.",
    keywords: "chantier sécurité jaune noir industriel rayures signalisation dépannage urgence",
    palette: "chantier",
    fonts: { heading: "bebas", body: "inter" },
    corner: 1,
    formats: ALL,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      const k = sq ? ss : s;
      const band = 4.6 * k;
      const stripes = [R(0, 0, w, band, "$primary", { name: "Bande" }), G(0, 0, w, band, "rayures", "$ink", { strokeWidth: 0.9, density: 0.75, name: "Rayures" })];
      const W = w - q - 7;
      if (sq) {
        return [
          ...stripes,
          T(2.5, band + 1.4, w - 5, 9 * k, NAME, { font: "$heading", size: fs(4.4 * k), uppercase: true, lineHeight: 1 }),
          T(2.5, band + 10.8 * k, W, h - band - 10.8 * k - 2.5 - 8.5 * k, TRADE, { bold: true, size: fs(1.9 * k), uppercase: true, valign: "top" }),
          QR(w - q - 2.5, h - q - 2.5, q, 0.4),
          R(2.5, h - 2.5 - 7.5 * k, W, 7.5 * k, "$ink", { radius: 0.8, name: "Cartouche" }),
          T1(3.2, h - 2.5 - 7.5 * k, W - 1.4, 7.5 * k, PHONE, { font: "$heading", size: fs(4.6 * k), color: "$primary", align: "center" }),
        ];
      }
      return [
        ...stripes,
        T(2.5, band + 2, W, 12 * k, NAME, { font: "$heading", size: fs(5 * k), uppercase: true, valign: "top", lineHeight: 1 }),
        T1(2.5, band + 14.4 * k, W, 3.2 * k, TRADE, { bold: true, size: fs(1.9 * k), uppercase: true }),
        QR(w - q - 2.5, h - q - 2.5, q, 0.4),
        R(2.5, h - 2.5 - 8.5 * k, W, 8.5 * k, "$ink", { radius: 0.8, name: "Cartouche" }),
        T1(3.4, h - 2.5 - 8.5 * k, W - 1.8, 8.5 * k, PHONE, { font: "$heading", size: fs(5.6 * k), color: "$primary", align: "center" }),
      ];
    },
  },

  // ───────────────────────────────────────────── Illustré
  {
    key: "galet",
    name: "Galet",
    category: "Illustré",
    description: "Forme organique douce et feuillage : une étiquette chaleureuse.",
    keywords: "organique doux naturel vert feuille écologique créatif",
    palette: "sauge",
    fonts: { heading: "spacegrotesk", body: "inter" },
    corner: 3,
    formats: ALL,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      if (sq) {
        return [
          G(-4 * ss, h * 0.42, w * 0.78, h * 0.66, "galet", "$secondary", { name: "Galet" }),
          G(w - 13 * ss, -2 * ss, 15 * ss, 15 * ss, "feuille", "$primary", { opacity: 0.18, name: "Feuille" }),
          T(2.5, 2.5, w - 5, 8 * ss, NAME, { font: "$heading", bold: true, size: fs(3.1 * ss), valign: "top" }),
          T1(2.5, 2.5 + 8.4 * ss, w - 5, 3.2 * ss, TRADE, { size: fs(1.9 * ss), color: "$primary" }),
          T1(2.5, 2.5 + 11.9 * ss, w - 5, 5 * ss, PHONE, { font: "$heading", bold: true, size: fs(3.4 * ss), color: "$primary" }),
          QR(w - q - 2.5, h - q - 2.5, q, 2),
          I(2.5 + 1 * ss, h - 2.5 - 9 * ss, 7 * ss, "leaf", "$primary", 1.8),
        ];
      }
      const W = w - q - 7;
      return [
        G(-5 * s, -5 * s, w * 0.66, h + 9 * s, "galet2", "$secondary", { name: "Galet" }),
        G(w - 15 * s, h - 13 * s, 17 * s, 15 * s, "feuille", "$primary", { opacity: 0.16, name: "Feuille" }),
        I(2.5, 3, 5 * s, "leaf", "$primary", 1.8),
        T(2.5, 3 + 6.4 * s, W, 11 * s, NAME, { font: "$heading", bold: true, size: fs(3.3 * s), valign: "top" }),
        T(2.5, 3 + 17.6 * s, W, 4 * s, TRADE, { size: fs(1.95 * s), color: "$primary", valign: "top" }),
        T1(2.5, h - 2.5 - 5.6 * s, W, 5.6 * s, PHONE, { font: "$heading", bold: true, size: fs(3.5 * s), color: "$primary" }),
        QR(w - q - 3, (h - q) / 2 - 1.5 * s, q, 2),
      ];
    },
  },
  {
    key: "maison",
    name: "Maison au chaud",
    category: "Illustré",
    description: "Illustration d'une maison chauffée en filigrane, très lisible.",
    keywords: "maison habitat chauffage confort illustration bleu",
    palette: "atlantique",
    fonts: { heading: "inter", body: "inter" },
    corner: 2,
    formats: ALL,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      if (sq) {
        return [
          R(0, 0, w, h * 0.5, "$secondary", { name: "Fond" }),
          G(2.5, 2.5, w - q - 7, h * 0.5 - 4, "maison", "$primary", { strokeWidth: 3.2, name: "Maison" }),
          QR(w - q - 2.5, 2.5, q),
          T(2.5, Math.max(q + 4.5, h * 0.5 + 2), w - 5, 8 * ss, NAME, { font: "$heading", bold: true, size: fs(3 * ss), valign: "top" }),
          T1(2.5, h - 2.5 - 5 * ss - 3.6 * ss, w - 5, 3.2 * ss, TRADE, { size: fs(1.9 * ss), color: "$accent" }),
          T1(2.5, h - 2.5 - 5 * ss, w - 5, 5 * ss, PHONE, { bold: true, size: fs(3.4 * ss), color: "$primary" }),
        ];
      }
      const W = w - q - 7;
      return [
        G(w - q - 12 * s, -3 * s, q + 15 * s, h + 3 * s, "maison", "$secondary", { strokeWidth: 3, name: "Maison" }),
        T(2.5, 3, W, 3.2 * s, TRADE, { size: fs(1.9 * s), color: "$accent", uppercase: true, tracking: 0.06 }),
        T(2.5, 3 + 4 * s, W, 11 * s, NAME, { font: "$heading", bold: true, size: fs(3.4 * s), valign: "top" }),
        I(2.5, h - 2.5 - 5 * s, 4.4 * s, "phone", "$primary", 2),
        T1(2.5 + 5.4 * s, h - 2.5 - 5.6 * s, W - 5.4 * s, 5.6 * s, PHONE, { bold: true, size: fs(3.4 * s), color: "$primary" }),
        QR(w - q - 2.5, (h - q) / 2, q),
      ];
    },
  },
  {
    key: "duo",
    name: "Duo",
    category: "Créatif",
    description: "Quarts de cercle et demi-lune aux deux couleurs de la marque.",
    keywords: "créatif géométrique couleurs formes cercle violet",
    palette: "violet",
    fonts: { heading: "spacegrotesk", body: "spacegrotesk" },
    corner: 2,
    formats: ALL,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      const k = sq ? ss : s;
      const deco = [G(0, 0, 12 * k, 12 * k, "quart", "$primary", { name: "Quart de cercle" }), G(sq ? 2.5 : w * 0.36, h - 6 * k, 12 * k, 6 * k, "demi", "$accent", { opacity: 0.85, name: "Demi-lune" })];
      if (sq) {
        return [
          ...deco,
          QR(w - q - 2.5, 2.5, q),
          T(2.5, 13.5 * k, w - q - 7, q + 2.5 - 13.5 * k, SCANME, { bold: true, size: fs(2 * k), color: "$primary", valign: "bottom" }),
          T(2.5, q + 4.5, w - 5, 8 * k, NAME, { font: "$heading", bold: true, size: fs(3 * k), valign: "top" }),
          T1(2.5, h - 6.5 * k - 5 * k, w - 5, 5 * k, PHONE, { font: "$heading", bold: true, size: fs(3.4 * k), color: "$primary" }),
        ];
      }
      const x0 = 12 * k + 2;
      const W = w - q - 4.5 - x0;
      return [
        ...deco,
        T1(x0, 3, W, 3.2 * k, TRADE, { size: fs(1.9 * k), color: "$accent" }),
        T(x0, 3 + 4 * k, W, 12 * k, NAME, { font: "$heading", bold: true, size: fs(3.3 * k), valign: "top" }),
        T1(2.5, h - 6.5 * k - 5.6 * k, w - q - 7, 5.6 * k, PHONE, { font: "$heading", bold: true, size: fs(3.6 * k), color: "$primary" }),
        QR(w - q - 2.5, (h - q) / 2, q),
      ];
    },
  },

  // ───────────────────────────────────────────── Minimaliste
  {
    key: "ligneclaire",
    name: "Ligne claire",
    category: "Minimaliste",
    description: "Beaucoup de blanc, un filet de couleur, le numéro en grand.",
    keywords: "minimaliste simple blanc sobre épuré typographie",
    palette: "ardoise",
    fonts: { heading: "inter", body: "inter" },
    corner: 1.5,
    formats: ALL,
    build: (w, h) => {
      const { sq, s, ss, q } = dims(w, h);
      if (sq) {
        return [
          T1(2.5, 2.5, w - 5, 3 * ss, TRADE, { size: fs(1.9 * ss), color: "$accent", uppercase: true, tracking: 0.12 }),
          T(2.5, 2.5 + 3.6 * ss, w - 5, 7.5 * ss, NAME, { font: "$heading", bold: true, size: fs(3 * ss), valign: "top" }),
          T1(2.5, 2.5 + 11.4 * ss, w - 5, 5.6 * ss, PHONE, { font: "$heading", bold: true, size: fs(4 * ss) }),
          R(2.5, h - 2.5 - q / 2, 7 * ss, 0.7, "$primary", { name: "Filet" }),
          T(2.5, h - 2.5 - q / 2 + 1.8, w - q - 7, q / 2 - 1.8, SCANME, { size: fs(2 * ss), color: "$accent", valign: "top" }),
          QR(w - q - 2.5, h - q - 2.5, q, 0.8),
        ];
      }
      const W = w - q - 7;
      return [
        T1(2.5, 3, w - 5, 3 * s, TRADE, { size: fs(1.9 * s), color: "$accent", uppercase: true, tracking: 0.14 }),
        T(2.5, 3 + 3.8 * s, w - q - 7, 10 * s, NAME, { font: "$heading", bold: true, size: fs(3.3 * s), valign: "top" }),
        R(2.5, h - 2.5 - 10.4 * s, 8 * s, 0.7 * s, "$primary", { name: "Filet" }),
        T1(2.5, h - 2.5 - 8 * s, W, 8 * s, PHONE, { font: "$heading", bold: true, size: fs(4.6 * s), valign: "bottom" }),
        QR(w - q - 2.5, h - q - 2.5, q, 0.8),
      ];
    },
  },

  // ───────────────────────────────────────────── Professionnel
  {
    key: "cartevisite",
    name: "Carte de visite",
    category: "Professionnel",
    description: "Logo, nom, téléphone et email avec pictogrammes, comme une carte de visite.",
    keywords: "carte de visite logo email contact professionnel sobre",
    palette: "atlantique",
    fonts: { heading: "inter", body: "inter" },
    corner: 2,
    formats: ALL,
    build: (w, h, o) => {
      const { sq, s, ss, q } = dims(w, h);
      const k = sq ? ss : s;
      const lg = 9 * k;
      const W = sq ? w - 5 : w - q - 7;
      const nx = o.logo ? 2.5 + lg + 1.8 : 2.5;
      const head: Element[] = [
        LOGO(2.5, 2.5, lg, lg),
        T(nx, 2.5, W - (nx - 2.5), lg, NAME, { font: "$heading", bold: true, size: fs(3.1 * k) }),
        T1(2.5, 2.5 + lg + 1, W, 3.2 * k, TRADE, { size: fs(1.9 * k), color: "$accent" }),
        R(0, 0, 1.2 * k, h, "$primary", { name: "Liseré" }),
      ];
      if (sq) {
        return [
          ...head,
          I(2.5, 2.5 + lg + 5.2 * k, 3.6 * k, "phone", "$primary", 2),
          T1(2.5 + 4.6 * k, 2.5 + lg + 4.6 * k, W - 4.6 * k, 4.8 * k, PHONE, { bold: true, size: fs(3 * k), color: "$primary" }),
          QR(w - q - 2.5, h - q - 2.5, q),
          T(2.5, h - q - 2.5 + 2, w - q - 7, q - 2, "Scannez pour tout savoir", { size: fs(2 * k), color: "$ink", valign: "bottom" }),
        ];
      }
      return [
        ...head,
        Line(2.5, 2.5 + lg + 5.2 * k, W, "$secondary", { strokeWidth: 0.3 }),
        I(2.5, h - 2.5 - 10.6 * k, 3.6 * k, "phone", "$primary", 2),
        T1(2.5 + 4.8 * k, h - 2.5 - 11.2 * k, W - 4.8 * k, 4.8 * k, PHONE, { bold: true, size: fs(3.1 * k), color: "$primary" }),
        I(2.5, h - 2.5 - 4 * k, 3.4 * k, "mail", "$accent", 2),
        T1(2.5 + 4.8 * k, h - 2.5 - 4.6 * k, W - 4.8 * k, 4.6 * k, "{email}", { size: fs(2.1 * k) }),
        QR(w - q - 2.5, (h - q) / 2, q),
      ];
    },
  },
];
