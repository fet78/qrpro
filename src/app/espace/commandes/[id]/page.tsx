import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, FileDown, FileText } from "lucide-react";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { confirmStripeSession, orderLines } from "@/server/orders";
import { paymentSimulated } from "@/lib/env";
import { PageHeader, Card, CardHeader, Badge, Notice, Button, buttonClass } from "@/components/ui";
import { dateFr, eurosExact, orderNumber } from "@/lib/format";
import { ORDER_STATUS, PRINT_STEPS } from "@/lib/orders";
import { resumePayment, cancelUnpaid, simulatePayment } from "../../commander/actions";

export const metadata = { title: "Commande" };
export const dynamic = "force-dynamic";

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paiement?: string; session_id?: string; simulation?: string }> }) {
  const user = await requirePro();
  const { id } = await params;
  const sp = await searchParams;
  let order = await db.order.findFirst({ where: { id, businessId: user.businessId }, include: { events: { orderBy: { createdAt: "asc" } } } });
  if (!order) notFound();

  // Retour de Stripe : si le webhook n'est pas encore passé, on vérifie la session directement.
  if (order.status === "EN_ATTENTE_PAIEMENT" && sp.session_id && sp.session_id === order.stripeSessionId) {
    if (await confirmStripeSession(sp.session_id)) {
      order = await db.order.findFirstOrThrow({ where: { id, businessId: user.businessId }, include: { events: { orderBy: { createdAt: "asc" } } } });
    }
  }
  const st = ORDER_STATUS[order.status];
  const isPrint = order.kind === "PRINT";
  const stepIdx = PRINT_STEPS.indexOf(order.status);
  const unpaid = order.status === "EN_ATTENTE_PAIEMENT";

  return (
    <>
      <Link href="/espace/commandes" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Mes commandes</Link>
      <PageHeader title={`Commande ${orderNumber(order.number)}`} description={`${order.itemLabel} · passée le ${dateFr(order.createdAt)}`} action={<Badge tone={st.tone} className="text-[13px]">{st.label}</Badge>} />

      {sp.paiement === "ok" && !unpaid ? <Notice tone="success" className="mb-6">Paiement confirmé, merci ! Un email de confirmation vous a été envoyé.</Notice> : null}
      {sp.paiement === "ok" && unpaid ? <Notice className="mb-6">Paiement en cours de confirmation par la banque. Cette page se mettra à jour dans quelques instants (rechargez-la).</Notice> : null}
      {sp.paiement === "annule" && unpaid ? <Notice tone="warn" className="mb-6">Le paiement a été interrompu. Aucun montant n&apos;a été débité.</Notice> : null}

      {unpaid ? (
        <Card className="mb-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[15px] font-semibold">En attente de paiement</div>
              <div className="text-[13.5px] text-muted">Total : {eurosExact(order.totalCents)}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={cancelUnpaid}><input type="hidden" name="id" value={order.id} /><Button variant="ghost">Annuler</Button></form>
              {paymentSimulated() ? (
                <form action={simulatePayment}><input type="hidden" name="id" value={order.id} /><Button variant="dark">Simuler le paiement (développement)</Button></form>
              ) : (
                <form action={resumePayment}><input type="hidden" name="id" value={order.id} /><Button>Payer {eurosExact(order.totalCents)}</Button></form>
              )}
            </div>
          </div>
          {sp.simulation || paymentSimulated() ? <p className="mt-3 text-[12.5px] text-warn">Stripe n&apos;est pas configuré : ce bouton simule un paiement réussi, sans aucun débit. Il n&apos;existe pas en production.</p> : null}
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {isPrint && order.status !== "ANNULEE" && !unpaid ? (
            <Card>
              <CardHeader title="Suivi" description="Les étapes sont mises à jour par notre équipe au fil de la production." />
              <ol className="p-5 sm:p-6">
                {PRINT_STEPS.map((s, i) => {
                  const doneStep = i <= stepIdx;
                  const ev = order.events.filter((e) => e.status === s).at(-1);
                  return (
                    <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < PRINT_STEPS.length - 1 ? <span className={`absolute left-[13px] top-7 h-[calc(100%-20px)] w-px ${i < stepIdx ? "bg-brand" : "bg-line"}`} /> : null}
                      <span className={`relative z-[1] grid h-7 w-7 flex-none place-items-center rounded-full text-[12px] font-semibold ${doneStep ? "bg-brand text-white" : "border border-line bg-surface text-faint"}`}>
                        {doneStep ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      <div className="pt-0.5">
                        <div className={`text-[14.5px] ${doneStep ? "font-medium" : "text-muted"}`}>{ORDER_STATUS[s].label}</div>
                        {ev ? <div className="text-[12.5px] text-muted">{dateFr(ev.createdAt, true)}{ev.note && ev.note !== "Paiement confirmé" ? ` — ${ev.note}` : ""}</div> : null}
                        {s === "EXPEDIEE" && order.trackingNumber ? <div className="mt-1 text-[13px]">{order.carrier} · suivi <b>{order.trackingNumber}</b></div> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          ) : null}

          {order.includesActivation && order.paidAt ? (
            <Card className="p-5 sm:p-6">
              <div className="text-[15px] font-semibold">Votre offre QR Pro est active</div>
              <p className="mt-1 text-[14px] text-muted">Votre page est en ligne et vos fichiers d&apos;impression sont disponibles, sans limite : réimprimez quand vous voulez, c&apos;est toujours le même QR code.</p>
              <Link href="/espace/codes" className={`${buttonClass("primary")} mt-4`}>Télécharger mes fichiers</Link>
            </Card>
          ) : null}

          {order.kind === "DIGITAL_PACK" && order.status === "TERMINEE" ? (
            <Card className="p-5 sm:p-6">
              <div className="text-[15px] font-semibold">Ancienne offre (pack de {order.credits} QR codes)</div>
              <p className="mt-1 text-[14px] text-muted">Votre compte est passé à l&apos;offre QR Pro : impressions illimitées avec votre QR code unique.</p>
            </Card>
          ) : null}

          {isPrint && order.batchId ? (
            <Card className="p-5 sm:p-6">
              <div className="text-[15px] font-semibold">Fichier envoyé à l&apos;impression</div>
              <p className="mt-1 text-[14px] text-muted">{order.quantity} étiquettes avec votre QR code, exactement comme vous les recevrez.</p>
              <a href={`/api/batches/${order.batchId}/pdf`} className={`${buttonClass("secondary", "sm")} mt-4`}><FileDown className="h-4 w-4" /> PDF de la commande</a>
            </Card>
          ) : null}
        </div>

        <Card className="h-fit">
          <CardHeader title="Récapitulatif" />
          <dl className="space-y-2.5 p-5 text-[14px] sm:p-6">
            {orderLines(order).map((l) => (
              <div key={l.label} className="flex justify-between gap-3"><dt>{l.label}</dt><dd className="tabular-nums">{eurosExact(l.totalCents)}</dd></div>
            ))}
            {isPrint && !order.shippingCents ? <div className="flex justify-between text-[13.5px]"><dt className="text-muted">Livraison suivie</dt><dd className="text-success">Incluse</dd></div> : null}
            <div className="flex justify-between border-t border-line pt-2 font-semibold"><dt>Total payé</dt><dd className="tabular-nums">{eurosExact(order.totalCents)}</dd></div>
            {order.paidAt ? <div className="flex justify-between text-[13px]"><dt className="text-muted">Payée le</dt><dd>{dateFr(order.paidAt, true)}</dd></div> : null}
          </dl>
          {order.invoiceNumber ? (
            <div className="border-t border-line p-5 sm:p-6">
              <a href={`/api/orders/${order.id}/invoice`} className={`${buttonClass("secondary", "sm")} w-full`}><FileText className="h-4 w-4" /> Facture {order.invoiceNumber} (PDF)</a>
            </div>
          ) : null}
          {isPrint ? (
            <div className="border-t border-line p-5 text-[14px] leading-relaxed sm:p-6">
              <div className="mb-1 text-[12px] font-medium uppercase tracking-wider text-muted">Livraison</div>
              {order.shipName}<br />{order.shipLine1}{order.shipLine2 ? <><br />{order.shipLine2}</> : null}<br />{order.shipPostal} {order.shipCity}
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}
