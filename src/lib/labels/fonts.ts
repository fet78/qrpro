import fontkit from "@pdf-lib/fontkit";
import { FONTS, type FontKey } from "./doc";

/**
 * Registre des polices, partagé navigateur / serveur. Les fichiers TTF sont chargés une fois
 * (fonts-server.ts lit le disque, fonts-client.ts les télécharge) puis analysés par fontkit.
 *
 * Le texte n'est jamais confié au moteur de rendu : il est converti en CONTOURS vectoriels
 * (glyphes), si bien que l'aperçu, le PNG, le SVG et le PDF sont strictement identiques,
 * sans dépendre des polices installées chez l'imprimeur.
 */

type FkFont = {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  capHeight: number;
  layout(text: string): { glyphs: { path: { commands: { command: string; args: number[] }[] } }[]; positions: { xAdvance: number; xOffset: number; yOffset: number }[] };
};

const registry = new Map<string, FkFont>();
const keyOf = (family: FontKey, bold: boolean) => `${family}:${bold ? "b" : "r"}`;

export function fontFile(family: FontKey, bold: boolean): string {
  return bold ? FONTS[family].bold : FONTS[family].regular;
}

export function registerFont(family: FontKey, bold: boolean, bytes: Uint8Array) {
  if (registry.has(keyOf(family, bold))) return;
  registry.set(keyOf(family, bold), (fontkit as unknown as { create(b: Uint8Array): FkFont }).create(bytes));
}

export function hasFont(family: FontKey, bold: boolean) {
  return registry.has(keyOf(family, bold));
}

function font(family: FontKey, bold: boolean): FkFont {
  const f = registry.get(keyOf(family, bold)) ?? registry.get(keyOf(family, !bold)) ?? registry.get(keyOf("inter", bold)) ?? [...registry.values()][0];
  if (!f) throw new Error("Aucune police chargée (loadServerFonts / loadClientFonts).");
  return f;
}

/** Largeur (mm) d'un texte à une taille donnée (mm = hauteur du corps). */
export function measure(text: string, family: FontKey, bold: boolean, size: number, tracking = 0): number {
  if (!text) return 0;
  const f = font(family, bold);
  const run = f.layout(text);
  const units = run.positions.reduce((s, p) => s + p.xAdvance, 0);
  return (units / f.unitsPerEm) * size + tracking * size * Math.max(0, [...text].length - 1);
}

export function metrics(family: FontKey, bold: boolean, size: number) {
  const f = font(family, bold);
  return { ascent: (f.ascent / f.unitsPerEm) * size, descent: (-f.descent / f.unitsPerEm) * size, cap: ((f.capHeight || f.ascent * 0.7) / f.unitsPerEm) * size };
}

const n = (v: number) => Math.round(v * 1000) / 1000;

/** Contour SVG (coordonnées en mm) d'une ligne de texte posée sur sa ligne de base (x, y). */
export function textPath(text: string, family: FontKey, bold: boolean, size: number, x: number, y: number, tracking = 0): string {
  const f = font(family, bold);
  const s = size / f.unitsPerEm;
  const run = f.layout(text);
  const out: string[] = [];
  let pen = x;
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i]!;
    const ox = pen + pos.xOffset * s;
    const oy = y - pos.yOffset * s;
    for (const c of g.path.commands) {
      const a = c.args;
      const P = (j: number) => `${n(ox + a[j]! * s)} ${n(oy - a[j + 1]! * s)}`;
      switch (c.command) {
        case "moveTo": out.push(`M${P(0)}`); break;
        case "lineTo": out.push(`L${P(0)}`); break;
        case "quadraticCurveTo": out.push(`Q${P(0)} ${P(2)}`); break;
        case "bezierCurveTo": out.push(`C${P(0)} ${P(2)} ${P(4)}`); break;
        case "closePath": out.push("Z"); break;
      }
    }
    pen += pos.xAdvance * s + tracking * size;
  });
  return out.join("");
}

export const ALL_FONT_FILES: { family: FontKey; bold: boolean; file: string }[] = (Object.keys(FONTS) as FontKey[]).flatMap((family) => [
  { family, bold: false, file: FONTS[family].regular },
  { family, bold: true, file: FONTS[family].bold },
]);
