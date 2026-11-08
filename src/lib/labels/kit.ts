import type { Element, TextEl, ShapeEl, GraphicEl, ImageEl } from "./doc";

/** Briques de construction des modèles (coordonnées en mm, couleurs en rôles de palette). */

let k = 0;
export const resetIds = () => {
  k = 0;
};
const id = (p: string) => `${p}${++k}`;
export type TOpt = Partial<Omit<TextEl, "type" | "id" | "x" | "y" | "w" | "h" | "text">>;
export const T = (x: number, y: number, w: number, h: number, text: string, o: TOpt = {}): TextEl => ({
  id: id("t"), type: "text", x, y, w, h, text, font: "$body", bold: false, size: 2.4, color: "$ink", align: "left", valign: "middle",
  // Un numéro de téléphone ne se coupe jamais : il se réduit pour tenir sur une ligne.
  ...(text === "{telephone}" ? { maxLines: 1, name: "Téléphone" } : text === "{nom}" ? { name: "Nom" } : {}),
  ...o,
});
export type SOpt = Partial<Omit<ShapeEl, "type" | "id" | "x" | "y" | "w" | "h" | "shape">>;
export const R = (x: number, y: number, w: number, h: number, fill: string, o: SOpt = {}): ShapeEl => ({ id: id("s"), type: "shape", shape: "rect", x, y, w, h, fill, ...o });
export const E = (x: number, y: number, w: number, h: number, fill: string, o: SOpt = {}): ShapeEl => ({ id: id("s"), type: "shape", shape: "ellipse", x, y, w, h, fill, ...o });
export const Poly = (x: number, y: number, w: number, h: number, points: [number, number][], fill: string, o: SOpt = {}): ShapeEl => ({ id: id("s"), type: "shape", shape: "polygon", x, y, w, h, points, fill, ...o });
export const Line = (x: number, y: number, w: number, color: string, o: SOpt = {}): ShapeEl => ({ id: id("s"), type: "shape", shape: "line", x, y: y - 0.5, w, h: 1, fill: "none", stroke: color, strokeWidth: 0.3, ...o });
export const Frame = (inset: number, w: number, h: number, color: string, sw: number, radius = 0): ShapeEl => R(inset, inset, w - 2 * inset, h - 2 * inset, "none", { stroke: color, strokeWidth: sw, radius, name: "Cadre" });
export const I = (x: number, y: number, s: number, icon: string, color: string, strokeWidth = 2): Element => ({ id: id("i"), type: "icon", x, y, w: s, h: s, icon, color, strokeWidth });
/** Emplacement de logo des modèles : invisible (sans avertissement) si le pro n'a pas de logo. */
export const LOGO = (x: number, y: number, w: number, h: number): Element => ({ id: id("l"), type: "logo", x, y, w, h, name: "Logo", withLogo: true });
export const QR = (x: number, y: number, size: number, radius = 1.2): Element => ({ id: "qr", type: "qr", x, y, w: size, h: size, radius });

export const NAME = "{nom}";
export const TRADE = "{metier|Entretien · Dépannage}";
export const PHONE = "{telephone}";
export const SCAN = "Scannez pour nous contacter";

/** Taille de QR conseillée selon le format (zone blanche comprise). */
export function qrSize(w: number, h: number, ratio = 0.56): number {
  return w === h ? Math.round(w * ratio * 10) / 10 : Math.min(h - 4, w * 0.54);
}


type GOpt = Partial<Omit<GraphicEl, "type" | "id" | "x" | "y" | "w" | "h" | "graphic" | "color">>;
/** Graphisme de la bibliothèque (illustration, forme organique, badge, ornement ou motif). */
export const G = (x: number, y: number, w: number, h: number, graphic: string, color: string, o: GOpt = {}): GraphicEl => ({ id: id("g"), type: "graphic", x, y, w, h, graphic, color, ...o });
/** Photo du pro, recadrée pour remplir le cadre. */
export const IMG = (x: number, y: number, w: number, h: number, src: string, radius = 0): ImageEl => ({ id: id("p"), type: "image", x, y, w, h, src, radius, name: "Photo" });
/** Texte d'une ligne (adresse, site…) : réduit plutôt que coupé. */
export const T1 = (x: number, y: number, w: number, h: number, text: string, o: TOpt = {}): TextEl => T(x, y, w, h, text, { maxLines: 1, ...o });

/** QR intégré (non dominant) : juste assez grand pour une lecture fiable, quelle que soit l'URL. */
export function qrFor(w: number, h: number): number {
  const v = w === h ? Math.max(18, w * 0.46) : Math.max(18, Math.min(h * 0.47, w * 0.31));
  return Math.round(v * 2) / 2;
}
