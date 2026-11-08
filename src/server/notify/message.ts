import "server-only";
import { kindLabel, urgencyLabel, isUrgent, REQUEST_CONTACT } from "@/lib/page/requests";
import { phoneFr } from "@/lib/format";
import { signedFileUrl, requestLink } from "./signed";

/** Données d'une demande nécessaires aux notifications. */
export interface RequestForNotif {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  kind: string;
  urgency: string;
  problem: string;
  message: string;
  availability: string;
  contactPref: string;
  createdAt: Date;
  files: { id: string; mime: string; name: string }[];
  code?: { code: string; label: string; equipment: string } | null;
}

const when = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris" }).format(d);
const shortWhen = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(d);
const fullAddress = (r: RequestForNotif) => [r.address, [r.postalCode, r.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

export function headline(r: RequestForNotif): string {
  return `${isUrgent(r) ? "URGENT · " : ""}${kindLabel(r.kind)}${r.problem ? ` · ${r.problem}` : ""}`;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Email complet : tout pour rappeler le client sans ouvrir l'espace, pièces jointes par liens signés (7 jours). */
export function emailMessage(r: RequestForNotif, brand: string): { subject: string; text: string; html: string } {
  const link = requestLink(r.id);
  const addr = fullAddress(r);
  const urgent = isUrgent(r);
  const maps = addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}` : "";
  const files = r.files.map((f, i) => ({ ...f, url: signedFileUrl(f.id), label: f.mime === "application/pdf" ? f.name || `Document ${i + 1}` : `Photo ${i + 1}` }));
  const rows: [string, string][] = [
    ["Client", r.name],
    ["Téléphone", phoneFr(r.phone)],
    ...(r.email ? [["Email", r.email] as [string, string]] : []),
    ...(addr ? [["Adresse", addr] as [string, string]] : []),
    ["Type", kindLabel(r.kind) + (r.problem ? ` — ${r.problem}` : "")],
    ...(urgencyLabel(r.urgency) && r.kind !== "contact" ? [["Urgence", urgencyLabel(r.urgency)] as [string, string]] : []),
    ...(r.availability ? [["Disponibilités", r.availability] as [string, string]] : []),
    ["À recontacter par", REQUEST_CONTACT[r.contactPref as keyof typeof REQUEST_CONTACT] ?? "Appel"],
    ["Reçue le", when(r.createdAt)],
    ...(r.code ? [["Étiquette", `${r.code.code}${r.code.equipment ? ` — ${r.code.equipment}` : ""}`] as [string, string]] : []),
  ];
  const subject = `${urgent ? "🔴 URGENT — " : ""}${kindLabel(r.kind)} de ${r.name}${r.city ? ` (${r.city})` : ""}`;
  const text = [
    `${headline(r)}`,
    "",
    ...rows.map(([k, v]) => `${k} : ${v}`),
    "",
    "Description :",
    r.message,
    ...(files.length ? ["", "Pièces jointes (liens valables 7 jours) :", ...files.map((f) => `- ${f.label} : ${f.url}`)] : []),
    "",
    `Voir et gérer la demande : ${link}`,
  ].join("\n");

  const btn = (href: string, label: string, bg: string) => `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:#fff;text-decoration:none;font-weight:600;padding:11px 16px;border-radius:10px;margin:0 8px 8px 0;font-size:14px">${esc(label)}</a>`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#0F172A;max-width:600px;margin:0 auto;padding:20px">
<div style="font-weight:700;font-size:15px;color:#64748B;margin-bottom:14px">${esc(brand)} · nouvelle demande</div>
${urgent ? `<div style="background:#FEE2E2;color:#B91C1C;font-weight:700;padding:10px 14px;border-radius:10px;margin-bottom:14px">Urgence signalée par le client</div>` : ""}
<h1 style="font-size:21px;margin:0 0 4px">${esc(r.name)}</h1>
<div style="color:#475569;margin-bottom:16px">${esc(headline(r))}</div>
<div>${btn(`tel:${r.phone.replace(/[^\d+]/g, "")}`, `Appeler ${phoneFr(r.phone)}`, "#16A34A")}${btn(link, "Ouvrir la demande", "#1D4ED8")}${maps ? btn(maps, "Itinéraire", "#334155") : ""}</div>
<table style="width:100%;border-collapse:collapse;margin:14px 0">${rows.map(([k, v]) => `<tr><td style="padding:7px 0;color:#64748B;width:150px;vertical-align:top;border-bottom:1px solid #E2E8F0">${esc(k)}</td><td style="padding:7px 0;border-bottom:1px solid #E2E8F0">${esc(v)}</td></tr>`).join("")}</table>
<div style="font-weight:600;margin:16px 0 6px">Description</div>
<div style="white-space:pre-line;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px">${esc(r.message)}</div>
${files.length ? `<div style="font-weight:600;margin:18px 0 8px">Pièces jointes</div><div>${files.map((f) => (f.mime === "application/pdf" ? `<a href="${esc(f.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 12px;border:1px solid #CBD5E1;border-radius:10px;color:#1D4ED8;text-decoration:none">📄 ${esc(f.label)}</a>` : `<a href="${esc(f.url)}" style="display:inline-block;margin:0 8px 8px 0"><img src="${esc(f.url)}" alt="${esc(f.label)}" width="160" style="width:160px;height:120px;object-fit:cover;border-radius:10px;border:1px solid #E2E8F0"></a>`)).join("")}</div><div style="font-size:12px;color:#94A3B8">Liens personnels valables 7 jours. Ensuite, retrouvez-les dans votre espace.</div>` : ""}
<p style="font-size:12px;color:#94A3B8;margin-top:22px">Vous recevez cet email parce que vous avez activé les notifications email dans votre espace ${esc(brand)} (Notifications). Ne transférez pas ce message : il contient des données personnelles de votre client.</p>
</div>`;
  return { subject, text, html };
}

/** Notification web : courte, avec lien direct vers la demande. */
export function pushPayload(r: RequestForNotif) {
  return {
    title: `${isUrgent(r) ? "🔴 " : ""}${kindLabel(r.kind)} — ${r.name}`,
    body: [r.problem, [r.postalCode, r.city].filter(Boolean).join(" "), phoneFr(r.phone), `reçue ${shortWhen(r.createdAt)}`].filter(Boolean).join(" · "),
    url: `/espace/demandes/${r.id}`,
    tag: `demande-${r.id}`,
    urgent: isUrgent(r),
  };
}
