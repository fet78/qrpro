import Link from "next/link";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/session";
import { PageHeader, Stat, Card, CardHeader, Badge } from "@/components/ui";
import { dateFr, euros, orderNumber } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/orders";

export const metadata = { title: "Administration" };

const PAID = ["RECUE", "EN_ATTENTE_VALIDATION", "EN_IMPRESSION", "EXPEDIEE", "LIVREE", "TERMINEE"] as const;

export default async function AdminHome() {
  await requireAdmin();
  const since = new Date(Date.now() - 30 * 86400_000);
  const [revenue, revenue30, ordersPaid, digital, print, clients, clients30, codes, scans, toProcess, recentOrders, recentClients] = await Promise.all([
    db.order.aggregate({ where: { status: { in: [...PAID] } }, _sum: { totalCents: true } }),
    db.order.aggregate({ where: { status: { in: [...PAID] }, paidAt: { gte: since } }, _sum: { totalCents: true } }),
    db.order.count({ where: { status: { in: [...PAID] } } }),
    db.order.aggregate({ where: { status: { in: [...PAID] }, kind: { in: ["ACTIVATION", "DIGITAL_PACK"] } }, _sum: { totalCents: true }, _count: true }),
    db.order.aggregate({ where: { status: { in: [...PAID] }, kind: "PRINT" }, _sum: { totalCents: true, shippingCents: true, quantity: true }, _count: true }),
    db.user.count({ where: { role: "PRO" } }),
    db.user.count({ where: { role: "PRO", createdAt: { gte: since } } }),
    db.business.count({ where: { activatedAt: { not: null } } }),
    db.qrCode.aggregate({ _sum: { scanCount: true } }),
    db.order.findMany({ where: { kind: "PRINT", status: { in: ["RECUE", "EN_ATTENTE_VALIDATION", "EN_IMPRESSION"] } }, orderBy: { paidAt: "asc" }, take: 10 }),
    db.order.findMany({ where: { status: { not: "EN_ATTENTE_PAIEMENT" } }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.user.findMany({ where: { role: "PRO" }, orderBy: { createdAt: "desc" }, take: 6, include: { business: { select: { id: true, name: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Vue d'ensemble" description="Chiffres réels, calculés sur les commandes payées." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Chiffre d'affaires TTC" value={euros(revenue._sum.totalCents ?? 0)} hint={`${euros(revenue30._sum.totalCents ?? 0)} sur 30 jours`} />
        <Stat label="Commandes payées" value={ordersPaid} hint={`${digital._count} offres seules · ${print._count} impressions`} />
        <Stat label="Clients" value={clients} hint={`+${clients30} sur 30 jours`} />
        <Stat label="Offres actives" value={codes} hint={`${clients ? Math.round((codes / clients) * 100) : 0} % des comptes · ${scans._sum.scanCount ?? 0} scans`} />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="CA offres numériques seules" value={euros(digital._sum.totalCents ?? 0)} />
        <Stat label="CA commandes imprimées (livraison incluse)" value={euros(print._sum.totalCents ?? 0)} hint={`${print._sum.quantity ?? 0} étiquettes vendues`} />
        <Stat label="Livraison facturée" value={euros(print._sum.shippingCents ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Impressions à traiter" description="Commandes payées, pas encore expédiées." action={<Link href="/admin/commandes?filtre=a-traiter" className="link text-[13px]">Tout voir</Link>} />
          {toProcess.length ? (
            <ul className="divide-y divide-line">
              {toProcess.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/commandes/${o.id}`} className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-canvas">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">{o.customerName}</div>
                      <div className="text-[13px] text-muted">{orderNumber(o.number)} · {o.itemLabel}</div>
                    </div>
                    <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-6 text-[14px] text-muted">Rien à traiter.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Derniers clients" action={<Link href="/admin/clients" className="link text-[13px]">Tous les clients</Link>} />
          <ul className="divide-y divide-line">
            {recentClients.map((u) => (
              <li key={u.id}>
                <Link href={u.business ? `/admin/clients/${u.business.id}` : "/admin/clients"} className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-canvas">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">{u.business?.name ?? u.email}</div>
                    <div className="truncate text-[13px] text-muted">{u.email}</div>
                  </div>
                  <span className="text-[13px] text-muted">{dateFr(u.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Dernières commandes" action={<Link href="/admin/commandes" className="link text-[13px]">Toutes les commandes</Link>} />
        <ul className="divide-y divide-line">
          {recentOrders.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/commandes/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 hover:bg-canvas">
                <div className="min-w-0">
                  <div className="text-[14px] font-medium">{o.customerName} — {o.itemLabel}</div>
                  <div className="text-[13px] text-muted">{orderNumber(o.number)} · {dateFr(o.createdAt, true)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[14px] tabular-nums">{euros(o.totalCents)}</span>
                  <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                </div>
              </Link>
            </li>
          ))}
          {recentOrders.length === 0 ? <li className="px-6 py-6 text-[14px] text-muted">Aucune commande pour l&apos;instant.</li> : null}
        </ul>
      </Card>
    </>
  );
}
