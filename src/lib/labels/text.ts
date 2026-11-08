import { Font, FontNames, Encodings } from "@pdf-lib/standard-fonts";

/**
 * Mesure du texte avec les métriques exactes d'Helvetica (police standard des PDF).
 * Le SVG utilise « Helvetica, Arial » (métriques identiques) : l'aperçu correspond au PDF.
 * Unités : la taille est en mm, la largeur rendue aussi.
 */
const fonts = {
  regular: Font.load(FontNames.Helvetica),
  bold: Font.load(FontNames.HelveticaBold),
};

const REPLACEMENTS: Record<string, string> = {
  "’": "'",
  "‘": "'",
  "“": '"',
  "”": '"',
  " ": " ",
  " ": " ",
  " ": " ",
};

/** Ne garde que les caractères imprimables en WinAnsi (accents français, €, œ… inclus). */
export function printable(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const c = REPLACEMENTS[ch] ?? ch;
    const cp = c.codePointAt(0)!;
    if (cp < 32) continue;
    if (Encodings.WinAnsi.canEncodeUnicodeCodePoint(cp)) out += c;
  }
  return out.replace(/\s+/g, " ").trim();
}

export function textWidth(text: string, size: number, bold = false): number {
  const font = bold ? fonts.bold : fonts.regular;
  let units = 0;
  for (const ch of text) {
    const glyph = Encodings.WinAnsi.encodeUnicodeCodePoint(ch.codePointAt(0)!);
    units += font.getWidthOfGlyph(glyph.name) ?? 556;
  }
  return (units / 1000) * size;
}

function wrap(text: string, maxW: number, size: number, bold: boolean): string[] {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size, bold) <= maxW || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function ellipsize(text: string, maxW: number, size: number, bold: boolean): string {
  if (textWidth(text, size, bold) <= maxW) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}…`, size, bold) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export interface FittedText {
  lines: string[];
  size: number;
}

/**
 * Fait tenir un texte dans `maxW` sur au plus `maxLines` lignes : réduit la taille jusqu'à
 * `minSize`, puis tronque avec « … » en dernier recours. Rien ne dépasse jamais de sa zone.
 */
export function fitText(raw: string, opts: { maxW: number; size: number; minSize?: number; maxLines?: number; bold?: boolean }): FittedText {
  const text = printable(raw);
  const bold = opts.bold ?? false;
  const maxLines = opts.maxLines ?? 1;
  const minSize = opts.minSize ?? opts.size * 0.7;
  if (!text) return { lines: [], size: opts.size };
  for (let size = opts.size; size >= minSize - 1e-9; size -= 0.05) {
    const lines = wrap(text, opts.maxW, size, bold);
    if (lines.length <= maxLines && lines.every((l) => textWidth(l, size, bold) <= opts.maxW)) return { lines, size };
  }
  const lines = wrap(text, opts.maxW, minSize, bold);
  const kept = lines.slice(0, maxLines);
  if (lines.length > maxLines) kept[maxLines - 1] = `${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`;
  return { lines: kept.map((l) => ellipsize(l, opts.maxW, minSize, bold)), size: minSize };
}
