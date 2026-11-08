import {
  PDFDocument, StandardFonts, rgb, LineCapStyle, type PDFImage, type PDFPage, type PDFEmbeddedPage,
  pushGraphicsState, popGraphicsState, moveTo, lineTo, appendBezierCurve, closePath, clip, endPath,
} from "pdf-lib";
import { A4, FORMATS, sheetLayout, slotPosition, pageCount } from "./formats";
import { renderDoc, blockingIssues, roundedRectPath, type Prim } from "./render";
import type { LabelDoc, LabelData } from "./doc";
import { qrPath, moduleSize } from "./qr";
import { QR_DARK, QR_LIGHT } from "./palette";

/** 1 mm en points PDF. */
export const MM = 72 / 25.4;

function color(hex: string) {
  const h = hex.replace("#", "");
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}

/** Découpe (clip) à la forme arrondie de l'étiquette : rien ne déborde, comme dans l'aperçu. */
function clipRounded(page: PDFPage, x: number, y: number, w: number, h: number, r: number) {
  const H = page.getHeight();
  r = Math.min(r, w / 2, h / 2);
  const k = 0.5523 * r;
  const X = (v: number) => v * MM;
  const Y = (v: number) => H - v * MM;
  const ops = [
    pushGraphicsState(),
    moveTo(X(x + r), Y(y)),
    lineTo(X(x + w - r), Y(y)),
    appendBezierCurve(X(x + w - r + k), Y(y), X(x + w), Y(y + r - k), X(x + w), Y(y + r)),
    lineTo(X(x + w), Y(y + h - r)),
    appendBezierCurve(X(x + w), Y(y + h - r + k), X(x + w - r + k), Y(y + h), X(x + w - r), Y(y + h)),
    lineTo(X(x + r), Y(y + h)),
    appendBezierCurve(X(x + r - k), Y(y + h), X(x), Y(y + h - r + k), X(x), Y(y + h - r)),
    lineTo(X(x), Y(y + r)),
    appendBezierCurve(X(x), Y(y + r - k), X(x + r - k), Y(y), X(x + r), Y(y)),
    closePath(),
    clip(),
    endPath(),
  ];
  page.pushOperators(...ops);
}

/**
 * drawSvgPath applique `scale` à toute la géométrie, épaisseur de trait comprise :
 * les épaisseurs sont donc exprimées dans l'unité du tracé (mm, ou unité de l'icône).
 */
function draw(page: PDFPage, p: Prim, ox: number, oy: number, images: Record<string, PDFImage>) {
  // Hauteur de la page de dessin : planche A4, ou page de la taille d'une étiquette (gabarit réutilisé).
  const H = page.getHeight();
  if ((p.t === "path" || p.t === "image") && p.clip) {
    clipRounded(page, ox + p.clip.x, oy + p.clip.y, p.clip.w, p.clip.h, p.clip.r);
    draw(page, { ...p, clip: undefined } as Prim, ox, oy, images);
    page.pushOperators(popGraphicsState());
    return;
  }
  switch (p.t) {
    case "path": {
      const s = p.tf ? p.tf.s : 1;
      const x = (ox + (p.tf?.x ?? 0)) * MM;
      const y = H - (oy + (p.tf?.y ?? 0)) * MM;
      const sw = p.sw ?? 0.3;
      page.drawSvgPath(p.d, {
        x,
        y,
        scale: s * MM,
        ...(p.fill ? { color: color(p.fill), opacity: p.opacity ?? 1 } : {}),
        ...(p.stroke
          ? {
              borderColor: color(p.stroke),
              borderWidth: sw,
              borderOpacity: p.opacity ?? 1,
              borderLineCap: p.cap === "round" ? LineCapStyle.Round : LineCapStyle.Butt,
              ...(p.dash ? { borderDashArray: [sw * 3, sw * 2.5] } : {}),
            }
          : {}),
      });
      return;
    }
    case "image": {
      const img = images[p.key];
      if (img) page.drawImage(img, { x: (ox + p.x) * MM, y: H - (oy + p.y + p.h) * MM, width: p.w * MM, height: p.h * MM, opacity: p.opacity ?? 1 });
      return;
    }
    case "qr": {
      page.drawSvgPath(roundedRectPath(p.x, p.y, p.size, p.size, p.radius), { x: ox * MM, y: H - oy * MM, scale: MM, color: color(QR_LIGHT) });
      const m = moduleSize(p.matrix, p.size);
      page.drawSvgPath(qrPath(p.matrix), { x: (ox + p.x) * MM, y: H - (oy + p.y) * MM, scale: m * MM, color: color(QR_DARK) });
      return;
    }
  }
}

function cropMarks(page: PDFPage, x: number, y: number, w: number, h: number) {
  const H = page.getHeight();
  const len = 1.6;
  const off = 0.6;
  const grey = rgb(0.7, 0.7, 0.7);
  const seg = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1 * MM, y: H - y1 * MM }, end: { x: x2 * MM, y: H - y2 * MM }, thickness: 0.15 * MM, color: grey });
  for (const [cx, cy, sx, sy] of [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ] as const) {
    seg(cx + sx * off, cy, cx + sx * (off + len), cy);
    seg(cx, cy + sy * off, cx, cy + sy * (off + len));
  }
}

export class LabelCheckError extends Error {}

export interface SheetInput {
  doc: LabelDoc;
  /** Une entrée par étiquette (URL et code propres à chacune). */
  items: LabelData[];
  logoPng: Uint8Array | null;
  /** Photos utilisées par le design (JPEG), par identifiant. */
  photos?: Record<string, Uint8Array>;
  brandName: string;
  title: string;
}

/** Dessine une étiquette complète (fond, éléments, QR) à la position (x, y) en mm de la page. */
function drawLabel(page: PDFPage, label: ReturnType<typeof renderDoc>, x: number, y: number, images: Record<string, PDFImage>) {
  clipRounded(page, x, y, label.w, label.h, label.corner);
  page.drawSvgPath(roundedRectPath(0, 0, label.w, label.h, label.corner), { x: x * MM, y: page.getHeight() - y * MM, scale: MM, color: color(label.background) });
  for (const p of label.prims) draw(page, p, x, y, images);
  page.pushOperators(popGraphicsState());
}

async function embedImages(pdf: PDFDocument, logoPng: Uint8Array | null, photos: Record<string, Uint8Array> | undefined): Promise<Record<string, PDFImage>> {
  const images: Record<string, PDFImage> = {};
  if (logoPng) images.logo = await pdf.embedPng(logoPng);
  for (const [id, bytes] of Object.entries(photos ?? {})) images[id] = bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  return images;
}

/**
 * Planche A4 100 % vectorielle (texte en contours) : dimensions exactes, étiquettes centrées,
 * marges de 10 mm, repères de coupe. Chaque QR est décodé avant d'être écrit : un seul échec = aucun PDF.
 *
 * Étiquettes identiques (cas normal : le QR principal du pro, répété sur toute la planche) :
 * l'étiquette est vérifiée et dessinée UNE fois dans un gabarit (« Form XObject ») que chaque
 * emplacement réutilise. Rendu identique au tracé direct, mais le fichier et le temps de calcul ne
 * grossissent plus avec la quantité (indispensable sous les limites des hébergeurs serverless).
 * Étiquettes toutes différentes (anciens lots, un code par étiquette) : tracé direct, comme avant.
 */
export async function renderSheetPdf(input: SheetInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(input.title);
  pdf.setCreator(input.brandName);
  pdf.setProducer(input.brandName);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const format = input.doc.format;
  const layout = sheetLayout(format);
  const pages = pageCount(format, input.items.length);
  const f = FORMATS[format];

  const pdfPages: PDFPage[] = [];
  for (let i = 0; i < pages; i++) {
    const page = pdf.addPage([A4.w * MM, A4.h * MM]);
    const note = `${input.brandName} · Étiquettes ${f.w} × ${f.h} mm · Imprimer en « taille réelle » (100 %), sans « ajuster à la page » · Page ${i + 1}/${pages}`;
    page.drawText(note, { x: layout.originX * MM, y: (A4.h - 6) * MM, size: 6.5, font: regular, color: rgb(0.45, 0.45, 0.45) });
    pdfPages.push(page);
  }

  // Combien de fois chaque étiquette (mêmes données = même rendu) apparaît.
  const keyOf = (d: LabelData) => JSON.stringify(d);
  const occurrences = new Map<string, number>();
  for (const d of input.items) occurrences.set(keyOf(d), (occurrences.get(keyOf(d)) ?? 0) + 1);

  let sheetImages: Record<string, PDFImage> | null = null; // images de la planche, pour le tracé direct
  const templates = new Map<string, { emb: PDFEmbeddedPage; h: number }>();

  for (const [index, data] of input.items.entries()) {
    const key = keyOf(data);
    const slot = slotPosition(layout, index);
    const page = pdfPages[slot.page]!;
    const reuse = (occurrences.get(key) ?? 0) > 1;
    let tpl = reuse ? templates.get(key) : undefined;
    let height: number;
    if (!tpl) {
      const label = renderDoc(input.doc, data);
      const errors = blockingIssues(label);
      if (errors.length) throw new LabelCheckError(`${data.code} : ${errors.map((e) => e.message).join(" ")}`);
      height = label.h;
      if (reuse) {
        // Gabarit : une page de la taille exacte de l'étiquette, dessinée avec le même code que la planche.
        const one = await PDFDocument.create();
        const lp = one.addPage([label.w * MM, label.h * MM]);
        drawLabel(lp, label, 0, 0, await embedImages(one, input.logoPng, input.photos));
        // Gabarit finalisé (save) avant intégration : ses images sont alors réellement écrites et copiées.
        const [emb] = await pdf.embedPdf(await one.save());
        tpl = { emb: emb!, h: label.h };
        templates.set(key, tpl);
      } else {
        sheetImages ??= await embedImages(pdf, input.logoPng, input.photos);
        drawLabel(page, label, slot.x, slot.y, sheetImages);
        cropMarks(page, slot.x, slot.y, label.w, label.h);
        continue;
      }
    }
    height = tpl.h;
    page.drawPage(tpl.emb, { x: slot.x * MM, y: (A4.h - slot.y - height) * MM });
    cropMarks(page, slot.x, slot.y, f.w, f.h);
  }

  return pdf.save();
}
