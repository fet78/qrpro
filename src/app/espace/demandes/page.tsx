import Link from "next/link";
import { Inbox, Paperclip, MapPin, Siren, ChevronRight, BellRing } from "lucide-react";
import { clsx } from "clsx";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { PageHeader, Card, EmptyState, Badge, Notice, LinkButton } from "@/components/ui";
import { dateFr, phoneFr } from "@/lib/format";
import { REQUEST_STATUS, OPEN_STATUSES, kindLabel, isUrgent, type RequestStatus } from "@/lib/page/requests";
import type { Prisma } from "@/generated/prisma/client";
import { emailUsage } from "@/server/email-quota";
import { parsePrefs } from "@/lib/notify/prefs";

export const metadata = { title: "Demandes reçues" };
export const dynamic = "force-dynamic";

const TABS = [
  { key: "a-traiter", label: "À traiter", where: { status: { in: OPEN_STATUSES } } },
  { key: "planifiees", label: "Planifiées", where: { status: "planifiee" } },
  { key: "terminees", label: "Terminées", where: { status: { in: ["terminee", "annulee"] } } },
  { key: "toutes", label: "Toutes", where: {} },
] as const;

function ago(d: Date): string {
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return dateFr(d);
}

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ vue?: string; q?: string; supprimee?: string }> }) {
  const user = await requirePro();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.vue) ?? TABS[0];
  const q = (sp.q ?? "").trim().slice(0, 60);
  const base: Prisma.InterventionRequestWhereInput = { businessId: user.businessId };
  const search: Prisma.InterventionRequestWhereInput = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { city: { contains: q, mode: "insensitive" } }, { message: { contains: q, mode: "insensitive" } }] }
    : {};
  const [requests, counts, unread, prefsRow, usage] = await Promise.all([
    db.interventionRequest.findMany({
      where: { ...base, ...(tab.where as Prisma.InterventionRequestWhereInput), ...search },
      // Urgences non traitées d'abord, puis les plus récentes.
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      include: { _count: { select: { photos: true } } },
    }),
    db.interventionRequest.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    db.interventionRequest.count({ where: { ...base, readAt: null } }),
    db.business.findUniqueOrThrow({ where: { id: user.businessId }, select: { notify: true, _count: { select: { pushSubscriptions: true } } } }),
    emailUsage(),
  ]);
  const count = (statuses: readonly string[]) => counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count._all, 0);
  const tabCount: Record<string, number> = {
    "a-traiter": count(OPEN_STATUSES),
    planifiees: count(["planifiee"]),
    terminees: count(["terminee", "annulee"]),
    toutes: counts.reduce((s, c) => s + c._count._all, 0),
  };
  const sorted = [...requests].sort((a, b) => Number(isUrgent(b) && b.status === "nouvelle") - Number(isUrgent(a) && a.status === "nouvelle"));
  const noDevice = prefsRow._count.pushSubscriptions === 0;

  return (
    <>
      <PageHeader
        title="Demandes reçues"
        description={unread ? `${unread} demande${unread > 1 ? "s" : ""} non lue${unread > 1 ? "s" : ""}.` : "Les demandes envoyées depuis votre page et vos étiquettes."}
        action={<LinkButton href="/espace/notifications" variant="secondary"><BellRing className="h-4 w-4" /> Notifications</LinkButton>}
      />
      {sp.supprimee ? <Notice tone="success" className="mb-4">Demande supprimée définitivement, avec ses pièces jointes.</Notice> : null}
      {noDevice ? (
        <Notice className="mb-4">
          Soyez prévenu en quelques secondes, gratuitement : <Link href="/espace/notifications" className="link">activez les notifications sur votre téléphone</Link>. En attendant, vous êtes prévenu par email.
        </Notice>
      ) : null}
      {usage.notificationsBlocked && parsePrefs(prefsRow.notify).email.on ? (
        <Notice tone="warn" className="mb-4">
          Emails de notification en pause : la limite gratuite de la plateforme est atteinte (reprise automatique demain ou le mois prochain). Vos demandes arrivent toujours ici{noDevice ? "" : " et sur votre téléphone"}.
        </Notice>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 overflow-x-auto rounded-xl bg-surface p-1 ring-1 ring-line" aria-label="Filtrer les demandes">
          {TABS.map((t) => (
            <Link key={t.key} href={`/espace/demandes?vue=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={clsx("flex-none rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition", t.key === tab.key ? "bg-ink text-white" : "text-muted hover:text-ink")}>
              {t.label} <span className={clsx("ml-1 tabular-nums", t.key === tab.key ? "text-white/70" : "text-faint")}>{tabCount[t.key]}</span>
            </Link>
          ))}
        </nav>
        <form className="w-full sm:w-64" role="search">
          <input type="hidden" name="vue" value={tab.key} />
          <input name="q" defaultValue={q} placeholder="Nom, téléphone, ville…" className="input h-10 py-2 text-[14px]" aria-label="Rechercher une demande" />
        </form>
      </div>

      {sorted.length ? (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {sorted.map((r) => {
              const st = REQUEST_STATUS[r.status as RequestStatus] ?? REQUEST_STATUS.nouvelle;
              const urgent = isUrgent(r) && OPEN_STATUSES.includes(r.status as RequestStatus);
              return (
                <li key={r.id}>
                  <Link href={`/espace/demandes/${r.id}`} className={clsx("flex items-start gap-3 px-4 py-4 transition hover:bg-canvas sm:px-6", urgent && "bg-danger-soft/40")} data-request={r.id}>
                    <span className={clsx("mt-1.5 h-2.5 w-2.5 flex-none rounded-full", r.readAt ? "bg-transparent" : urgent ? "bg-danger" : "bg-brand")} aria-label={r.readAt ? undefined : "Non lue"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={clsx("text-[15px]", r.readAt ? "font-medium" : "font-semibold")}>{r.name}</span>
                        {urgent ? <Badge tone="danger"><Siren className="mr-1 inline h-3 w-3" />Urgent</Badge> : null}
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <span className="text-[12.5px] text-muted">{kindLabel(r.kind)}{r.problem ? ` · ${r.problem}` : ""}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[14px] text-ink/80">{r.message}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
                        <span>{phoneFr(r.phone)}</span>
                        {r.city ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[r.postalCode, r.city].filter(Boolean).join(" ")}</span> : null}
                        {r._count.photos ? <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />{r._count.photos}</span> : null}
                        {r.status === "planifiee" && r.scheduledAt ? <span className="font-medium text-brand">RDV {dateFr(r.scheduledAt, true)}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-none items-center gap-1 text-[12.5px] text-muted">
                      <span className="hidden sm:inline">{ago(r.createdAt)}</span>
                      <ChevronRight className="h-4 w-4 text-faint" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title={q ? "Aucune demande ne correspond" : tab.key === "a-traiter" ? "Rien à traiter pour le moment" : "Aucune demande"}
            description="Quand un client remplit le formulaire de votre page, sa demande arrive ici et vous êtes prévenu selon vos préférences de notification."
          />
        </Card>
      )}
    </>
  );
}
