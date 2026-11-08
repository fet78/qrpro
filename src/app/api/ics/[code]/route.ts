import { db } from "@/server/db";
import { appUrl } from "@/lib/env";
import { phoneFr } from "@/lib/format";
import { CODE_RE } from "@/lib/slug";

function esc(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

/**
 * Rappel d'entretien au format agenda (.ics : iPhone, Android, Outlook) : journée entière à la date
 * du prochain entretien, alerte 7 jours avant. Uniquement si le pro affiche cette installation.
 */
export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  if (!CODE_RE.test(code)) return new Response("Introuvable", { status: 404 });
  const qr = await db.qrCode.findUnique({
    where: { code },
    select: { showInstall: true, nextServiceAt: true, equipment: true, business: { select: { name: true, phone: true, slug: true, user: { select: { disabledAt: true } } } } },
  });
  if (!qr || !qr.showInstall || !qr.nextServiceAt || qr.business.user.disabledAt) return new Response("Introuvable", { status: 404 });
  const b = qr.business;
  const start = qr.nextServiceAt;
  const end = new Date(start.getTime() + 86400_000);
  const url = `${appUrl()}/p/${b.slug}/${code}`;
  const title = `Entretien ${qr.equipment || "de mon installation"} — ${b.name}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//QR Pro//Rappel entretien//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:entretien-${code}-${ymd(start)}@qrpro`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${ymd(start)}`,
    `DTEND;VALUE=DATE:${ymd(end)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(`Prendre rendez-vous avec ${b.name}${b.phone ? ` au ${phoneFr(b.phone)}` : ""}.\n${url}`)}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "TRIGGER:-P7D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="rappel-entretien-${code}.ics"` },
  });
}
