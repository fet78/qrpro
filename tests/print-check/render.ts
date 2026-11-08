/**
 * Contrôle « comme à l'impression » d'une planche réelle de la base :
 *   1. génère le PDF d'un lot (même code que le téléchargement) ;
 *   2. tests/print-check/rasterize.py le rastérise à 300 dpi (PyMuPDF) et découpe chaque étiquette ;
 *   3. decode.ts relit chaque QR avec jsQR et compare à l'URL attendue.
 * Lancer : npx tsx --conditions=react-server tests/print-check/render.ts [batchId]
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { db } from "../../src/server/db";
import { batchLabels } from "../../src/server/business";
import { renderSheetPdf } from "../../src/lib/labels/pdf";
import { loadServerFonts } from "../../src/lib/labels/fonts-server";
import { sheetLayout, slotPosition } from "../../src/lib/labels/formats";

async function main() {
  const id = process.argv[2] ?? (await db.batch.findFirstOrThrow({ orderBy: { createdAt: "desc" } })).id;
  const { doc, items, logo, photos } = await batchLabels(id);
  await loadServerFonts();
  const pdf = await renderSheetPdf({ doc, items, logoPng: logo, photos, brandName: "QR Pro", title: "check" });
  const format = doc.format;
  mkdirSync("tests/output", { recursive: true });
  writeFileSync("tests/output/batch.pdf", pdf);
  const layout = sheetLayout(format);
  const slots = items.map((l, i) => ({ ...slotPosition(layout, i), w: layout.w, h: layout.h, url: l.url }));
  writeFileSync("tests/output/slots.json", JSON.stringify(slots));
  console.log(`PDF écrit (${items.length} étiquettes, format ${format}).`);
}

main().finally(() => db.$disconnect());
