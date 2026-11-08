import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, MessageSquareText, MessageCircle, Mail, Navigation, FileText, Clock, MapPin, Siren, Trash2, CheckCircle2, AlertTriangle, MinusCircle, Loader2, QrCode } from "lucide-react";
import { clsx } from "clsx";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { PageHeader, Card, CardHeader, Badge, Button } from "@/components/ui";
import { dateFr, phoneFr, telHref } from "@/lib/format";
import { whatsappLink } from "@/lib/page/config";
import { REQUEST_STATUS, REQUEST_CONTACT, kindLabel, urgencyLabel, isUrgent, type RequestStatus } from "@/lib/page/requests";
import { CHANNEL_INFO, type LogChannel } from "@/lib/notify/prefs";
import { ManageRequest } from "./manage";
import { deleteRequest } from "../actions";

export const metadata = { title: "Demande" };
export const dynamic = "force-dynamic";

const LOG_STATUS: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  envoye: { label: "Envoyé", icon: CheckCircle2, cls: "text-success" },
  en_attente: { label: "En attente", icon: Loader2, cls: "text-muted" },
  envoi: { label: "Envoi en cours", icon: Loader2, cls: "text-muted" },
  echec: { label: "Échec", icon: AlertTriangle, cls: "text-danger" },
  ignore: { label: "Non envoyé", icon: MinusCircle, cls: "text-muted" },
};

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePro();
  const { id } = await params;
  const r = await db.interventionRequest.findFirst({
    where: { id, businessId: user.businessId },
    include: {
      photos: { select: { id: true, mime: true, name: true, size: true }, orderBy: { createdAt: "asc" } },
      notifications: { orderBy: { createdAt: "asc" } },
      qrCode: { select: { id: true, code: true, label: true, equipment: true, main: true } },
      business: { select: { name: true } },
    },
  });
  if (!r) notFound();
  if (!r.readAt) await db.interventionRequest.update({ where: { id }, data: { readAt: new Date() } });

  const st = REQUEST_STATUS[r.status as RequestStatus] ?? REQUEST_STATUS.nouvelle;
  const urgent = isUrgent(r);
  const addr = [r.address, [r.postalCode, r.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const firstName = r.name.split(/\s+/)[0] ?? "";
  const replyText = `Bonjour ${firstName}, ${r.business.name} a bien reçu votre demande. `;
  const wa = whatsappLink(r.phone, replyText);
  const smsHref = `sms:${r.phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(replyText)}`;
  const photos = r.photos.filter((f) => f.mime !== "application/pdf");
  const docs = r.photos.filter((f) => f.mime === "application/pdf");
  const contacts = [
    { href: telHref(r.phone), label: "Appeler", icon: Phone, primary: true },
    { href: smsHref, label: "SMS", icon: MessageSquareText },
    ...(wa ? [{ href: wa, label: "WhatsApp", icon: MessageCircle, external: true }] : []),
    ...(r.email ? [{ href: `mailto:${r.email}?subject=${encodeURIComponent(`Votre demande — ${r.business.name}`)}`, label: "Email", icon: Mail }] : []),
    ...(addr ? [{ href: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`, label: "Itinéraire", icon: Navigation, external: true }] : []),
  ];

  return (
    <>
      <Link href="/espace/demandes" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Demandes</Link>
      <PageHeader
        title={r.name}
        description={`${kindLabel(r.kind)}${r.problem ? ` · ${r.problem}` : ""} · reçue le ${dateFr(r.createdAt, true)}`}
        action={
          <span className="flex flex-wrap gap-2">
            {urgent ? <Badge tone="danger" className="text-[13px]"><Siren className="mr-1 inline h-3.5 w-3.5" />Urgent</Badge> : null}
            <Badge tone={st.tone} className="text-[13px]">{st.label}</Badge>
          </span>
        }
      />

      {/* Contacter le client en un geste (gros boutons, pensés pour le téléphone) */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {contacts.map((c) => (
          <a
            key={c.label}
            href={c.href}
            {...("external" in c && c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className={clsx("flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-3 text-[13px] font-semibold transition sm:flex-row sm:gap-2 sm:py-2.5 sm:text-[14px]", "primary" in c && c.primary ? "col-span-3 bg-success text-white hover:brightness-110 sm:col-span-1" : "bg-surface ring-1 ring-line hover:bg-canvas")}
          >
            <c.icon className="h-5 w-5 sm:h-4 sm:w-4" />
            {"primary" in c && c.primary ? `${c.label} · ${phoneFr(r.phone)}` : c.label}
          </a>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="La demande" />
            <div className="space-y-5 p-5 sm:p-6">
              <p className="whitespace-pre-line text-[15px] leading-relaxed">{r.message}</p>
              <dl className="grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
                <Info label="Téléphone"><a href={telHref(r.phone)} className="font-medium text-brand">{phoneFr(r.phone)}</a></Info>
                {r.email ? <Info label="Email"><a href={`mailto:${r.email}`} className="link">{r.email}</a></Info> : null}
                {addr ? <Info label="Adresse" icon={MapPin}>{addr}</Info> : null}
                {r.kind !== "contact" && urgencyLabel(r.urgency) ? <Info label="Urgence"><span className={clsx(urgent && "font-semibold text-danger")}>{urgencyLabel(r.urgency)}</span></Info> : null}
                {r.availability ? <Info label="Disponibilités" icon={Clock}>{r.availability}</Info> : null}
                <Info label="À recontacter par">{REQUEST_CONTACT[r.contactPref as keyof typeof REQUEST_CONTACT] ?? "Appel"}</Info>
                {r.qrCode && !r.qrCode.main ? (
                  <Info label="Étiquette" icon={QrCode}><Link href={`/espace/codes/${r.qrCode.id}`} className="link font-mono">{r.qrCode.code}</Link>{r.qrCode.equipment ? ` · ${r.qrCode.equipment}` : ""}</Info>
                ) : r.qrCode ? <Info label="Origine" icon={QrCode}>Scan de votre QR code</Info> : <Info label="Origine">Votre page</Info>}
              </dl>
            </div>
          </Card>

          {r.photos.length ? (
            <Card>
              <CardHeader title={`Pièces jointes (${r.photos.length})`} description="Visibles uniquement par vous." />
              <div className="p-5 sm:p-6">
                {photos.length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {photos.map((f, i) => (
                      <a key={f.id} href={`/api/requests/photos/${f.id}`} target="_blank" className="block aspect-[4/3] overflow-hidden rounded-xl border border-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/requests/photos/${f.id}`} alt={`Photo ${i + 1} envoyée par ${r.name}`} className="h-full w-full object-cover transition hover:scale-105" />
                      </a>
                    ))}
                  </div>
                ) : null}
                {docs.length ? (
                  <ul className={clsx("space-y-2", photos.length && "mt-4")}>
                    {docs.map((f) => (
                      <li key={f.id}>
                        <a href={`/api/requests/photos/${f.id}`} target="_blank" className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-[14px] hover:bg-canvas">
                          <FileText className="h-5 w-5 flex-none text-danger" />
                          <span className="min-w-0 flex-1 truncate">{f.name || "Document.pdf"}</span>
                          <span className="text-[12.5px] text-muted">{Math.max(1, Math.round(f.size / 1024))} Ko</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Suivi" />
            <ManageRequest id={r.id} status={r.status} scheduledAt={r.scheduledAt ? r.scheduledAt.toISOString() : ""} note={r.note} />
          </Card>

          <Card>
            <CardHeader title="Notifications envoyées" description="Comment vous avez été prévenu de cette demande." />
            <ul className="divide-y divide-line">
              {r.notifications.map((n) => {
                const s = LOG_STATUS[n.status] ?? LOG_STATUS.en_attente!;
                return (
                  <li key={n.id} className="px-5 py-3 text-[13.5px] sm:px-6">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{CHANNEL_INFO[n.channel as LogChannel]?.label ?? n.channel}</span>
                      <span className={clsx("inline-flex items-center gap-1.5", s.cls)}><s.icon className="h-4 w-4" />{s.label}</span>
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-muted">
                      {n.recipient && n.recipient !== "appareils" ? `${n.recipient} · ` : ""}
                      {n.sentAt ? dateFr(n.sentAt, true) : n.attempts ? `${n.attempts} tentative${n.attempts > 1 ? "s" : ""}` : ""}
                      {n.providerId && n.channel === "push" ? ` · ${n.providerId}` : ""}
                    </div>
                    {n.lastError && n.status !== "envoye" ? <div className="mt-0.5 text-[12.5px] text-muted">{n.lastError}</div> : null}
                  </li>
                );
              })}
              {r.notifications.length === 0 ? <li className="px-6 py-4 text-[13.5px] text-muted">Demande antérieure aux notifications multicanal.</li> : null}
            </ul>
            <div className="border-t border-line px-5 py-3 text-[12.5px] sm:px-6"><Link href="/espace/notifications" className="link">Régler mes notifications</Link></div>
          </Card>

          <form action={deleteRequest} className="text-center">
            <input type="hidden" name="id" value={r.id} />
            <Button variant="ghost" size="sm" className="text-danger"><Trash2 className="h-4 w-4" /> Supprimer définitivement cette demande</Button>
          </form>
        </div>
      </div>
    </>
  );
}

function Info({ label, children, icon: Icon }: { label: string; children: React.ReactNode; icon?: typeof Clock }) {
  return (
    <div>
      <dt className="text-[12px] font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 flex items-start gap-1.5">{Icon ? <Icon className="mt-0.5 h-4 w-4 flex-none text-faint" /> : null}<span>{children}</span></dd>
    </div>
  );
}
