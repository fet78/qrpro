/** Formats d'étiquettes (mm) et calcul de la planche A4. Fichier partagé navigateur / serveur. */

export const FORMATS = {
  F40X40: { key: "F40X40", label: "40 × 40 mm", w: 40, h: 40, hint: "Discret, pour petits appareils" },
  F50X50: { key: "F50X50", label: "50 × 50 mm", w: 50, h: 50, hint: "Carré, le plus polyvalent" },
  F60X40: { key: "F60X40", label: "60 × 40 mm", w: 60, h: 40, hint: "Rectangle compact" },
  F70X50: { key: "F70X50", label: "70 × 50 mm", w: 70, h: 50, hint: "Grand, très lisible" },
  F90X60: { key: "F90X60", label: "90 × 60 mm", w: 90, h: 60, hint: "Grand format, design aéré" },
} as const;

export type FormatKey = keyof typeof FORMATS;
export const FORMAT_KEYS = Object.keys(FORMATS) as FormatKey[];

export function isFormatKey(v: unknown): v is FormatKey {
  return typeof v === "string" && v in FORMATS;
}

/** Quantités proposées pour une planche numérique. */
export const SHEET_COUNTS = [10, 25, 50, 100] as const;

export const A4 = { w: 210, h: 297 } as const;
/** Marge minimale : la plupart des imprimantes n'impriment pas à moins de 5 mm du bord. */
export const SHEET_MARGIN = 10;
/** Espace entre étiquettes, pour découper sans entamer le visuel. */
export const SHEET_GAP = 4;

export interface SheetLayout {
  cols: number;
  rows: number;
  perPage: number;
  /** Origine de la grille (mm, depuis le coin haut gauche), grille centrée sur la page. */
  originX: number;
  originY: number;
  w: number;
  h: number;
  gap: number;
}

export function sheetLayout(format: FormatKey): SheetLayout {
  const { w, h } = FORMATS[format];
  const usableW = A4.w - 2 * SHEET_MARGIN;
  const usableH = A4.h - 2 * SHEET_MARGIN;
  const cols = Math.floor((usableW + SHEET_GAP) / (w + SHEET_GAP));
  const rows = Math.floor((usableH + SHEET_GAP) / (h + SHEET_GAP));
  const gridW = cols * w + (cols - 1) * SHEET_GAP;
  const gridH = rows * h + (rows - 1) * SHEET_GAP;
  return {
    cols,
    rows,
    perPage: cols * rows,
    originX: (A4.w - gridW) / 2,
    originY: (A4.h - gridH) / 2,
    w,
    h,
    gap: SHEET_GAP,
  };
}

/** Position (mm) de l'étiquette n° index (0-based) : page, x, y. */
export function slotPosition(layout: SheetLayout, index: number) {
  const page = Math.floor(index / layout.perPage);
  const i = index % layout.perPage;
  const col = i % layout.cols;
  const row = Math.floor(i / layout.cols);
  return {
    page,
    x: layout.originX + col * (layout.w + layout.gap),
    y: layout.originY + row * (layout.h + layout.gap),
  };
}

export function pageCount(format: FormatKey, count: number): number {
  return Math.max(1, Math.ceil(count / sheetLayout(format).perPage));
}
