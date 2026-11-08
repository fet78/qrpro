import Link from "next/link";
import { Package } from "lucide-react";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { PageHeader, Card, EmptyState, LinkButton, Badge } from "@/components/ui";
import { dateFr, euros, orderNumber } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/orders";

export const metadata = { title: "Mes commandes" };

export default async function OrdersPage() {
  const user = await requirePro();
  const orders = await db.order.findMany({ where: { businessId: user.businessId }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Mes commandes" description="Votre offre QR Pro et vos étiquettes imprimées, avec leurs factures." action={<LinkButton href="/espace/commander">Nouvelle commande</LinkButton>} />
      <Card>
        {orders.length ? (
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/espace/commandes/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-canvas sm:px-6">
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-medium">{o.itemLabel}</div>
                    <div className="text-[13px] text-muted">{orderNumber(o.number)} · {dateFr(o.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[14px] tabular-nums">{euros(o.totalCents)}</span>
                    <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Package className="h-5 w-5" />} title="Aucune commande" description="Votre offre QR Pro et vos commandes d'étiquettes imprimées apparaîtront ici." action={<LinkButton href="/espace/commander" variant="secondary">Voir les offres</LinkButton>} />
        )}
      </Card>
    </>
  );
}
