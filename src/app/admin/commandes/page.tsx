import Link from "next/link";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/session";
import { PageHeader, Card, Badge } from "@/components/ui";
import { dateFr, euros, orderNumber } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/orders";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Commandes" };

const FILTERS = {
  toutes: { label: "Toutes payées", where: { status: { notIn: ["EN_ATTENTE_PAIEMENT"] } } },
  "a-traiter": { label: "Impressions à traiter", where: { kind: "PRINT", status: { in: ["RECUE", "EN_ATTENTE_VALIDATION", "EN_IMPRESSION"] } } },
  expediees: { label: "Expédiées", where: { status: "EXPEDIEE" } },
  numeriques: { label: "Offres QR Pro seules", where: { kind: { in: ["ACTIVATION", "DIGITAL_PACK"] }, status: { notIn: ["EN_ATTENTE_PAIEMENT"] } } },
  impayees: { label: "Non payées", where: { status: "EN_ATTENTE_PAIEMENT" } },
} satisfies Record<string, { label: string; where: Prisma.OrderWhereInput }>;

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ filtre?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const key = (sp.filtre && sp.filtre in FILTERS ? sp.filtre : "toutes") as keyof typeof FILTERS;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const num = Number(q.replace(/\D/g, ""));
  const orders = await db.order.findMany({
    where: {
      ...FILTERS[key].where,
      ...(q ? { OR: [{ customerName: { contains: q, mode: "insensitive" } }, { customerEmail: { contains: q, mode: "insensitive" } }, ...(num ? [{ number: num }] : [])] } : {}),
    } as Prisma.OrderWhereInput,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader title="Commandes" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(FILTERS).map(([k, f]) => (
            <Link key={k} href={`/admin/commandes?filtre=${k}`} className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${k === key ? "bg-ink text-white" : "bg-surface text-muted shadow-card hover:text-ink"}`}>{f.label}</Link>
          ))}
        </div>
        <form>
          <input type="hidden" name="filtre" value={key} />
          <input name="q" defaultValue={q} placeholder="Client, email, n°" className="input h-9 w-56 py-1.5 text-[13.5px]" />
        </form>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[14px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] uppercase tracking-wider text-muted">
              <th className="px-5 py-3 font-medium">N°</th>
              <th className="px-3 py-3 font-medium">Client</th>
              <th className="px-3 py-3 font-medium">Article</th>
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="px-3 py-3 text-right font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-canvas">
                <td className="px-5 py-3"><Link href={`/admin/commandes/${o.id}`} className="link font-mono text-[13px]">{orderNumber(o.number)}</Link></td>
                <td className="px-3 py-3"><div className="font-medium">{o.customerName}</div><div className="text-[12.5px] text-muted">{o.customerEmail}</div></td>
                <td className="px-3 py-3">{o.itemLabel}</td>
                <td className="px-3 py-3 text-muted">{dateFr(o.createdAt)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{euros(o.totalCents)}</td>
                <td className="px-5 py-3"><Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge></td>
              </tr>
            ))}
            {orders.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">Aucune commande.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
