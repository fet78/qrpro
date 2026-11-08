// npx tsx scripts/gallery.ts : galerie de tous les modèles × formats (tests/output/gallery.html) + diagnostic.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { jpegSize } from "../src/lib/images";
import { loadServerFonts } from "../src/lib/labels/fonts-server";
import { renderDoc } from "../src/lib/labels/render";
import { labelSvg } from "../src/lib/labels/svg";
import { TEMPLATES, buildTemplate, formatsOf } from "../src/lib/labels/library";
import { FORMAT_KEYS, FORMATS } from "../src/lib/labels/formats";
import type { LabelData } from "../src/lib/labels/doc";

const DATA: LabelData = {
  name: process.argv.includes("--long") ? "Entreprise de chauffage plomberie climatisation générale du Grand Ouest" : "Chauffage Dupont & Fils",
  trade: "Plombier chauffagiste", phone: "06 12 34 56 78", email: "contact@dupont.fr", website: "dupont.fr", city: "Lyon", zone: "Lyon",
  url: "https://www.monqrpro.fr/q/K7F2QXA", code: "K7F2QXA", logo: { w: 300, h: 300 },
};
const logo = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" rx="60" fill="#EA580C"/><text x="150" y="190" font-size="140" text-anchor="middle" fill="#fff" font-family="Arial" font-weight="700">CD</text></svg>')}`;

const jpg = readFileSync("tests/fixtures/photo-test.jpg");
const size = jpegSize(new Uint8Array(jpg))!;
DATA.images = { photo00000001: { w: size.w, h: size.h } };
const images = { photo00000001: `data:image/jpeg;base64,${jpg.toString("base64")}` };
const withPhoto = !process.argv.includes("--nophoto");
await loadServerFonts();
mkdirSync("tests/output", { recursive: true });
let html = `<!doctype html><meta charset="utf-8"><body style="background:#e5e7eb;font-family:sans-serif;padding:20px">`;
for (const t of TEMPLATES) {
  html += `<div style="display:flex;gap:24px;align-items:flex-start;margin-bottom:22px"><b style="width:120px">${t.name}<br><small>${t.category}</small></b>`;
  for (const f of FORMAT_KEYS) {
    if (!formatsOf(t).includes(f)) { html += `<div style="width:${FORMATS[f].w * 4.4}px"></div>`; continue; }
    const label = renderDoc(buildTemplate(t.key, f, { photo: withPhoto ? "photo00000001" : null }), DATA);
    for (const i of label.issues) console.log(`${t.key} ${f} ${i.level} ${i.code} ${i.elementId}`);
    html += `<div>${labelSvg(label, { pxWidth: label.w * 4.4, logoHref: logo, images })}</div>`;
  }
  html += `</div>`;
}
writeFileSync("tests/output/gallery.html", html);
console.log("tests/output/gallery.html");
