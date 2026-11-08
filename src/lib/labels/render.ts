import { FORMATS } from "./formats";
import {
  type LabelDoc, type LabelData, type Element, type TextEl, type FontKey, type Palette, type QrEl,
  resolveColor, resolveText, MIN_QR_MM, MIN_TEXT_MM, SAFE_MM, normalizeDoc, clamp,
} from "./doc";
import { measure, metrics, textPath } from "./fonts";
import { ICONS } from "./icons";
import { GRAPHICS, scalePath } from "./graphics";
import { qrMatrix, moduleSize, MIN_MODULE_MM, type QrMatrix } from "./qr";
import { contrastRatio } from "./palette";
import { decodeMatrix } from "./verify";

/**
 * Rendu d'un document en primitives vectorielles (mm). Deux moteurs les dessinent :
 * svg.ts (aperçu, export SVG/PNG) et pdf.ts (planche A4). Le texte est déjà en contours.
 */
/** Découpe facultative (rectangle à coins arrondis, en mm) : motifs, photos recadrées. */
export interface Clip {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

export type Prim =
  | { t: "path"; d: string; fill?: string; stroke?: string; sw?: number; opacity?: number; dash?: boolean; cap?: "round"; tf?: { x: number; y: number; s: number }; clip?: Clip }
  /** `key` : "logo" ou identifiant d'une photo du pro. */
  | { t: "image"; key: string; x: number; y: number; w: number; h: number; opacity?: number; clip?: Clip }
  | { t: "qr"; x: number; y: number; size: number; matrix: QrMatrix; radius: number };

export interface Issue {
  level: "error" | "warning";
  code: "qr-small" | "qr-decode" | "outside" | "text-small" | "contrast" | "overflow" | "under-qr" | "no-logo" | "overlap";
  message: string;
  elementId?: string;
  fixable: boolean;
}

export interface RenderedLabel {
  w: number;
  h: number;
  corner: number;
  background: string;
  prims: Prim[];
  qr: { x: number; y: number; size: number; moduleMm: number };
  issues: Issue[];
}

const n = (v: number) => Math.round(v * 1000) / 1000;

export function roundedRectPath(x: number, y: number, w: number, h: number, r = 0): string {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!r) return `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`;
  return `M${n(x + r)} ${n(y)}h${n(w - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(r)}v${n(h - 2 * r)}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(r)}h${n(-(w - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(-r)}v${n(-(h - 2 * r))}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(-r)}z`;
}

function ellipsePath(x: number, y: number, w: number, h: number): string {
  const rx = w / 2;
  const ry = h / 2;
  return `M${n(x)} ${n(y + ry)}a${n(rx)} ${n(ry)} 0 1 0 ${n(w)} 0a${n(rx)} ${n(ry)} 0 1 0 ${n(-w)} 0z`;
}

export function fontOf(ref: TextEl["font"], doc: LabelDoc): FontKey {
  return ref === "$heading" ? doc.fonts.heading : ref === "$body" ? doc.fonts.body : ref;
}

// ------------------------------------------------------------------ Texte

export interface TextLayout {
  lines: { text: string; width: number }[];
  size: number;
  lineH: number;
  overflow: boolean;
  family: FontKey;
  /** Hauteur réellement occupée (mm). */
  height: number;
}

function wrap(text: string, family: FontKey, bold: boolean, size: number, maxW: number, tracking: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const cand = line ? `${line} ${word}` : word;
      if (!line || measure(cand, family, bold, size, tracking) <= maxW) line = cand;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * Mise en page d'un bloc de texte : retour à la ligne dans la largeur de la boîte, puis réduction
 * automatique de la taille (jusqu'à 55 %) si le texte ne tient pas en hauteur, et « … » en dernier recours.
 */
export function layoutText(el: TextEl, doc: LabelDoc, data: LabelData): TextLayout {
  const family = fontOf(el.font, doc);
  const tracking = el.tracking ?? 0;
  let text = resolveText(el.text, data).replace(/[ \t]+/g, " ").trim();
  if (el.uppercase) text = text.toLocaleUpperCase("fr-FR");
  const lhRatio = el.lineHeight ?? 1.18;
  // La réduction automatique ne descend pas sous 5 pt : au-delà, le texte est tronqué et signalé.
  const minSize = Math.max(Math.min(el.size, MIN_TEXT_MM), el.size * 0.55);
  if (!text) return { lines: [], size: el.size, lineH: el.size * lhRatio, overflow: false, family, height: 0 };
  for (let size = el.size; size >= minSize - 1e-9; size -= Math.max(0.04, el.size * 0.02)) {
    const lineH = size * lhRatio;
    const maxLines = Math.min(el.maxLines ?? 99, Math.max(1, Math.floor((el.h + size * 0.25) / lineH)));
    const lines = maxLines === 1 ? [text.split("\n").join(" ")] : wrap(text, family, el.bold, size, el.w, tracking);
    const widths = lines.map((l) => measure(l, family, el.bold, size, tracking));
    if (lines.length <= maxLines && widths.every((wd) => wd <= el.w + 0.01)) {
      return { lines: lines.map((l, i) => ({ text: l, width: widths[i]! })), size, lineH, overflow: false, family, height: lines.length * lineH };
    }
  }
  const size = minSize;
  const lineH = size * lhRatio;
  const maxLines = Math.min(el.maxLines ?? 99, Math.max(1, Math.floor((el.h + size * 0.25) / lineH)));
  let lines = wrap(text, family, el.bold, size, el.w, tracking).slice(0, maxLines);
  lines = lines.map((l) => {
    if (measure(l, family, el.bold, size, tracking) <= el.w) return l;
    let t = l;
    while (t.length > 1 && measure(`${t}…`, family, el.bold, size, tracking) > el.w) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  });
  const last = lines.length - 1;
  if (!lines[last]!.endsWith("…")) lines[last] = `${lines[last]!.replace(/\s*\S{0,2}$/, "")}…`;
  return { lines: lines.map((l) => ({ text: l, width: measure(l, family, el.bold, size, tracking) })), size, lineH, overflow: true, family, height: lines.length * lineH };
}

// ------------------------------------------------------------------ Rendu

function bboxOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function containsPoint(e: Extract<Element, { type: "shape" }>, px: number, py: number): boolean {
  if (px < e.x || px > e.x + e.w || py < e.y || py > e.y + e.h) return false;
  if (e.shape === "ellipse") {
    const dx = (px - (e.x + e.w / 2)) / (e.w / 2);
    const dy = (py - (e.y + e.h / 2)) / (e.h / 2);
    return dx * dx + dy * dy <= 1;
  }
  if (e.shape === "polygon" && e.points?.length) {
    const u = (px - e.x) / e.w;
    const v = (py - e.y) / e.h;
    let inside = false;
    for (let i = 0, j = e.points.length - 1; i < e.points.length; j = i++) {
      const [xi, yi] = e.points[i]!;
      const [xj, yj] = e.points[j]!;
      if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  return true;
}

/** Couleur de fond sous un point : forme pleine la plus haute sous le point, sinon fond de l'étiquette. */
/** Couleur de fond sous un point ; null si c'est une photo ou une forme libre (contraste non mesurable). */
function backgroundAt(doc: LabelDoc, uptoIndex: number, px: number, py: number): string | null {
  for (let i = uptoIndex - 1; i >= 0; i--) {
    const e = doc.elements[i]!;
    if (e.hidden) continue;
    if ((e.type === "image" || (e.type === "graphic" && GRAPHICS[e.graphic]?.mode === "fill" && GRAPHICS[e.graphic]?.kind === "art")) && px >= e.x && px <= e.x + e.w && py >= e.y && py <= e.y + e.h) return null;
    if (e.type !== "shape" || e.shape === "line") continue;
    const fill = resolveColor(e.fill, doc.palette);
    if (!fill || (e.opacity ?? 1) < 0.6) continue;
    if (containsPoint(e, px, py)) return fill;
  }
  return resolveColor(doc.background, doc.palette) ?? "#FFFFFF";
}

export function renderDoc(input: LabelDoc, data: LabelData): RenderedLabel {
  const doc = normalizeDoc(input);
  const { w, h } = FORMATS[doc.format];
  const P: Palette = doc.palette;
  const prims: Prim[] = [];
  const issues: Issue[] = [];
  const qrEl = doc.elements.find((e): e is QrEl => e.type === "qr")!;
  /** Emprise réelle des textes, icônes et logos (pour détecter les chevauchements). */
  const ink: { id: string; x: number; y: number; w: number; h: number }[] = [];

  doc.elements.forEach((e, index) => {
    if (e.hidden || (e.withLogo && !data.logo)) return;
    const opacity = e.opacity ?? 1;
    const isQr = e.type === "qr";
    const decorative = e.type === "shape" || e.type === "graphic" || e.type === "image";
    if (!isQr && !decorative) {
      const inside = e.x >= SAFE_MM - 0.01 && e.y >= SAFE_MM - 0.01 && e.x + e.w <= w - SAFE_MM + 0.01 && e.y + e.h <= h - SAFE_MM + 0.01;
      if (!inside) issues.push({ level: "warning", code: "outside", message: "Un élément dépasse la marge de découpe (1,5 mm) : il risque d'être coupé.", elementId: e.id, fixable: true });
    }
    if (!isQr && bboxOverlap(e, qrEl) && !decorative) {
      issues.push({ level: "warning", code: "under-qr", message: "Un élément est en partie caché par le QR code (toujours au premier plan).", elementId: e.id, fixable: true });
    }
    switch (e.type) {
      case "shape": {
        const fill = resolveColor(e.fill, P) ?? undefined;
        const stroke = resolveColor(e.stroke, P) ?? undefined;
        const sw = e.strokeWidth ?? 0;
        if (e.shape === "line") {
          const horizontal = e.w >= e.h;
          const d = horizontal ? `M${n(e.x)} ${n(e.y + e.h / 2)}H${n(e.x + e.w)}` : `M${n(e.x + e.w / 2)} ${n(e.y)}V${n(e.y + e.h)}`;
          const col = stroke ?? fill;
          if (col) prims.push({ t: "path", d, stroke: col, sw: sw || 0.3, opacity, dash: e.dashed, cap: e.dashed ? undefined : "round" });
          break;
        }
        let d = "";
        if (e.shape === "rect") d = roundedRectPath(e.x, e.y, e.w, e.h, e.radius ?? 0);
        else if (e.shape === "ellipse") d = ellipsePath(e.x, e.y, e.w, e.h);
        else if (e.shape === "polygon" && e.points?.length) d = e.points.map(([px, py], i) => `${i ? "L" : "M"}${n(e.x + px * e.w)} ${n(e.y + py * e.h)}`).join("") + "Z";
        if (d && (fill || (stroke && sw > 0))) prims.push({ t: "path", d, fill, stroke: sw > 0 ? stroke : undefined, sw, opacity, dash: e.dashed });
        break;
      }
      case "icon": {
        const icon = ICONS[e.icon];
        const col = resolveColor(e.color, P);
        if (!icon || !col) break;
        const s = Math.min(e.w, e.h) / 24;
        prims.push({ t: "path", d: icon.d, stroke: col, sw: e.strokeWidth ?? 2, opacity, cap: "round", tf: { x: e.x + (e.w - 24 * s) / 2, y: e.y + (e.h - 24 * s) / 2, s } });
        ink.push({ id: e.id, x: e.x + (e.w - 24 * s) / 2 + 2 * s, y: e.y + (e.h - 24 * s) / 2 + 2 * s, w: 20 * s, h: 20 * s });
        break;
      }
      case "logo": {
        if (!data.logo) {
          issues.push({ level: "warning", code: "no-logo", message: "Emplacement de logo vide : ajoutez votre logo dans « Ma page » ou supprimez l'élément.", elementId: e.id, fixable: false });
          break;
        }
        const s = Math.min(e.w / data.logo.w, e.h / data.logo.h);
        const iw = data.logo.w * s;
        const ih = data.logo.h * s;
        prims.push({ t: "image", key: "logo", x: e.x + (e.w - iw) / 2, y: e.y + (e.h - ih) / 2, w: iw, h: ih, opacity });
        ink.push({ id: e.id, x: e.x + (e.w - iw) / 2, y: e.y + (e.h - ih) / 2, w: iw, h: ih });
        break;
      }
      case "text": {
        const col = resolveColor(e.color, P);
        if (!col) break;
        const lay = layoutText(e, doc, data);
        if (!lay.lines.length) break;
        if (lay.overflow) issues.push({ level: "warning", code: "overflow", message: "Un texte ne tient pas dans sa zone et a été raccourci.", elementId: e.id, fixable: true });
        if (lay.size < MIN_TEXT_MM - 0.01) issues.push({ level: "warning", code: "text-small", message: "Un texte est très petit (moins de 5 pt) : difficile à lire une fois imprimé.", elementId: e.id, fixable: true });
        const m = metrics(lay.family, e.bold, lay.size);
        const valign = e.valign ?? "middle";
        const top = valign === "top" ? e.y : valign === "bottom" ? e.y + e.h - lay.height : e.y + (e.h - lay.height) / 2;
        const parts: string[] = [];
        lay.lines.forEach((line, i) => {
          const baseline = top + i * lay.lineH + lay.lineH / 2 + m.cap / 2;
          const x = e.align === "center" ? e.x + (e.w - line.width) / 2 : e.align === "right" ? e.x + e.w - line.width : e.x;
          parts.push(textPath(line.text, lay.family, e.bold, lay.size, x, baseline, e.tracking ?? 0));
        });
        prims.push({ t: "path", d: parts.join(""), fill: col, opacity });
        const maxW = Math.max(...lay.lines.map((l) => l.width));
        const ix = e.align === "center" ? e.x + (e.w - maxW) / 2 : e.align === "right" ? e.x + e.w - maxW : e.x;
        ink.push({ id: e.id, x: ix, y: top + lay.lineH * 0.12, w: maxW, h: lay.height - lay.lineH * 0.24 });
        const bg = backgroundAt(doc, index, e.x + e.w / 2, top + lay.height / 2);
        if (bg && opacity > 0.5 && contrastRatio(col, bg) < 3) {
          issues.push({ level: "warning", code: "contrast", message: "Un texte manque de contraste avec son fond.", elementId: e.id, fixable: true });
        }
        break;
      }
      case "graphic": {
        const g = GRAPHICS[e.graphic];
        const col = resolveColor(e.color, P);
        if (!g || !col) break;
        if (g.kind === "pattern" && g.gen) {
          const d = g.gen(e.w, e.h, e.density ?? 1);
          const clip = { x: e.x, y: e.y, w: e.w, h: e.h, r: 0 };
          if (g.mode === "stroke") prims.push({ t: "path", d, stroke: col, sw: e.strokeWidth ?? 0.25, opacity, tf: { x: e.x, y: e.y, s: 1 }, clip });
          else prims.push({ t: "path", d, fill: col, opacity, tf: { x: e.x, y: e.y, s: 1 }, clip });
          break;
        }
        if (!g.d) break;
        if (g.stretch && g.mode === "fill") {
          prims.push({ t: "path", d: scalePath(g.d, e.w / 100, e.h / 100), fill: col, opacity, tf: { x: e.x, y: e.y, s: 1 } });
          break;
        }
        const sx = Math.min(e.w / 100, e.h / 100);
        const tf = { x: e.x + (e.w - 100 * sx) / 2, y: e.y + (e.h - 100 * sx) / 2, s: sx };
        if (g.mode === "stroke") prims.push({ t: "path", d: g.d, stroke: col, sw: e.strokeWidth ?? 3, opacity, cap: "round", tf });
        else prims.push({ t: "path", d: g.d, fill: col, opacity, tf });
        break;
      }
      case "image": {
        const img = data.images?.[e.src];
        if (!img) {
          issues.push({ level: "warning", code: "no-logo", message: "Une image de ce design n'est plus disponible : remplacez-la ou supprimez-la.", elementId: e.id, fixable: false });
          break;
        }
        // Recadrage « remplir » : l'image couvre tout le cadre, l'excédent est découpé.
        const sc = Math.max(e.w / img.w, e.h / img.h);
        const iw = img.w * sc;
        const ih = img.h * sc;
        prims.push({ t: "image", key: e.src, x: e.x + (e.w - iw) / 2, y: e.y + (e.h - ih) / 2, w: iw, h: ih, opacity, clip: { x: e.x, y: e.y, w: e.w, h: e.h, r: e.radius ?? 0 } });
        break;
      }
      case "qr":
        break;
    }
  });

  for (let i = 0; i < ink.length; i++)
    for (let j = i + 1; j < ink.length; j++)
      if (bboxOverlap(ink[i]!, ink[j]!)) issues.push({ level: "warning", code: "overlap", message: "Deux éléments se chevauchent.", elementId: ink[j]!.id, fixable: true });

  // QR : toujours dessiné en dernier, noir sur blanc, zone de sécurité comprise.
  const matrix = qrMatrix(data.url);
  const moduleMm = moduleSize(matrix, qrEl.w);
  prims.push({ t: "qr", x: qrEl.x, y: qrEl.y, size: qrEl.w, matrix, radius: qrEl.radius ?? 1.2 });
  if (qrEl.w < MIN_QR_MM || moduleMm < MIN_MODULE_MM) issues.push({ level: "error", code: "qr-small", message: `QR code trop petit : ${MIN_QR_MM} mm minimum pour une lecture fiable.`, elementId: qrEl.id, fixable: true });
  if (decodeMatrix(matrix) !== data.url) issues.push({ level: "error", code: "qr-decode", message: "Le QR code ne se relit pas correctement.", elementId: qrEl.id, fixable: false });

  return {
    w,
    h,
    corner: doc.corner,
    background: resolveColor(doc.background, P) ?? "#FFFFFF",
    prims,
    qr: { x: qrEl.x, y: qrEl.y, size: qrEl.w, moduleMm },
    issues: dedupe(issues),
  };
}

function dedupe(list: Issue[]): Issue[] {
  const seen = new Set<string>();
  return list.filter((i) => {
    const k = `${i.code}:${i.elementId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ------------------------------------------------------------------ Corrections automatiques

/** Emplacement libre le plus proche (pas sur le QR ni sur un autre texte, icône ou logo), dans la marge de découpe. */
function freeSpot(doc: LabelDoc, el: Element, data: LabelData): { x: number; y: number } | null {
  const { w, h } = FORMATS[doc.format];
  const others = renderInkBoxes(doc, data).filter((b) => b.id !== el.id);
  const qr = doc.elements.find((e) => e.type === "qr")!;
  const blocks = [...others, { id: "qr", x: qr.x, y: qr.y, w: qr.w, h: qr.h }];
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = SAFE_MM; y + el.h <= h - SAFE_MM + 1e-6; y += 0.5)
    for (let x = SAFE_MM; x + el.w <= w - SAFE_MM + 1e-6; x += 0.5) {
      const box = { x, y, w: el.w, h: el.h };
      if (blocks.some((b) => bboxOverlap(box, b))) continue;
      const d = Math.hypot(x - el.x, y - el.y);
      if (!best || d < best.d) best = { x, y, d };
    }
  return best ? { x: best.x, y: best.y } : null;
}

function renderInkBoxes(doc: LabelDoc, data: LabelData) {
  const out: { id: string; x: number; y: number; w: number; h: number }[] = [];
  for (const e of doc.elements) {
    if (e.hidden || e.type === "shape" || e.type === "qr" || e.type === "graphic" || e.type === "image" || (e.withLogo && !data.logo)) continue;
    if (e.type === "logo" && !data.logo) continue;
    out.push({ id: e.id, x: e.x, y: e.y, w: e.w, h: e.h });
  }
  return out;
}

/** Corrige un problème détecté (assistant « Tout corriger »). Renvoie un nouveau document. */
export function fixIssue(doc: LabelDoc, issue: Issue, data: LabelData): LabelDoc {
  const { w, h } = FORMATS[doc.format];
  const map = (fn: (e: Element) => Element) => normalizeDoc({ ...doc, edited: true, elements: doc.elements.map((e) => (e.id === issue.elementId ? fn(e) : e)) });
  switch (issue.code) {
    case "qr-small":
      return normalizeDoc({ ...doc, elements: doc.elements.map((e) => (e.type === "qr" ? { ...e, w: Math.max(MIN_QR_MM + 2, e.w), h: Math.max(MIN_QR_MM + 2, e.h) } : e)) });
    case "outside":
      return map((e) => {
        const ew = Math.min(e.w, w - 2 * SAFE_MM);
        const eh = Math.min(e.h, h - 2 * SAFE_MM);
        return { ...e, w: ew, h: eh, x: clamp(e.x, SAFE_MM, w - SAFE_MM - ew), y: clamp(e.y, SAFE_MM, h - SAFE_MM - eh) };
      });
    case "text-small":
      return map((e) => (e.type === "text" ? { ...e, size: MIN_TEXT_MM, h: Math.max(e.h, MIN_TEXT_MM * 1.3) } : e));
    case "overflow":
      return map((e) => {
        if (e.type !== "text") return e;
        const room = h - SAFE_MM - e.y;
        const lay = layoutText({ ...e, h: room }, doc, data);
        return { ...e, h: Math.min(room, Math.max(e.h, lay.height + 0.2)) };
      });
    case "contrast":
      return map((e) => {
        if (e.type !== "text") return e;
        const index = doc.elements.findIndex((x) => x.id === e.id);
        const bg = backgroundAt(doc, index, e.x + e.w / 2, e.y + e.h / 2) ?? "#FFFFFF";
        const candidates = ["$ink", "$paper", "#111111", "#FFFFFF"];
        const best = candidates.sort((a, b) => contrastRatio(resolveColor(b, doc.palette)!, bg) - contrastRatio(resolveColor(a, doc.palette)!, bg))[0]!;
        return { ...e, color: best };
      });
    case "under-qr":
    case "overlap":
      return map((e) => {
        const spot = freeSpot(doc, e, data);
        return spot ? { ...e, ...spot } : e;
      });
    default:
      return doc;
  }
}

export function fixAll(doc: LabelDoc, data: LabelData): LabelDoc {
  let current = doc;
  for (let pass = 0; pass < 3; pass++) {
    const issues = renderDoc(current, data).issues.filter((i) => i.fixable);
    if (!issues.length) break;
    for (const issue of issues) current = fixIssue(current, issue, data);
  }
  return current;
}

export function blockingIssues(label: RenderedLabel): Issue[] {
  return label.issues.filter((i) => i.level === "error");
}
