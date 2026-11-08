import type Stripe from "stripe";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { getStripe, confirmStripeSession } from "@/server/orders";

export const runtime = "nodejs";

/**
 * Webhook Stripe. La signature est vérifiée avec STRIPE_WEBHOOK_SECRET ; chaque événement
 * n'est traité qu'une fois (table ProcessedEvent). Événements utiles :
 * checkout.session.completed et checkout.session.async_payment_succeeded.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Stripe non configuré", { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Signature manquante", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return new Response("Signature invalide", { status: 400 });
  }

  if (await db.processedEvent.findUnique({ where: { id: event.id } })) return Response.json({ received: true, duplicate: true });

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === "paid") await confirmStripeSession(session.id);
  }
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (orderId) await db.order.updateMany({ where: { id: orderId, status: "EN_ATTENTE_PAIEMENT", stripeSessionId: session.id }, data: { stripeSessionId: null } });
  }

  await db.processedEvent.create({ data: { id: event.id } }).catch(() => undefined);
  return Response.json({ received: true });
}
