import { db } from "@/server/db";
import { appUrl } from "@/lib/env";
import { parsePageConfig } from "@/lib/page/config";

function esc(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/** Repli des lignes vCard (RFC 6350), indispensable pour la photo en base64. */
function fold(line: string): string {
  const out: string[] = [];
  for (let i = 0; i < line.length; i += 74) out.push((i ? " " : "") + line.slice(i, i + 74));
  return out.join("\r\n");
}

/** Fiche contact (.vcf) : le client enregistre le professionnel, logo compris, en un geste. */
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await db.business.findUnique({
    where: { slug },
    select: {
      name: true, trade: true, phone: true, email: true, address: true, postalCode: true, city: true, website: true, logo: true, page: true,
      services: { select: { title: true }, orderBy: { position: "asc" }, take: 6 },
      user: { select: { disabledAt: true } },
    },
  });
  if (!b || b.user.disabledAt) return new Response("Introuvable", { status: 404 });
  const cfg = parsePageConfig(b.page);
  const services = b.services.map((s) => s.title).join(", ");
  const digits = (v: string) => v.replace(/[^\d+]/g, "");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(b.name)}`,
    `ORG:${esc(b.name)}`,
    b.trade ? `TITLE:${esc(b.trade)}` : "",
    b.phone ? `TEL;TYPE=WORK,VOICE:${digits(b.phone)}` : "",
    cfg.whatsapp && digits(cfg.whatsapp) !== digits(b.phone) ? `TEL;TYPE=CELL:${digits(cfg.whatsapp)}` : "",
    b.email ? `EMAIL;TYPE=WORK:${esc(b.email)}` : "",
    b.address || b.city ? `ADR;TYPE=WORK:;;${esc(b.address)};${esc(b.city)};;${esc(b.postalCode)};France` : "",
    `URL:${appUrl()}/p/${slug}`,
    services ? `NOTE:${esc(`Services : ${services}`)}` : "",
    b.logo ? fold(`PHOTO;ENCODING=b;TYPE=PNG:${Buffer.from(b.logo).toString("base64")}`) : "",
    "END:VCARD",
  ].filter(Boolean);
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.vcf"` },
  });
}
