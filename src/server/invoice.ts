import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { orderLines } from "@/server/orders";
import { orderNumber } from "@/lib/format";

const MM = 72 / 25.4;
const W = 210 * MM;
const H = 297 * MM;
const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.86, 0.87, 0.9);

/** Montant « 1 234,56 € » (espaces insécables remplacés : absents des polices standard PDF). */
function money(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100).replace(/[  ]/g, " ");
}
function dateLong(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(d);
}
/** Les polices standard (WinAnsi) ne couvrent pas tout l'Unicode : on remplace ce qui ne passerait pas. */
function safe(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[  ]/g, " ")
    .replace(/[^\x20-\x7E¡-ÿ€]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxPt: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of safe(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxPt && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export interface InvoiceOrder {
  number: number;
  invoiceNumber: string | null;
  paidAt: Date | null;
  paymentRef: string | null;
  lines: unknown;
  itemLabel: string;
  subtotalCents: number;
  shippingCents: number;
  shippingLabel: string;
  totalCents: number;
  customerEmail: string;
  customerName: string;
  billName: string;
  billLine1: string;
  billLine2: string;
  billPostal: string;
  billCity: string;
  billSiret: string;
}

export interface Seller {
  brandName: string;
  legalName: string;
  legalAddress: string;
  siret: string;
  contactEmail: string;
  contactPhone: string;
  vatMention: string;
}

/**
 * Facture PDF (A4) d'une commande payée. Mentions : vendeur (nom, adresse, SIRET), client, numéro
 * chronologique unique, date, désignations, quantités, prix, total, mention TVA, date et mode de règlement.
 */
export async function invoicePdf(o: InvoiceOrder, s: Seller): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Facture ${o.invoiceNumber}`);
  pdf.setProducer(s.brandName);
  const page = pdf.addPage([W, H]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const text = (p: PDFPage, t: string, x: number, y: number, opt: { size?: number; font?: PDFFont; color?: RGB; right?: boolean } = {}) => {
    const size = opt.size ?? 9.5;
    const font = opt.font ?? regular;
    const str = safe(t);
    const dx = opt.right ? font.widthOfTextAtSize(str, size) : 0;
    p.drawText(str, { x: x * MM - dx, y: H - y * MM, size, font, color: opt.color ?? INK });
  };
  const hr = (y: number) => page.drawLine({ start: { x: 18 * MM, y: H - y * MM }, end: { x: 192 * MM, y: H - y * MM }, thickness: 0.6, color: LINE });

  // Vendeur
  text(page, s.legalName || s.brandName, 18, 24, { size: 15, font: bold });
  let y = 30;
  for (const l of [s.legalName && s.legalName !== s.brandName ? s.brandName : "", s.legalAddress, s.siret ? `SIRET ${s.siret}` : "", [s.contactEmail, s.contactPhone].filter(Boolean).join(" · ")].filter(Boolean)) {
    text(page, l, 18, y, { size: 9, color: MUTED });
    y += 4.6;
  }
  text(page, "FACTURE", 192, 24, { size: 17, font: bold, right: true });
  text(page, `N° ${o.invoiceNumber}`, 192, 31, { size: 10.5, font: bold, right: true });
  text(page, `Date : ${o.paidAt ? dateLong(o.paidAt) : "-"}`, 192, 36.5, { size: 9.5, right: true, color: MUTED });
  text(page, `Commande ${orderNumber(o.number)}`, 192, 41.5, { size: 9.5, right: true, color: MUTED });

  // Client
  const top = Math.max(y, 50) + 6;
  text(page, "FACTURÉ À", 18, top, { size: 8.5, font: bold, color: MUTED });
  let cy = top + 6;
  [o.billName || o.customerName, o.billLine1, o.billLine2, [o.billPostal, o.billCity].filter(Boolean).join(" "), o.billSiret ? `SIRET ${o.billSiret}` : "", o.customerEmail]
    .filter(Boolean)
    .forEach((l, i) => {
      text(page, l, 18, cy, { size: 10, font: i === 0 ? bold : regular });
      cy += 5;
    });

  // Lignes
  let ty = cy + 10;
  hr(ty - 5);
  text(page, "Désignation", 18, ty, { size: 8.5, font: bold, color: MUTED });
  text(page, "Qté", 140, ty, { size: 8.5, font: bold, color: MUTED, right: true });
  text(page, "Prix unitaire", 166, ty, { size: 8.5, font: bold, color: MUTED, right: true });
  text(page, "Total", 192, ty, { size: 8.5, font: bold, color: MUTED, right: true });
  ty += 3;
  hr(ty);
  ty += 7;
  for (const l of orderLines(o)) {
    const labelLines = wrap(l.label, bold, 10, 105 * MM);
    labelLines.forEach((t, i) => text(page, t, 18, ty + i * 4.8, { size: 10, font: bold }));
    text(page, String(l.quantity), 140, ty, { size: 10, right: true });
    text(page, money(l.unitCents), 166, ty, { size: 10, right: true });
    text(page, money(l.totalCents), 192, ty, { size: 10, right: true });
    let ly = ty + labelLines.length * 4.8;
    if (l.detail) {
      for (const d of wrap(l.detail, regular, 8.5, 110 * MM)) {
        text(page, d, 18, ly, { size: 8.5, color: MUTED });
        ly += 4.2;
      }
    }
    ty = ly + 5;
    hr(ty - 2.5);
  }

  // Totaux
  const noVat = /non applicable/i.test(s.vatMention);
  ty += 6;
  if (noVat) {
    text(page, "Total HT", 166, ty, { size: 10, right: true, color: MUTED });
    text(page, money(o.totalCents), 192, ty, { size: 10, right: true });
    ty += 6;
    text(page, "TVA", 166, ty, { size: 10, right: true, color: MUTED });
    text(page, money(0), 192, ty, { size: 10, right: true });
    ty += 8;
  }
  text(page, "Total TTC payé", 166, ty, { size: 12, font: bold, right: true });
  text(page, money(o.totalCents), 192, ty, { size: 12, font: bold, right: true });

  // Mentions
  let my = ty + 18;
  for (const l of [
    s.vatMention,
    `Réglée le ${o.paidAt ? dateLong(o.paidAt) : "-"} par carte bancaire${o.paymentRef?.startsWith("SIMULATION") ? " (paiement simulé, environnement de test)" : ""}. Facture acquittée.`,
    "Pas d'escompte pour paiement anticipé. En cas de retard de paiement, indemnité forfaitaire pour frais de recouvrement : 40 € (art. L441-10 du Code de commerce).",
  ].filter(Boolean)) {
    for (const t of wrap(l, regular, 8.5, 174 * MM)) {
      text(page, t, 18, my, { size: 8.5, color: MUTED });
      my += 4.4;
    }
    my += 1.5;
  }
  if (!s.legalName || !s.siret || !s.legalAddress) {
    text(page, "Informations du vendeur incomplètes : à compléter dans Administration > Réglages.", 18, 285, { size: 8, color: rgb(0.8, 0.3, 0.1) });
  }
  return pdf.save();
}
