import "server-only";
import Stripe from "stripe";
import { db } from "@/server/db";
import { createPrintBatch, ensureMainCode } from "@/server/business";
import { sendEmail, notifyAdmin } from "@/server/email";
import { getSettings } from "@/server/settings";
import { env, appUrl, paymentSimulated } from "@/lib/env";
import { euros, eurosExact, orderNumber } from "@/lib/format";
import { storedToDoc } from "@/lib/labels/content";
import { FORMATS, type FormatKey } from "@/lib/labels/formats";
import { ORDER_STATUS, type OrderStatusKey } from "@/lib/orders";
import { invoiceNumber, type Line } from "@/lib/pricing";

let stripe: Stripe | null = null;
/** Client Stripe, ou null si STRIPE_SECRET_KEY n'est pas configurée (aucun paiement réel possible). */
export function getStripe(): Stripe | null {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) return null;
  stripe ??= new Stripe(key, { appInfo: { name: "QR Pro" } });
  return stripe;
}

export function paymentsAvailable(): boolean {
  return !!getStripe() || paymentSimulated();
}

/**
 * Ouvre le paiement d'une commande. Renvoie l'URL où envoyer le client :
 * Stripe Checkout, ou — en développement sans clé Stripe uniquement — la page de paiement simulé.
 */
export async function checkoutUrl(orderId: string): Promise<string> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const base = `${appUrl()}/espace/commandes/${order.id}`;
  const s = getStripe();
  if (!s) {
    if (paymentSimulated()) return `${base}?simulation=1`;
    throw new Error("Paiement indisponible : Stripe n'est pas configuré.");
  }
  // Mêmes lignes que le récapitulatif et la facture : le client voit exactement ce qu'il a validé.
  const lines = orderLines(order);
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = lines.map((l) => ({
    price_data: { currency: "eur", unit_amount: l.unitCents, product_data: { name: l.label, ...(l.detail ? { description: l.detail } : {}) } },
    quantity: l.quantity,
  }));
  const session = await s.checkout.sessions.create({
    mode: "payment",
    locale: "fr",
    line_items: lineItems,
    customer_email: order.customerEmail,
    client_reference_id: order.id,
    metadata: { orderId: order.id },
    payment_intent_data: { metadata: { orderId: order.id }, description: `${orderNumber(order.number)} — ${order.itemLabel}` },
    // La facture légale est émise par QR Pro (numérotation continue) : pas de seconde facture Stripe.
    success_url: `${base}?paiement=ok&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}?paiement=annule`,
  });
  await db.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
  return session.url;
}

/**
 * Vérifie une session Stripe payée et exécute la commande. Utilisé par le webhook ET au retour
 * du client (si le webhook n'est pas encore arrivé). Idempotent.
 */
export async function confirmStripeSession(sessionId: string): Promise<boolean> {
  const s = getStripe();
  if (!s) return false;
  const session = await s.checkout.sessions.retrieve(sessionId);
  const orderId = session.metadata?.orderId;
  if (!orderId || session.payment_status !== "paid") return false;
  const order = await db.order.findUnique({ where: { id: orderId }, select: { totalCents: true, stripeSessionId: true } });
  if (!order) return false;
  if (session.amount_total !== order.totalCents || session.currency !== "eur") {
    console.error(`[stripe] Montant incohérent pour la commande ${orderId} : ${session.amount_total} ${session.currency} ≠ ${order.totalCents} eur`);
    return false;
  }
  const ref = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? session.id);
  await fulfillOrder(orderId, ref);
  return true;
}

/** Lignes facturées d'une commande (les anciennes commandes, sans lignes, sont reconstituées). */
export function orderLines(o: { lines: unknown; itemLabel: string; subtotalCents: number; shippingCents: number; shippingLabel: string }): Line[] {
  if (Array.isArray(o.lines) && o.lines.length) return o.lines as Line[];
  const out: Line[] = [{ label: o.itemLabel, quantity: 1, unitCents: o.subtotalCents, totalCents: o.subtotalCents }];
  if (o.shippingCents > 0) out.push({ label: `Livraison — ${o.shippingLabel}`, quantity: 1, unitCents: o.shippingCents, totalCents: o.shippingCents });
  return out;
}

/**
 * Passe une commande en « payée » et livre ce qui a été acheté, une seule fois (transaction) :
 *  - offre QR Pro : activation du compte + QR code principal ;
 *  - étiquettes imprimées : lot figé (design validé × quantité) envoyé en production ;
 *  - facture : numéro chronologique attribué au paiement.
 */
export async function fulfillOrder(orderId: string, paymentRef: string): Promise<boolean> {
  const result = await db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId } });
    if (!o || o.status !== "EN_ATTENTE_PAIEMENT") return null;
    const next: OrderStatusKey = o.kind === "PRINT" ? "RECUE" : "TERMINEE";
    const now = new Date();
    const { invoiceSeq } = await tx.setting.update({ where: { id: "main" }, data: { invoiceSeq: { increment: 1 } }, select: { invoiceSeq: true } });
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: "EN_ATTENTE_PAIEMENT" },
      data: { status: next, paidAt: now, paymentRef, invoiceNumber: invoiceNumber(invoiceSeq, now) },
    });
    if (count !== 1) throw new Error("ALREADY_PAID"); // annule aussi l'incrément de la séquence
    if (o.businessId && o.includesActivation) {
      await tx.business.updateMany({ where: { id: o.businessId, activatedAt: null }, data: { activatedAt: now, activationSource: "paiement" } });
      await ensureMainCode(o.businessId, tx);
    }
    if (o.businessId && o.kind === "PRINT" && o.quantity && o.format) {
      await ensureMainCode(o.businessId, tx);
      const batch = await createPrintBatch(tx, { businessId: o.businessId, count: o.quantity, doc: storedToDoc(o.design, o.format as FormatKey) });
      await tx.order.update({ where: { id: orderId }, data: { batchId: batch.id } });
    }
    await tx.orderEvent.create({ data: { orderId, status: next, note: "Paiement confirmé" } });
    return { ...o, status: next, invoiceNumber: invoiceNumber(invoiceSeq, now) };
  }).catch((e: unknown) => {
    if (e instanceof Error && e.message === "ALREADY_PAID") return null;
    throw e;
  });
  if (!result) return false;

  const { brandName } = await getSettings();
  const link = `${appUrl()}/espace/commandes/${orderId}`;
  const parts: string[] = [];
  if (result.includesActivation) parts.push("Votre offre QR Pro est active : votre page est en ligne et vos fichiers d'impression sont disponibles dans « Mes fichiers », sans limite.");
  if (result.kind === "PRINT") parts.push(`Vos ${result.quantity} étiquettes (${FORMATS[result.format as FormatKey]?.label ?? ""}) partent en production. Vous serez prévenu par email à l'expédition, avec le numéro de suivi.`);
  await sendEmail(
    result.customerEmail,
    `${brandName} — confirmation de la commande ${orderNumber(result.number)}`,
    `Bonjour,\n\nMerci pour votre commande ${orderNumber(result.number)} : ${eurosExact(result.totalCents)} payés.\n\n${parts.join("\n\n")}\n\nVotre facture ${result.invoiceNumber} est téléchargeable depuis votre espace.\n\nSuivre la commande : ${link}`,
  );
  await notifyAdmin(
    `Nouvelle commande ${orderNumber(result.number)} — ${euros(result.totalCents)}`,
    `${result.customerName} (${result.customerEmail})\n${result.itemLabel}\nTotal : ${eurosExact(result.totalCents)}${result.kind === "PRINT" ? "\n\nÀ imprimer et expédier." : ""}\n\n${appUrl()}/admin/commandes/${orderId}`,
  );
  return true;
}

/** Changement de statut par l'administrateur, avec historique et email au client. */
export async function setOrderStatus(orderId: string, status: OrderStatusKey, note: string, tracking?: { carrier: string; trackingNumber: string }) {
  const order = await db.order.update({
    where: { id: orderId },
    data: { status, ...(tracking ? tracking : {}) },
  });
  await db.orderEvent.create({ data: { orderId, status, note } });
  const { brandName } = await getSettings();
  const extra =
    status === "EXPEDIEE" && order.trackingNumber
      ? `\n\nTransporteur : ${order.carrier || "—"}\nNuméro de suivi : ${order.trackingNumber}`
      : "";
  await sendEmail(
    order.customerEmail,
    `${brandName} — commande ${orderNumber(order.number)} : ${ORDER_STATUS[status].label.toLowerCase()}`,
    `Bonjour,\n\nVotre commande ${orderNumber(order.number)} (${order.itemLabel}) est maintenant : ${ORDER_STATUS[status].label}.${note ? `\n\n${note}` : ""}${extra}\n\nDétail : ${appUrl()}/espace/commandes/${order.id}`,
  );
}
