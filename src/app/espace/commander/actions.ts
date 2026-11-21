"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { checkoutUrl, fulfillOrder, paymentsAvailable } from "@/server/orders";
import { designOf } from "@/server/business";
import { getSettings } from "@/server/settings";
import { rateLimit } from "@/server/rate-limit";
import { paymentSimulated } from "@/lib/env";
import { bool, fail, str, zodErrors, type ActionResult } from "@/lib/action";
import { quote, unitCents } from "@/lib/pricing";
import { CGV_VERSION } from "@/lib/legal";
import { FORMATS } from "@/lib/labels/formats";
import type { LabelFormat, Prisma } from "@/generated/prisma/client";

const text = (max: number) => z.string().trim().max(max);
const orderSchema = z
  .object({
    /** Identifiant du palier d'impression, ou vide pour l'offre numérique seule. */
    tierId: text(60),
    billName: z.string().trim().min(2, "Nom ou raison sociale requis").max(100),
    billLine1: z.string().trim().min(3, "Adresse requise").max(120),
    billLine2: text(120),
    billPostal: z.string().trim().regex(/^\d{5}$/, "Code postal à 5 chiffres"),
    billCity: z.string().trim().min(2, "Ville requise").max(80),
    billSiret: z.union([z.literal(""), z.string().trim().regex(/^\d{14}$/, "SIRET : 14 chiffres (ou laissez vide)")]),
    shipSame: z.boolean(),
    acceptCgv: z.literal(true, { message: "Acceptez les conditions générales de vente pour commander" }),
    shipName: text(80),
    shipLine1: text(120),
    shipLine2: text(120),
    shipPostal: text(5),
    shipCity: text(80),
    shipPhone: text(20),
  })
  .superRefine((v, ctx) => {
    if (!v.tierId) return;
    if (!/^[\d\s+().-]{6,20}$/.test(v.shipPhone)) ctx.addIssue({ code: "custom", path: ["shipPhone"], message: "Téléphone requis pour le transporteur" });
    if (v.shipSame) return;
    if (v.shipName.length < 2) ctx.addIssue({ code: "custom", path: ["shipName"], message: "Destinataire requis" });
    if (v.shipLine1.length < 3) ctx.addIssue({ code: "custom", path: ["shipLine1"], message: "Adresse requise" });
    if (!/^\d{5}$/.test(v.shipPostal)) ctx.addIssue({ code: "custom", path: ["shipPostal"], message: "Code postal à 5 chiffres" });
    if (v.shipCity.length < 2) ctx.addIssue({ code: "custom", path: ["shipCity"], message: "Ville requise" });
  });

/**
 * Commande unique : offre QR Pro (si le compte n'est pas encore actif) + étiquettes imprimées (facultatif).
 * Les montants sont recalculés ici à partir des tarifs en base ; rien ne vient du navigateur.
 */
export async function placeOrder(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePro();
  if (!paymentsAvailable()) return fail("Le paiement en ligne n'est pas encore activé. Contactez le support.");
  const keys = ["tierId", "billName", "billLine1", "billLine2", "billPostal", "billCity", "billSiret", "shipName", "shipLine1", "shipLine2", "shipPostal", "shipCity", "shipPhone"];
  const parsed = orderSchema.safeParse({ ...Object.fromEntries(keys.map((k) => [k, str(fd, k)])), billSiret: str(fd, "billSiret").replace(/\s/g, ""), shipSame: bool(fd, "shipSame"), acceptCgv: bool(fd, "acceptCgv") });
  if (!parsed.success) return zodErrors(parsed.error);
  const p = parsed.data;
  if (!(await rateLimit("order", user.businessId, 20, 3600))) return fail("Trop de commandes en peu de temps. Réessayez plus tard.");

  const [settings, b, tier, designRow] = await Promise.all([
    getSettings(),
    db.business.findUniqueOrThrow({ where: { id: user.businessId }, select: { name: true, activatedAt: true } }),
    p.tierId ? db.printTier.findFirst({ where: { id: p.tierId, active: true } }) : null,
    db.labelDesign.findUnique({ where: { businessId: user.businessId } }),
  ]);
  const activated = !!b.activatedAt;
  if (p.tierId) {
    if (!settings.printEnabled) return fail("Les commandes d'étiquettes imprimées sont momentanément suspendues.");
    if (!tier) return { ok: false, errors: { tierId: "Cette quantité n'est plus proposée" } };
    if (!designRow?.validatedAt) return fail("Validez d'abord le design de votre étiquette : c'est lui que nous imprimons.");
  } else if (activated) {
    return fail("Votre offre QR Pro est déjà active : choisissez une quantité d'étiquettes imprimées.");
  }

  const doc = designRow ? designOf(designRow) : null;
  const formatLabel = doc ? FORMATS[doc.format].label : undefined;
  const { lines, totalCents } = quote({ activated, digitalPriceCents: settings.digitalPriceCents, tier, formatLabel });
  const bill = { billName: p.billName, billLine1: p.billLine1, billLine2: p.billLine2, billPostal: p.billPostal, billCity: p.billCity, billSiret: p.billSiret };
  const ship = tier
    ? p.shipSame
      ? { shipName: p.billName, shipLine1: p.billLine1, shipLine2: p.billLine2, shipPostal: p.billPostal, shipCity: p.billCity, shipPhone: p.shipPhone }
      : { shipName: p.shipName, shipLine1: p.shipLine1, shipLine2: p.shipLine2, shipPostal: p.shipPostal, shipCity: p.shipCity, shipPhone: p.shipPhone }
    : null;
  // Coordonnées mémorisées pour la prochaine commande.
  await db.business.update({ where: { id: user.businessId }, data: { ...bill, ...(ship ?? {}) } });

  const order = await db.order.create({
    data: {
      businessId: user.businessId,
      kind: tier ? "PRINT" : "ACTIVATION",
      customerName: p.billName || b.name,
      customerEmail: user.email,
      itemLabel: lines.map((l) => l.label).join(" + "),
      lines: lines as unknown as Prisma.InputJsonValue,
      includesActivation: !activated,
      ...(tier && doc ? { quantity: tier.quantity, format: doc.format as LabelFormat, design: { doc } as unknown as Prisma.InputJsonValue, unitPriceCents: unitCents(tier) } : { unitPriceCents: totalCents }),
      subtotalCents: totalCents,
      shippingCents: 0,
      shippingLabel: tier ? "Livraison suivie comprise" : "",
      totalCents,
      ...bill,
      ...(ship ?? {}),
      cgvAcceptedAt: new Date(),
      cgvVersion: CGV_VERSION,
      events: { create: { status: "EN_ATTENTE_PAIEMENT", note: "Commande créée" } },
    },
  });
  redirect(await checkoutUrl(order.id));
}

/** Reprendre le paiement d'une commande non payée. */
export async function resumePayment(fd: FormData): Promise<void> {
  const user = await requirePro();
  const order = await db.order.findFirst({ where: { id: str(fd, "id"), businessId: user.businessId, status: "EN_ATTENTE_PAIEMENT" }, select: { id: true } });
  if (!order) redirect("/espace/commandes");
  redirect(await checkoutUrl(order.id));
}

export async function cancelUnpaid(fd: FormData): Promise<void> {
  const user = await requirePro();
  const id = str(fd, "id");
  const { count } = await db.order.updateMany({ where: { id, businessId: user.businessId, status: "EN_ATTENTE_PAIEMENT" }, data: { status: "ANNULEE" } });
  if (count) await db.orderEvent.create({ data: { orderId: id, status: "ANNULEE", note: "Annulée par le client avant paiement" } });
  revalidatePath("/espace/commandes");
  redirect("/espace/commandes");
}

/**
 * DÉVELOPPEMENT UNIQUEMENT (aucune clé Stripe, NODE_ENV ≠ production) : simule un paiement réussi
 * pour tester tout le parcours. Refusé dans tous les autres cas.
 */
export async function simulatePayment(fd: FormData): Promise<void> {
  const user = await requirePro();
  if (!paymentSimulated()) throw new Error("Paiement simulé indisponible.");
  const order = await db.order.findFirst({ where: { id: str(fd, "id"), businessId: user.businessId, status: "EN_ATTENTE_PAIEMENT" }, select: { id: true } });
  if (order) await fulfillOrder(order.id, `SIMULATION-${Date.now()}`);
  revalidatePath("/espace", "layout");
  redirect(`/espace/commandes/${str(fd, "id")}?paiement=ok`);
}
