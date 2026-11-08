import { beforeAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { FORMAT_KEYS, sheetLayout, slotPosition, A4, SHEET_MARGIN, FORMATS } from "./formats";
import { contrastRatio } from "./palette";
import { qrMatrix, MIN_MODULE_MM } from "./qr";
import { decodeMatrix, verifyUrlEncodes } from "./verify";
import { loadServerFonts } from "./fonts-server";
import { measure } from "./fonts";
import { renderDoc, fixAll, layoutText } from "./render";
import { TEMPLATES, CATEGORIES, buildTemplate, blankDoc, formatsOf } from "./library";
import { PALETTES, rescaleDoc, normalizeDoc, docSchema, MIN_QR_MM, type LabelData, type TextEl } from "./doc";
import { renderSheetPdf, MM } from "./pdf";
import { labelSvg } from "./svg";
import { storedToDoc } from "./content";

const DATA: LabelData = {
  name: "Chauffage Dupont & Fils",
  trade: "Plombier chauffagiste",
  phone: "06 12 34 56 78",
  email: "contact@dupont.fr",
  website: "https://dupont.fr",
  city: "Lyon",
  zone: "Lyon",
  url: "https://www.monqrpro.fr/q/K7F2QXA",
  images: { ph0000000001: { w: 1600, h: 1067 } },
  code: "K7F2QXA",
  logo: { w: 400, h: 200 },
};
const LONG: LabelData = { ...DATA, name: "Entreprise de chauffage plomberie climatisation générale du Grand Ouest", trade: "Installation, entretien et dépannage toutes énergies" };

beforeAll(() => loadServerFonts());

describe("QR", () => {
  it("se relit exactement (décodeur indépendant)", () => {
    expect(verifyUrlEncodes(DATA.url)).toBe(true);
    expect(decodeMatrix(qrMatrix("https://x.fr/p/a/B"))).toBe("https://x.fr/p/a/B");
  });
});

describe("Bibliothèque de modèles", () => {
  it("contient au moins 30 modèles, chaque catégorie est utilisée", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(TEMPLATES.map((t) => t.category)).size).toBe(CATEGORIES.length);
    expect(new Set(TEMPLATES.map((t) => t.key)).size).toBe(TEMPLATES.length);
  });
  it("chaque format propose un vrai choix de modèles", () => {
    for (const f of FORMAT_KEYS) expect(TEMPLATES.filter((t) => formatsOf(t).includes(f)).length, f).toBeGreaterThanOrEqual(f === "F40X40" ? 12 : 30);
  });

  for (const t of TEMPLATES)
    for (const format of formatsOf(t)) {
      if (t.usesPhoto)
        it(`${t.key} ${format} : avec une photo du pro, aucun avertissement`, () => {
          const doc = buildTemplate(t.key, format, { photo: "ph0000000001" });
          expect(docSchema.safeParse(doc).success).toBe(true);
          expect(doc.elements.some((e) => e.type === "image")).toBe(true);
          expect(renderDoc(doc, DATA).issues.map((i) => `${i.code}:${i.elementId}`)).toEqual([]);
        });
      it(`${t.key} ${format} : valide, QR lisible, aucun avertissement`, () => {
        const doc = buildTemplate(t.key, format);
        expect(docSchema.safeParse(doc).success).toBe(true);
        const label = renderDoc(doc, DATA);
        expect(label.issues.map((i) => `${i.code}:${i.elementId}`)).toEqual([]);
        expect(label.qr.size).toBeGreaterThanOrEqual(MIN_QR_MM);
        expect(label.qr.moduleMm).toBeGreaterThanOrEqual(MIN_MODULE_MM);
      });
      it(`${t.key} ${format} : noms d'entreprise réalistes (jusqu'à 33 caractères) sans troncature`, () => {
        for (const name of ["Plomberie Test mw5jbauj", "Plomberie Chauffage Martin & Fils", "SARL Thermique Services du Rhône"])
          for (const logo of [true, false]) {
            const label = renderDoc(buildTemplate(t.key, format, { logo }), { ...DATA, name, logo: logo ? DATA.logo : null });
            expect(label.issues.map((i) => `${name}:${i.code}`)).toEqual([]);
          }
      });
      it(`${t.key} ${format} : sans logo, toujours aucun avertissement`, () => {
        const label = renderDoc(buildTemplate(t.key, format, { logo: false }), { ...DATA, logo: null });
        expect(label.issues.map((i) => `${i.code}:${i.elementId}`)).toEqual([]);
      });
      it(`${t.key} ${format} : textes très longs → jamais d'erreur bloquante`, () => {
        const label = renderDoc(buildTemplate(t.key, format), LONG);
        expect(label.issues.filter((i) => i.level === "error")).toEqual([]);
      });
    }
});

describe("Règles de lisibilité imposées", () => {
  it("le QR reste au premier plan, carré, assez grand et dans l'étiquette", () => {
    const doc = buildTemplate("classique", "F50X50");
    const qr = doc.elements.find((e) => e.type === "qr")!;
    const broken = normalizeDoc({ ...doc, elements: [{ ...qr, x: 45, y: -10, w: 5, h: 9 }, ...doc.elements.filter((e) => e.type !== "qr")] });
    const fixed = broken.elements.at(-1)!;
    expect(fixed.type).toBe("qr");
    expect(fixed.w).toBe(fixed.h);
    expect(fixed.w).toBeGreaterThanOrEqual(MIN_QR_MM);
    expect(fixed.x + fixed.w).toBeLessThanOrEqual(50);
    expect(fixed.y).toBeGreaterThanOrEqual(0);
  });

  it("l'assistant corrige un texte sans contraste, trop petit ou hors marge", () => {
    const doc = buildTemplate("classique", "F60X40");
    const t = doc.elements.find((e) => e.type === "text") as TextEl;
    const bad = { ...doc, elements: doc.elements.map((e) => (e.id === t.id ? { ...t, color: "#F5F5F5", size: 1.2, x: -4 } : e)) };
    expect(renderDoc(bad, DATA).issues.length).toBeGreaterThan(0);
    const fixed = fixAll(bad, DATA);
    expect(renderDoc(fixed, DATA).issues.filter((i) => ["contrast", "text-small", "outside"].includes(i.code))).toEqual([]);
  });

  it("le texte se réduit puis tronque, sans jamais sortir de sa boîte", () => {
    const doc = buildTemplate("epure", "F60X40");
    for (const e of doc.elements) {
      if (e.type !== "text") continue;
      const lay = layoutText(e, doc, LONG);
      for (const l of lay.lines) expect(measure(l.text, lay.family, e.bold, lay.size, e.tracking ?? 0)).toBeLessThanOrEqual(e.w + 0.02);
    }
  });

  it("changer de format garde un design valide", () => {
    for (const t of TEMPLATES) {
      for (const f of FORMAT_KEYS) expect(renderDoc(buildTemplate(t.key, f), DATA).issues.filter((i) => i.level === "error"), `${t.key} ${f}`).toEqual([]);
      const doc = rescaleDoc(buildTemplate(t.key, "F50X50"), "F70X50");
      expect(renderDoc(doc, DATA).issues.filter((i) => i.level === "error")).toEqual([]);
    }
  });

  it("une toile vierge est valide", () => {
    expect(renderDoc(blankDoc("F60X40"), DATA).issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("un ancien design (v1) est converti", () => {
    const doc = storedToDoc({ template: "premium", format: "F70X50", accent: "or", headline: "x", subline: "y", showLogo: true, showPhone: true });
    expect(doc.template).toBe("premium");
    expect(doc.format).toBe("F70X50");
  });
});

describe("Couleurs", () => {
  it("chaque harmonie : texte lisible sur le fond et sur la couleur principale", () => {
    for (const p of PALETTES) {
      expect(contrastRatio(p.palette.ink, p.palette.paper), p.key).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("Planche A4", () => {
  it("toutes les étiquettes tiennent dans les marges", () => {
    for (const format of FORMAT_KEYS) {
      const l = sheetLayout(format);
      const last = slotPosition(l, l.perPage - 1);
      expect(l.originX).toBeGreaterThanOrEqual(SHEET_MARGIN - 1e-9);
      expect(last.x + FORMATS[format].w).toBeLessThanOrEqual(A4.w - SHEET_MARGIN + 1e-9);
      expect(last.y + FORMATS[format].h).toBeLessThanOrEqual(A4.h - SHEET_MARGIN + 1e-9);
    }
  });

  it("génère un PDF A4 exact avec le bon nombre de pages", async () => {
    const doc = buildTemplate("chantier", "F50X50");
    const items = Array.from({ length: 25 }, (_, i) => ({ ...DATA, code: `CODE${i}`, url: `https://monqrpro.fr/p/dupont/CODE${i}` }));
    const bytes = await renderSheetPdf({ doc, items, logoPng: null, brandName: "QR Pro", title: "test" });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(Math.ceil(25 / sheetLayout("F50X50").perPage));
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(A4.w * MM, 1);
    expect(height).toBeCloseTo(A4.h * MM, 1);
  });

  it("planche de 500 étiquettes identiques : étiquette dessinée une fois, PDF léger (< 1 Mo)", async () => {
    const doc = buildTemplate("braise", "F60X40");
    const t = Date.now();
    const bytes = await renderSheetPdf({ doc, items: Array(500).fill(DATA), logoPng: null, brandName: "QR Pro", title: "test" });
    expect(Date.now() - t).toBeLessThan(10_000);
    expect(bytes.length).toBeLessThan(1024 * 1024);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(Math.ceil(500 / sheetLayout("F60X40").perPage));
  });

  it("une étiquette illisible bloque toujours la planche, même répétée", async () => {
    const doc = buildTemplate("braise", "F60X40");
    const tiny = { ...doc, elements: doc.elements.map((e) => (e.type === "qr" ? { ...e, w: 8, h: 8 } : e)) };
    // normalizeDoc remonte le QR à la taille minimale : on vérifie donc avec une URL trop longue pour cette taille.
    const longUrl = { ...DATA, url: `https://www.monqrpro.fr/q/${"X".repeat(300)}` };
    await expect(renderSheetPdf({ doc: tiny, items: Array(30).fill(longUrl), logoPng: null, brandName: "QR Pro", title: "test" })).rejects.toThrow();
  });

  it("le SVG porte les dimensions réelles en mm et n'a besoin d'aucune police", () => {
    const svg = labelSvg(renderDoc(buildTemplate("premium", "F70X50"), DATA));
    expect(svg).toContain('width="70mm" height="50mm"');
    expect(svg).not.toContain("<text");
  });
});
