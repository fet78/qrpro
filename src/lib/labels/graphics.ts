/**
 * Bibliothèque graphique de l'éditeur (créations originales, dessinées pour ce produit).
 *  - « art » : illustration ou forme dans une boîte de 100 × 100, mise à l'échelle sans déformation ;
 *    `mode` stroke = dessin au trait (épaisseur réglable), fill = aplat.
 *  - « pattern » : motif calculé directement en millimètres pour la taille de l'élément
 *    (points, rayures, ondes…), donc net à toutes les tailles et sans déformation.
 */

export type GraphicKind = "art" | "pattern";
export interface GraphicDef {
  label: string;
  group: "Illustrations métier" | "Formes" | "Badges" | "Ornements" | "Motifs";
  kind: GraphicKind;
  mode: "fill" | "stroke";
  /** Tracé dans la boîte 100 × 100 (art). */
  d?: string;
  /** Générateur (pattern) : tracé en mm pour une boîte w × h. */
  gen?: (w: number, h: number, density: number) => string;
  /** Rapport largeur / hauteur conseillé à l'insertion. */
  ratio?: number;
  /** Aplat étiré pour remplir sa boîte (vague, arche…) au lieu de garder ses proportions. */
  stretch?: boolean;
}

/**
 * Mise à l'échelle non uniforme d'un tracé SVG (commandes absolues et relatives, arcs sans rotation compris) :
 * sert aux aplats « étirables ». Le PDF n'accepte qu'une échelle uniforme, on transforme donc les coordonnées.
 */
export function scalePath(d: string, sx: number, sy: number): string {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const out: string[] = [];
  let cmd = "";
  let i = 0;
  const num = () => parseFloat(tokens[i++]!);
  const r = (v: number) => String(Math.round(v * 1000) / 1000);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i]!)) {
      cmd = tokens[i++]!;
      out.push(cmd);
      if (cmd === "z" || cmd === "Z") continue;
    }
    const c = cmd.toUpperCase();
    if (c === "H") out.push(r(num() * sx));
    else if (c === "V") out.push(r(num() * sy));
    else if (c === "A") {
      const rx = num(), ry = num(), rot = num(), large = num(), sweep = num(), x = num(), y = num();
      out.push(r(rx * sx), r(ry * sy), r(rot), String(large), String(sweep), r(x * sx), r(y * sy));
    } else if (c === "Z") {
      i++;
    } else {
      const pairs = c === "C" ? 3 : c === "S" || c === "Q" ? 2 : 1;
      for (let k = 0; k < pairs; k++) out.push(r(num() * sx), r(num() * sy));
    }
  }
  return out.join(" ");
}

const n = (v: number) => Math.round(v * 100) / 100;
const circle = (cx: number, cy: number, r: number) => `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0z`;
/** Anneau plein (deux cercles de sens opposés : le trou reste vide en règle « non nulle », SVG comme PDF). */
const ring = (cx: number, cy: number, r: number, t: number) =>
  `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0z` +
  `M${n(cx - r + t)} ${n(cy)}a${n(r - t)} ${n(r - t)} 0 1 1 ${n(2 * (r - t))} 0a${n(r - t)} ${n(r - t)} 0 1 1 ${n(-2 * (r - t))} 0z`;
const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

function starburst(points: number, rOut: number, rIn: number, cx = 50, cy = 50) {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 ? rIn : rOut;
    d += `${i ? "L" : "M"}${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`;
  }
  return `${d}Z`;
}

/** Lignes parallèles (angle en degrés) couvrant la boîte ; le rendu les découpe à la boîte. */
function hatch(w: number, h: number, spacing: number, angleDeg: number): string {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const diag = Math.hypot(w, h);
  const out: string[] = [];
  for (let c = -diag; c <= diag; c += spacing) {
    const px = w / 2 - dy * c;
    const py = h / 2 + dx * c;
    out.push(`M${n(px - dx * diag)} ${n(py - dy * diag)}L${n(px + dx * diag)} ${n(py + dy * diag)}`);
  }
  return out.join("");
}

export const GRAPHICS: Record<string, GraphicDef> = {
  // ─────────────── Illustrations métier (au trait)
  chaudiere: { label: "Chaudière", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 0.8, d: `${rrect(24, 8, 52, 70, 7)}${rrect(34, 18, 32, 16, 3)}M42 26h16${circle(40, 47, 4)}${circle(60, 47, 4)}M33 62h34M38 78v14M50 78v14M62 78v14M34 92h32` },
  radiateur: { label: "Radiateur", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 1.3, d: `${rrect(14, 22, 12, 56, 6)}${rrect(30, 22, 12, 56, 6)}${rrect(46, 22, 12, 56, 6)}${rrect(62, 22, 12, 56, 6)}M8 34h6M74 34h12M86 34v-8M20 78v8M68 78v8M30 12c2-4-2-6 0-10M44 12c2-4-2-6 0-10M58 12c2-4-2-6 0-10` },
  pac: { label: "Pompe à chaleur", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 1.45, d: `${rrect(8, 20, 84, 56, 6)}${circle(38, 48, 19)}${circle(38, 48, 4)}M38 29c8 6 8 12 0 19M57 48c-6 8-12 8-19 0M38 67c-8-6-8-12 0-19M19 48c6-8 12-8 19 0M66 32h18M66 40h18M66 48h18M66 56h18M66 64h18M18 76v8M82 76v8` },
  maison: { label: "Maison chauffée", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 1, d: "M12 50L50 16l38 34M22 42v44h56V42M42 86V64h16v22M28 52h10v10H28zM62 52h10v10H62zM66 26V14h8v19M38 6c3 4-3 6 0 10M50 2c3 4-3 6 0 10" },
  goutte: { label: "Goutte d'eau", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 0.8, d: "M50 8C38 28 22 44 22 62a28 28 0 0 0 56 0C78 44 62 28 50 8zM36 64a14 14 0 0 0 12 13" },
  flamme: { label: "Flamme", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 0.8, d: "M50 6c4 18 26 26 26 50a26 26 0 0 1-52 0c0-12 6-20 12-26 0 10 4 16 10 18-2-16 4-30 4-42zM50 92a10 10 0 0 1-10-10c0-8 10-14 10-22 0 8 10 14 10 22a10 10 0 0 1-10 10z" },
  flocon: { label: "Flocon", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 1, d: "M50 6v88M12 28l76 44M12 72l76-44M42 12l8 8 8-8M42 88l8-8 8 8M14 40l11-3-3-11M86 60l-11 3 3 11M14 60l11 3-3 11M86 40l-11-3 3-11" },
  outils: { label: "Clé et tournevis", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 1, d: "M22 14a14 14 0 0 0 18 18l46 46a6 6 0 0 1-8 8L32 40A14 14 0 0 1 14 22l8 8 8-2 2-8zM80 12l8 8-30 30-8-8zM48 44L18 74l-6 14 14-6 30-30" },
  thermometre: { label: "Thermomètre", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 0.6, d: `M40 66V16a10 10 0 0 1 20 0v50a18 18 0 1 1-20 0z${circle(50, 80, 8)}M50 72V30M66 24h10M66 36h10M66 48h10` },
  robinet: { label: "Robinet", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 1.1, d: "M10 40h34v-8h22a14 14 0 0 1 14 14v12M44 32V20M34 20h20M10 32v16M10 48h34v-8M80 66c-3 6-6 9-6 13a6 6 0 0 0 12 0c0-4-3-7-6-13z" },
  tuyaux: { label: "Réseau de tuyaux", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 1.4, d: `M6 30h34a10 10 0 0 1 10 10v20a10 10 0 0 0 10 10h34M6 46h22a6 6 0 0 1 6 6v36${rrect(44, 22, 12, 16, 2)}M50 22v-10M44 12h12${circle(76, 70, 6)}` },
  solaire: { label: "Panneau solaire", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 1.2, d: "M14 60L28 24h58L72 60zM21 42h58M48 24l-8 36M67 24l-8 36M50 60v18M36 82h28M18 12l4 6M8 22l7 2" },
  bouclier: { label: "Garantie", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 0.85, d: "M50 6l34 12v26c0 24-16 40-34 48C32 84 16 68 16 44V18zM34 48l11 11 22-22" },
  telephone: { label: "Appel", group: "Illustrations métier", kind: "art", mode: "stroke", ratio: 1, d: "M30 14l12 18-8 8c4 10 12 18 22 22l8-8 18 12-6 14c-30 2-62-30-60-60zM62 14a24 24 0 0 1 24 24M62 26a12 12 0 0 1 12 12" },
  // ─────────────── Formes organiques (aplats)
  vague: { label: "Vague", group: "Formes", kind: "art", stretch: true, mode: "fill", ratio: 3, d: "M0 56C16 40 30 40 50 52s34 14 50-2V100H0z" },
  vague2: { label: "Double vague", group: "Formes", kind: "art", stretch: true, mode: "fill", ratio: 3, d: "M0 40c18-14 32-14 50 0s32 14 50 0v60H0zM0 70c18-12 32-12 50 0s32 12 50 0v30H0z" },
  goutte_forme: { label: "Goutte", group: "Formes", kind: "art", mode: "fill", ratio: 1, d: "M50 0C30 30 10 48 10 66a40 40 0 0 0 80 0C90 48 70 30 50 0z" },
  galet: { label: "Galet", group: "Formes", kind: "art", stretch: true, mode: "fill", ratio: 1.2, d: "M18 30C30 6 70 2 86 22s12 56-14 68S8 90 6 64 6 44 18 30z" },
  galet2: { label: "Galet allongé", group: "Formes", kind: "art", stretch: true, mode: "fill", ratio: 1.6, d: "M8 46C10 16 46 6 72 12s26 36 16 56-44 30-64 22S6 70 8 46z" },
  arche: { label: "Arche", group: "Formes", kind: "art", stretch: true, mode: "fill", ratio: 0.75, d: "M10 100V50a40 40 0 0 1 80 0v50z" },
  quart: { label: "Quart de cercle", group: "Formes", kind: "art", stretch: true, mode: "fill", ratio: 1, d: "M0 0h100A100 100 0 0 1 0 100z" },
  demi: { label: "Demi-cercle", group: "Formes", kind: "art", stretch: true, mode: "fill", ratio: 2, d: "M0 100a50 50 0 0 1 100 0z" },
  feuille: { label: "Feuille", group: "Formes", kind: "art", stretch: true, mode: "fill", ratio: 1, d: "M10 90C10 40 40 10 90 10c0 50-30 80-80 80z" },
  eclair: { label: "Éclair", group: "Formes", kind: "art", mode: "fill", ratio: 0.6, d: "M58 0L14 56h30l-8 44 50-60H54z" },
  // ─────────────── Badges
  sceau: { label: "Sceau", group: "Badges", kind: "art", mode: "fill", ratio: 1, d: starburst(20, 50, 43) },
  etoile_badge: { label: "Étoile", group: "Badges", kind: "art", mode: "fill", ratio: 1, d: starburst(12, 50, 38) },
  pastille: { label: "Pastille cerclée", group: "Badges", kind: "art", mode: "fill", ratio: 1, d: `${ring(50, 50, 50, 4)}${circle(50, 50, 42)}` },
  ecusson: { label: "Écusson", group: "Badges", kind: "art", mode: "fill", ratio: 0.85, d: "M50 0l46 14v30c0 30-20 48-46 56C24 92 4 74 4 44V14z" },
  etiquette: { label: "Étiquette", group: "Badges", kind: "art", stretch: true, mode: "fill", ratio: 1.6, d: `M0 8a8 8 0 0 1 8-8h64l28 50-28 50H8a8 8 0 0 1-8-8z` },
  // ─────────────── Ornements (au trait)
  coin: { label: "Coin orné", group: "Ornements", kind: "art", mode: "stroke", ratio: 1, d: "M4 96V30C4 14 14 4 30 4h66M14 96V36c0-12 10-22 22-22h60M4 60c14 0 22 8 22 22" },
  separateur: { label: "Séparateur", group: "Ornements", kind: "art", mode: "stroke", ratio: 6, d: "M2 50h38M60 50h38M50 40l10 10-10 10-10-10z" },
  laurier: { label: "Laurier", group: "Ornements", kind: "art", mode: "stroke", ratio: 1.2, d: "M30 90C10 70 8 40 24 14M70 90c20-20 22-50 6-76M22 70c-8-2-12-8-12-14 6 0 12 4 12 14zM18 48c-8-2-12-8-12-14 6 0 12 4 12 14zM22 28c-6-4-8-10-6-16 6 2 8 8 6 16zM78 70c8-2 12-8 12-14-6 0-12 4-12 14zM82 48c8-2 12-8 12-14-6 0-12 4-12 14zM78 28c6-4 8-10 6-16-6 2-8 8-6 16z" },
  accolade: { label: "Accolades", group: "Ornements", kind: "art", mode: "stroke", ratio: 2.5, d: "M14 10c-8 0-8 8-8 16s0 16-4 24c4 8 4 16 4 24s0 16 8 16M86 10c8 0 8 8 8 16s0 16 4 24c-4 8-4 16-4 24s0 16-8 16" },
  // ─────────────── Motifs (générés en mm, découpés à la taille de l'élément)
  points: { label: "Points", group: "Motifs", kind: "pattern", mode: "fill", gen: (w, h, k) => { const s = 2.6 / k; let d = ""; for (let y = s / 2; y < h; y += s) for (let x = s / 2; x < w; x += s) d += circle(x, y, 0.35); return d; } },
  trame: { label: "Trame dégradée", group: "Motifs", kind: "pattern", mode: "fill", gen: (w, h, k) => { const s = 2.4 / k; let d = ""; for (let y = s / 2; y < h; y += s) for (let x = s / 2; x < w; x += s) d += circle(x, y, Math.max(0.06, (x / w) * s * 0.46)); return d; } },
  rayures: { label: "Rayures", group: "Motifs", kind: "pattern", mode: "stroke", gen: (w, h, k) => hatch(w, h, 2.4 / k, 45) },
  rayures_fines: { label: "Rayures fines", group: "Motifs", kind: "pattern", mode: "stroke", gen: (w, h, k) => hatch(w, h, 1.2 / k, -45) },
  grille: { label: "Grille", group: "Motifs", kind: "pattern", mode: "stroke", gen: (w, h, k) => hatch(w, h, 3 / k, 0) + hatch(w, h, 3 / k, 90) },
  ondes: { label: "Ondes", group: "Motifs", kind: "pattern", mode: "stroke", gen: (w, h, k) => { const s = 3 / k; let d = ""; for (let y = s / 2; y < h + s; y += s) { d += `M${n(-s)} ${n(y)}`; for (let x = -s; x < w + s; x += s * 2) d += `q${n(s / 2)} ${n(-s / 2)} ${n(s)} 0t${n(s)} 0`; } return d; } },
  cercles: { label: "Cercles concentriques", group: "Motifs", kind: "pattern", mode: "stroke", gen: (w, h, k) => { const s = 2.2 / k; let d = ""; const R = Math.hypot(w, h); for (let r = s; r < R; r += s) d += circle(w, h, r); return d; } },
  chevrons: { label: "Chevrons", group: "Motifs", kind: "pattern", mode: "stroke", gen: (w, h, k) => { const s = 3 / k; let d = ""; for (let y = 0; y < h + s; y += s) { d += `M${n(-s)} ${n(y)}`; for (let x = -s; x < w + s; x += s) d += `l${n(s / 2)} ${n(-s / 2)}l${n(s / 2)} ${n(s / 2)}`; } return d; } },
};

export const GRAPHIC_KEYS = Object.keys(GRAPHICS);
export const GRAPHIC_GROUPS = ["Illustrations métier", "Formes", "Badges", "Ornements", "Motifs"] as const;
