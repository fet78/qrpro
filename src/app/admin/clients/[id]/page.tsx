import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileDown } from "lucide-react";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/session";
import { PageHeader, Card, CardHeader, Badge, Button, Stat, buttonClass } from "@/components/ui";
import { dateFr, euros, orderNumber, phoneFr } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/orders";
import { FORMATS, type FormatKey } from "@/lib/labels/formats";
import { setUserDisabled, setActivation } from "../../actions";

export const metadata = { title: "Client" };

export default async function AdminClient({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const b = await db.business.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, disabledAt: true, createdAt: true, lastLoginAt: true } },
      orders: { orderBy: { createdAt: "desc" }, take: 20 },
      batches: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: { select: { codes: true, interventions: true } },
    },
  });
  if (!b) notFound();
  const scans = await db.qrCode.aggregate({ where: { businessId: id }, _sum: { scanCount: true } });
  const disabled = !!b.user.disabledAt;
  return (
    <>
      <Link href="/admin/clients" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Clients</Link>
      <PageHeader
        title={b.name}
        description={`${b.user.email} · inscrit le ${dateFr(b.createdAt)} · dernière connexion ${dateFr(b.user.lastLoginAt, true)}`}
        action={
          <>
            <a href={`/p/${b.slug}`} target="_blank" className={buttonClass("secondary")}><ExternalLink className="h-4 w-4" /> Page publique</a>
            <form action={setUserDisabled}>
              <input type="hidden" name="userId" value={b.user.id} />
              <input type="hidden" name="disable" value={disabled ? "0" : "1"} />
              <Button variant={disabled ? "primary" : "danger"}>{disabled ? "Réactiver le compte" : "Désactiver le compte"}</Button>
            </form>
          </>
        }
      />
      {disabled ? <div className="mb-6"><Badge tone="danger">Compte désactivé le {dateFr(b.user.disabledAt)} — connexion impossible, page publique masquée</Badge></div> : null}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Offre QR Pro" value={b.activatedAt ? (b.activationSource === "offert" ? "Offerte" : "Active") : "Non activée"} />
        <Stat label="Commandes" value={b.orders.length} />
        <Stat label="Scans" value={scans._sum.scanCount ?? 0} />
        <Stat label="Demandes reçues" value={b._count.interventions} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Commandes" />
            <ul className="divide-y divide-line">
              {b.orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/commandes/${o.id}`} className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-canvas">
                    <span className="text-[14px]">{orderNumber(o.number)} · {o.itemLabel}</span>
                    <span className="flex items-center gap-3"><span className="tabular-nums">{euros(o.totalCents)}</span><Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge></span>
                  </Link>
                </li>
              ))}
              {b.orders.length === 0 ? <li className="px-6 py-5 text-[14px] text-muted">Aucune commande.</li> : null}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Lots de QR codes" />
            <ul className="divide-y divide-line">
              {b.batches.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 px-6 py-3 text-[14px]">
                  <span>{x.count} × {FORMATS[x.format as FormatKey].label} · {dateFr(x.createdAt)} {x.printed ? <Badge tone="info">Impression</Badge> : null}</span>
                  <a href={`/api/batches/${x.id}/pdf`} className={buttonClass("secondary", "sm")}><FileDown className="h-3.5 w-3.5" /> PDF</a>
                </li>
              ))}
              {b.batches.length === 0 ? <li className="px-6 py-5 text-[14px] text-muted">Aucun lot.</li> : null}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Coordonnées publiques" />
            <dl className="space-y-1.5 p-5 text-[14px] sm:p-6">
              <div>{b.trade || <span className="text-muted">Métier non renseigné</span>}</div>
              <div>{b.phone ? phoneFr(b.phone) : <span className="text-muted">Pas de téléphone</span>}</div>
              <div>{b.email}</div>
              <div className="text-muted">{[b.address, b.postalCode, b.city].filter(Boolean).join(", ")}</div>
            </dl>
          </Card>
          <Card>
            <CardHeader
              title="Offre QR Pro"
              description={b.activatedAt ? `Active depuis le ${dateFr(b.activatedAt)}${b.activationSource === "offert" ? " (offerte)" : ""}.` : "Non activée : la page n'est pas en ligne et les fichiers d'impression sont verrouillés."}
            />
            <form action={setActivation} className="p-5 sm:p-6">
              <input type="hidden" name="businessId" value={b.id} />
              <input type="hidden" name="on" value={b.activatedAt ? "0" : "1"} />
              <Button variant={b.activatedAt ? "secondary" : "primary"}>{b.activatedAt ? "Retirer l'activation" : "Offrir l'activation"}</Button>
              <p className="mt-2 text-[12.5px] leading-snug text-muted">{b.activatedAt ? "La page repasse hors ligne. Le QR code est conservé et refonctionne à la réactivation." : "Pour un client test, un geste commercial ou un paiement reçu hors ligne."}</p>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
