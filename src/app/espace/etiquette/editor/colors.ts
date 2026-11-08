"use client";

import { contrastRatio } from "@/lib/labels/palette";
import type { Palette } from "@/lib/labels/doc";

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return hex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Assombrit une couleur jusqu'à obtenir le contraste voulu sur blanc (texte lisible). */
export function readableOnWhite(c: string, min = 4.5): string {
  let out = c;
  for (let i = 0; i < 20 && contrastRatio(out, "#FFFFFF") < min; i++) out = mix(out, "#000000", 0.08);
  return out;
}

function saturation([r, g, b]: [number, number, number]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/**
 * Couleurs dominantes d'un logo (échantillonnage 64×64, regroupement par teinte).
 * Le blanc, le noir et les pixels transparents sont ignorés ; les couleurs vives sont favorisées.
 */
export async function logoColors(src: string): Promise<string[]> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("logo"));
    i.src = src;
  });
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, 64, 64);
  const px = ctx.getImageData(0, 0, 64, 64).data;
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3]! < 160) continue;
    const r = px[i]!, g = px[i + 1]!, b = px[i + 2]!;
    const lum = (r + g + b) / 3;
    if (lum > 236 || lum < 18) continue;
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  return [...buckets.values()]
    .map((b) => ({ color: [b.r / b.n, b.g / b.n, b.b / b.n] as [number, number, number], weight: b.n * (0.35 + saturation([b.r / b.n, b.g / b.n, b.b / b.n])) }))
    .sort((a, b) => b.weight - a.weight)
    .map((x) => hex(...x.color))
    .filter((c, i, all) => all.findIndex((o) => colorDistance(o, c) < 60) === i)
    .slice(0, 4);
}

function colorDistance(a: string, b: string) {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

/** Harmonie construite à partir des couleurs d'un logo, contrastes garantis. */
export function paletteFromColors(colors: string[]): Palette {
  const primary = readableOnWhite(colors[0] ?? "#1D4ED8", 4.5);
  const accent = readableOnWhite(colors[1] ?? mix(primary, "#000000", 0.3), 3.2);
  return { primary, secondary: mix(primary, "#FFFFFF", 0.87), accent, ink: mix(primary, "#0B0F19", 0.85), paper: "#FFFFFF" };
}
