import type { RenderedLabel, Prim } from "./render";
import { roundedRectPath } from "./render";
import { qrPath, moduleSize } from "./qr";
import { QR_DARK, QR_LIGHT } from "./palette";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const n = (v: number) => Number(v.toFixed(3)).toString();
let uid = 0;

type Ctx = { hrefs: Record<string, string>; defs: string[]; id: string };

function clipAttr(ctx: Ctx, c: Prim extends infer T ? (T extends { clip?: infer C } ? C : never) : never): string {
  if (!c) return "";
  const cid = `${ctx.id}k${ctx.defs.length}`;
  ctx.defs.push(`<clipPath id="${cid}"><path d="${roundedRectPath(c.x, c.y, c.w, c.h, c.r)}"/></clipPath>`);
  return ` clip-path="url(#${cid})"`;
}

function prim(p: Prim, ctx: Ctx): string {
  switch (p.t) {
    case "path": {
      if (p.clip) {
        const inner = prim({ ...p, clip: undefined }, ctx);
        return `<g${clipAttr(ctx, p.clip)}>${inner}</g>`;
      }
      const tf = p.tf ? ` transform="translate(${n(p.tf.x)} ${n(p.tf.y)}) scale(${n(p.tf.s)})"` : "";
      const op = p.opacity !== undefined && p.opacity < 1 ? ` opacity="${n(p.opacity)}"` : "";
      const stroke = p.stroke ? ` stroke="${p.stroke}" stroke-width="${n(p.sw ?? 0.3)}"${p.cap ? ` stroke-linecap="${p.cap}" stroke-linejoin="round"` : ""}${p.dash ? ` stroke-dasharray="${n((p.sw ?? 0.3) * 3)} ${n((p.sw ?? 0.3) * 2.5)}"` : ""}` : "";
      return `<path d="${p.d}" fill="${p.fill ?? "none"}"${stroke}${tf}${op}/>`;
    }
    case "image": {
      const href = ctx.hrefs[p.key];
      if (!href) return "";
      const img = `<image x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}" href="${esc(href)}" preserveAspectRatio="none"${p.opacity !== undefined && p.opacity < 1 ? ` opacity="${n(p.opacity)}"` : ""}/>`;
      return p.clip ? `<g${clipAttr(ctx, p.clip)}>${img}</g>` : img;
    }
    case "qr": {
      const m = moduleSize(p.matrix, p.size);
      return (
        `<path d="${roundedRectPath(p.x, p.y, p.size, p.size, p.radius)}" fill="${QR_LIGHT}"/>` +
        `<path d="${qrPath(p.matrix)}" transform="translate(${n(p.x)} ${n(p.y)}) scale(${n(m)})" fill="${QR_DARK}" shape-rendering="crispEdges"/>`
      );
    }
  }
}

/**
 * Étiquette en SVG autonome (aucune police externe : le texte est déjà en contours).
 * Dimensions réelles en mm (ou en px avec pxWidth). Découpée à la forme de l'étiquette.
 */
export function labelSvg(label: RenderedLabel, opts: { logoHref?: string | null; images?: Record<string, string>; pxWidth?: number } = {}): string {
  const id = `c${(uid = (uid + 1) % 1e9)}`;
  const ctx: Ctx = { hrefs: { ...(opts.images ?? {}), ...(opts.logoHref ? { logo: opts.logoHref } : {}) }, defs: [], id };
  const size = opts.pxWidth ? `width="${opts.pxWidth}" height="${Math.round((opts.pxWidth * label.h) / label.w)}"` : `width="${label.w}mm" height="${label.h}mm"`;
  const shape = roundedRectPath(0, 0, label.w, label.h, label.corner);
  const body = label.prims.map((p) => prim(p, ctx)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 ${label.w} ${label.h}"><defs><clipPath id="${id}"><path d="${shape}"/></clipPath>${ctx.defs.join("")}</defs><g clip-path="url(#${id})"><path d="${shape}" fill="${label.background}"/>${body}</g></svg>`;
}

/** QR seul (sans habillage), avec sa zone blanche, pour les imprimeurs ou un usage libre. */
export function qrOnlySvg(label: RenderedLabel, mm = 40): string {
  const qr = label.prims.find((p) => p.t === "qr");
  if (!qr || qr.t !== "qr") return "";
  const side = qr.matrix.size + 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${mm}mm" height="${mm}mm" viewBox="0 0 ${side} ${side}"><rect width="100%" height="100%" fill="${QR_LIGHT}"/><path d="${qrPath(qr.matrix)}" fill="${QR_DARK}" shape-rendering="crispEdges"/></svg>`;
}
