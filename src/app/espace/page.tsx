import Link from "next/link";
import { ArrowRight, Check, Globe, Palette, QrCode, ScanLine, Inbox, Eye, Phone, MessageCircle, Navigation, UserPlus, Share2, Star } from "lucide-react";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { appUrl } from "@/lib/env";
import { getSettings } from "@/server/settings";
import { PageHeader, Stat, Card, CardHeader, LinkButton, Notice, Badge } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { dateFr, euros, orderNumber, plural } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/orders";
import { REQUEST_STATUS, type RequestStatus } from "@/lib/page/requests";

export const metadata = { title: "Tableau de bord" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const user = await requirePro();
  const { bienvenue } = await searchParams;
  const id = user.businessId;
  const since = new Date(Date.now() - 30 * 86400_000);
  const [b, design, codes, scans, pending, orders, lastRequests, activity, s] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id }, select: { name: true, slug: true, phone: true, activatedAt: true, description: true } }),
    db.labelDesign.findUnique({ where: { businessId: id }, select: { validatedAt: true } }),
    db.qrCode.count({ where: { businessId: id } }),
    db.qrCode.aggregate({ where: { businessId: id }, _sum: { scanCount: true } }),
    db.interventionRequest.count({ where: { businessId: id, status: { in: ["nouvelle", "en_cours", "planifiee"] } } }),
    db.order.findMany({ where: { businessId: id, status: { not: "EN_ATTENTE_PAIEMENT" } }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.interventionRequest.findMany({ where: { businessId: id }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.pageEvent.groupBy({ by: ["action"], where: { businessId: id, createdAt: { gte: since } }, _count: { _all: true } }),
    getSettings(),
  ]);
  void codes;
  const count = (a: string) => activity.find((x) => x.action === a)?._count._all ?? 0;
  const ACTIVITY = [
    { key: "view", label: "Visites de la page", icon: Eye },
    { key: "call", label: "Appels lancés", icon: Phone },
    { key: "request", label: "Demandes envoyées", icon: Inbox },
    { key: "whatsapp", label: "Messages WhatsApp", icon: MessageCircle },
    { key: "directions", label: "Itinéraires", icon: Navigation },
    { key: "save", label: "Contacts enregistrés", icon: UserPlus },
    { key: "share", label: "Partages", icon: Share2 },
    { key: "review", label: "Clics vers vos avis Google", icon: Star },
  ];
  const pageUrl = `${appUrl()}/p/${b.slug}`;

  const steps = [
    { done: !!b.phone, title: "Complétez votre page", text: "Téléphone, services, horaires : ce que vos clients verront après le scan.", href: "/espace/page", icon: Globe },
    { done: !!design?.validatedAt, title: "Choisissez votre étiquette", text: "Modèle, couleur, format : l'aperçu se met à jour en direct.", href: "/espace/etiquette", icon: Palette },
    { done: !!b.activatedAt, title: "Activez l'offre QR Pro", text: `${euros(s.digitalPriceCents)}, une seule fois : page en ligne, QR permanent, impressions illimitées.`, href: "/espace/commander", icon: QrCode },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <>
      <PageHeader
        eyebrow={bienvenue ? "Bienvenue" : undefined}
        title={bienvenue ? `Votre compte est prêt` : `Bonjour, ${b.name}`}
        description={remaining ? `Encore ${plural(remaining, "étape", "étapes")} avant de coller vos premières étiquettes.` : "Tout est en place. Vos clients vous retrouvent en un scan."}
        action={<LinkButton href={`/p/${b.slug}`} target="_blank" variant="secondary">Voir ma page</LinkButton>}
      />

      {remaining ? (
        <Card className="mb-6 overflow-hidden">
          <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
            {steps.map((s, i) => (
              <Link key={s.href} href={s.href} className="group flex gap-4 p-5 transition hover:bg-canvas sm:p-6">
                <div className={`grid h-9 w-9 flex-none place-items-center rounded-full text-[14px] font-semibold ${s.done ? "bg-success-soft text-success" : "bg-brand-soft text-brand"}`}>
                  {s.done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div className="min-w-0">
                  <div className={`text-[15px] font-semibold ${s.done ? "text-muted line-through decoration-faint" : ""}`}>{s.title}</div>
                  <p className="mt-1 text-[13.5px] leading-snug text-muted">{s.text}</p>
                  {!s.done ? <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-brand">Commencer <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span> : null}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Offre QR Pro" value={b.activatedAt ? "Active" : "Essai"} hint={b.activatedAt ? <Link href="/espace/codes" className="link">Mes fichiers à imprimer</Link> : <Link href="/espace/commander" className="link">Activer ({euros(s.digitalPriceCents)})</Link>} />
        <Stat label="Commandes" value={orders.length} hint={<Link href="/espace/commander" className="link">Étiquettes imprimées</Link>} />
        <Stat label="Scans" value={scans._sum.scanCount ?? 0} hint="Hors vos propres scans" />
        <Stat label="Demandes à traiter" value={pending} hint={<Link href="/espace/demandes" className="link">Voir les demandes</Link>} />
      </div>

      <Card className="mb-6">
        <CardHeader title="Activité de votre page" description="30 derniers jours · comptage anonyme, sans vos propres visites." action={<Link href="/espace/page" className="link text-[13px]">Personnaliser ma page</Link>} />
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
          {ACTIVITY.map(({ key, label, icon: Icon }) => (
            <div key={key} className="bg-surface px-5 py-4">
              <div className="flex items-center gap-2 text-[12.5px] text-muted"><Icon className="h-3.5 w-3.5" /> {label}</div>
              <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight">{count(key)}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Adresse de votre page" description={b.activatedAt ? "En ligne : c'est la page ouverte par votre QR code." : "Visible par vous seul jusqu'à l'activation de l'offre QR Pro."} />
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2.5">
              <ScanLine className="h-4 w-4 flex-none text-brand" />
              <code className="min-w-0 flex-1 truncate text-[13.5px]">{pageUrl}</code>
              <CopyButton value={pageUrl} />
            </div>
            <Notice className="mt-4">
              Votre QR code mène toujours à cette page. Modifiez-la quand vous voulez : les étiquettes déjà posées restent valables, sans rien réimprimer.
            </Notice>
          </div>
        </Card>

        <Card>
          <CardHeader title="Dernières demandes" action={<Link href="/espace/demandes" className="link text-[13px]">Tout voir</Link>} />
          {lastRequests.length ? (
            <ul className="divide-y divide-line">
              {lastRequests.map((r) => (
                <li key={r.id}><Link href={`/espace/demandes/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas sm:px-6">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">{r.name}</div>
                    <div className="truncate text-[13px] text-muted">{r.message}</div>
                  </div>
                  <Badge tone={REQUEST_STATUS[r.status as RequestStatus]?.tone ?? "info"}>{REQUEST_STATUS[r.status as RequestStatus]?.label ?? "Nouvelle"}</Badge>
                </Link></li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 px-5 py-6 text-[14px] text-muted sm:px-6">
              <Inbox className="h-5 w-5 text-faint" /> Les demandes envoyées depuis votre page arriveront ici et par email.
            </div>
          )}
        </Card>
      </div>

      {orders.length ? (
        <Card className="mt-6">
          <CardHeader title="Commandes récentes" action={<Link href="/espace/commandes" className="link text-[13px]">Toutes les commandes</Link>} />
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/espace/commandes/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas sm:px-6">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium">{o.itemLabel}</div>
                    <div className="text-[13px] text-muted">{orderNumber(o.number)} · {dateFr(o.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden text-[14px] tabular-nums sm:inline">{euros(o.totalCents)}</span>
                    <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
