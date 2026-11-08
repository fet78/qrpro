import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown } from "lucide-react";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/session";
import { orderLines } from "@/server/orders";
import { PageHeader, Card, CardHeader, Badge, Notice, buttonClass } from "@/components/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { dateFr, eurosExact, orderNumber } from "@/lib/format";
import { ORDER_STATUS, ADMIN_PRINT_STATUSES } from "@/lib/orders";
import { FORMATS, type FormatKey } from "@/lib/labels/formats";
import { updateOrder, saveOrderNote } from "../../actions";

export const metadata = { title: "Commande" };

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const o = await db.order.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: "desc" } }, business: { select: { id: true, name: true, slug: true } } } });
  if (!o) notFound();
  const isPrint = o.kind === "PRINT";
  const paid = o.status !== "EN_ATTENTE_PAIEMENT";
  return (
    <>
      <Link href="/admin/commandes" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Commandes</Link>
      <PageHeader title={`${orderNumber(o.number)} — ${o.customerName}`} description={`${o.itemLabel} · ${dateFr(o.createdAt, true)}`} action={<Badge tone={ORDER_STATUS[o.status].tone} className="text-[13px]">{ORDER_STATUS[o.status].label}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {isPrint && paid ? (
            <Card>
              <CardHeader title="Production" description="Aucun imprimeur n'est connecté : l'impression et l'expédition se font hors de l'application. Mettez le statut à jour à chaque étape — le client est prévenu par email." />
              <div className="flex flex-wrap items-center gap-3 border-b border-line p-5 sm:p-6">
                {o.batchId ? (
                  <a href={`/api/batches/${o.batchId}/pdf`} className={buttonClass("primary")}><FileDown className="h-4 w-4" /> Fichier d&apos;impression (PDF A4)</a>
                ) : (
                  <Notice tone="warn">Fichier d&apos;impression disponible après le paiement.</Notice>
                )}
                <span className="text-[13.5px] text-muted">{o.quantity} étiquettes · {o.format ? FORMATS[o.format as FormatKey].label : ""} · toutes avec le QR code principal du client</span>
              </div>
              <ActionForm action={updateOrder} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
                <input type="hidden" name="id" value={o.id} />
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="status">Nouveau statut</label>
                  <select id="status" name="status" className="input" defaultValue={o.status}>
                    {ADMIN_PRINT_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS[s].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="carrier">Transporteur</label>
                  <input className="input" id="carrier" name="carrier" defaultValue={o.carrier} placeholder="La Poste, Colissimo…" />
                </div>
                <div>
                  <label className="label" htmlFor="trackingNumber">N° de suivi</label>
                  <input className="input" id="trackingNumber" name="trackingNumber" defaultValue={o.trackingNumber} />
                  <FieldError name="trackingNumber" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="note">Message au client (facultatif)</label>
                  <input className="input" id="note" name="note" maxLength={500} placeholder="Ex. : impression prévue jeudi." />
                </div>
                <div className="sm:col-span-2"><SubmitButton>Mettre à jour et prévenir le client</SubmitButton></div>
              </ActionForm>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Historique" />
            <ul className="divide-y divide-line">
              {o.events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-[14px]">
                  <span><Badge tone={ORDER_STATUS[e.status].tone}>{ORDER_STATUS[e.status].label}</Badge>{e.note ? <span className="ml-2 text-muted">{e.note}</span> : null}</span>
                  <span className="text-[13px] text-muted">{dateFr(e.createdAt, true)}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Note interne" description="Visible uniquement par l'administration." />
            <ActionForm action={saveOrderNote} className="space-y-3 p-5 sm:p-6">
              <input type="hidden" name="id" value={o.id} />
              <textarea className="input min-h-[90px]" name="adminNote" defaultValue={o.adminNote} aria-label="Note interne" />
              <SubmitButton variant="secondary">Enregistrer la note</SubmitButton>
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Client" />
            <div className="space-y-1 p-5 text-[14px] sm:p-6">
              <div className="font-medium">{o.customerName}</div>
              <a className="link" href={`mailto:${o.customerEmail}`}>{o.customerEmail}</a>
              {o.business ? <div className="pt-2"><Link className="link" href={`/admin/clients/${o.business.id}`}>Fiche client</Link> · <a className="link" href={`/p/${o.business.slug}`} target="_blank">Page publique</a></div> : <div className="pt-2 text-muted">Compte supprimé</div>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Paiement" />
            <dl className="space-y-2 p-5 text-[14px] sm:p-6">
              {orderLines(o).map((l) => (
                <div key={l.label} className="flex justify-between gap-3"><dt className="text-muted">{l.label}</dt><dd className="tabular-nums">{eurosExact(l.totalCents)}</dd></div>
              ))}
              <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Total TTC</dt><dd className="tabular-nums">{eurosExact(o.totalCents)}</dd></div>
              <div className="flex justify-between text-[13px]"><dt className="text-muted">Payée le</dt><dd>{dateFr(o.paidAt, true)}</dd></div>
              {o.paymentRef ? <div className="break-all text-[12px] text-muted">Réf. {o.paymentRef}</div> : null}
              {o.invoiceNumber ? <a href={`/api/orders/${o.id}/invoice`} className={`${buttonClass("secondary", "sm")} mt-2 w-full`}>Facture {o.invoiceNumber}</a> : null}
            </dl>
          </Card>
          {isPrint ? (
            <Card>
              <CardHeader title="Adresse de livraison" />
              <div className="p-5 text-[14px] leading-relaxed sm:p-6">
                {o.shipName}<br />{o.shipLine1}{o.shipLine2 ? <><br />{o.shipLine2}</> : null}<br />{o.shipPostal} {o.shipCity}<br /><span className="text-muted">{o.shipPhone}</span>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
