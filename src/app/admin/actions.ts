"use server";

/**
 * Actions d'administration. Chaque action appelle requireAdmin() (rôle relu en base) :
 * l'espace admin n'est jamais protégé par la seule mise en page.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { requireAdmin, revokeAllSessions } from "@/server/auth/session";
import { setOrderStatus } from "@/server/orders";
import { ensureMainCode } from "@/server/business";
import { sendEmail } from "@/server/email";
import { getSettings } from "@/server/settings";
import { appUrl } from "@/lib/env";
import { bool, done, fail, str, zodErrors, type ActionResult } from "@/lib/action";
import { ADMIN_PRINT_STATUSES, type OrderStatusKey } from "@/lib/orders";
import { TEMPLATE_KEYS } from "@/lib/labels/library";

/** « 12,50 » ou « 12.5 » → 1250 centimes. */
const euros = z
  .string()
  .trim()
  .regex(/^\d{1,5}([.,]\d{1,2})?$/, "Montant invalide (ex. 49 ou 0,80)")
  .transform((v) => Math.round(parseFloat(v.replace(",", ".")) * 100));

// ---------------------------------------------------------------- Commandes

export async function updateOrder(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(fd, "id");
  const status = str(fd, "status") as OrderStatusKey;
  if (!ADMIN_PRINT_STATUSES.includes(status)) return fail("Statut invalide.");
  const order = await db.order.findUnique({ where: { id }, select: { kind: true, status: true } });
  if (!order || order.kind !== "PRINT") return fail("Commande introuvable.");
  if (order.status === "EN_ATTENTE_PAIEMENT") return fail("Commande non payée : son statut ne peut pas être modifié.");
  const carrier = str(fd, "carrier").trim().slice(0, 60);
  const trackingNumber = str(fd, "trackingNumber").trim().slice(0, 80);
  if (status === "EXPEDIEE" && !trackingNumber) return { ok: false, errors: { trackingNumber: "Indiquez le numéro de suivi pour une commande expédiée." } };
  const note = str(fd, "note").trim().slice(0, 500);
  if (status === order.status && !trackingNumber) return fail("Le statut est déjà celui-ci.");
  await setOrderStatus(id, status, note, { carrier, trackingNumber });
  revalidatePath("/admin", "layout");
  return done("Statut mis à jour. Le client a été prévenu par email.");
}

export async function saveOrderNote(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  await db.order.update({ where: { id: str(fd, "id") }, data: { adminNote: str(fd, "adminNote").slice(0, 2000) } });
  return done("Note enregistrée.");
}

// ---------------------------------------------------------------- Clients

export async function setUserDisabled(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = str(fd, "userId");
  if (userId === admin.id) throw new Error("Vous ne pouvez pas désactiver votre propre compte.");
  const disable = str(fd, "disable") === "1";
  await db.user.update({ where: { id: userId }, data: { disabledAt: disable ? new Date() : null } });
  if (disable) await revokeAllSessions(userId);
  revalidatePath("/admin", "layout");
}

/**
 * Activation manuelle de l'offre QR Pro (client test, geste commercial, paiement hors ligne) ou retrait.
 * Retirer l'activation met la page hors ligne mais ne supprime jamais le QR code : il refonctionne à la réactivation.
 */
export async function setActivation(fd: FormData): Promise<void> {
  await requireAdmin();
  const businessId = str(fd, "businessId");
  const on = str(fd, "on") === "1";
  if (on) {
    await db.business.updateMany({ where: { id: businessId, activatedAt: null }, data: { activatedAt: new Date(), activationSource: "offert" } });
    await ensureMainCode(businessId);
  } else {
    await db.business.update({ where: { id: businessId }, data: { activatedAt: null, activationSource: "" } });
  }
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------- Tarifs

export async function saveOffer(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ price: euros, printEnabled: z.boolean() }).safeParse({ price: str(fd, "price"), printEnabled: bool(fd, "printEnabled") });
  if (!parsed.success) return zodErrors(parsed.error);
  if (parsed.data.price < 50) return { ok: false, errors: { price: "Stripe exige au moins 0,50 €." } };
  await db.setting.upsert({ where: { id: "main" }, create: { id: "main", digitalPriceCents: parsed.data.price, printEnabled: parsed.data.printEnabled }, update: { digitalPriceCents: parsed.data.price, printEnabled: parsed.data.printEnabled } });
  revalidatePath("/", "layout");
  return done("Offre enregistrée.");
}

export async function saveTier(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ id: z.string(), quantity: z.coerce.number().int().min(1, "Au moins 1").max(100000), price: euros, active: z.boolean() })
    .safeParse({ id: str(fd, "id"), quantity: str(fd, "quantity"), price: str(fd, "price"), active: bool(fd, "active") });
  if (!parsed.success) return zodErrors(parsed.error);
  const { id, price, ...data } = parsed.data;
  if (price < 50) return { ok: false, errors: { price: "Stripe exige au moins 0,50 €." } };
  const clash = await db.printTier.findFirst({ where: { quantity: data.quantity, ...(id ? { id: { not: id } } : {}) } });
  if (clash) return { ok: false, errors: { quantity: "Cette quantité existe déjà." } };
  if (id) await db.printTier.update({ where: { id }, data: { ...data, priceCents: price } });
  else await db.printTier.create({ data: { ...data, priceCents: price } });
  revalidatePath("/", "layout");
  return done("Tarif d'impression enregistré.");
}

// ---------------------------------------------------------------- Modèles

export async function saveTemplate(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      key: z.string().refine((k) => TEMPLATE_KEYS.includes(k), "Modèle inconnu"),
      name: z.string().trim().min(2, "Nom requis").max(60),
      description: z.string().trim().max(160),
      position: z.coerce.number().int().min(0).max(999),
      active: z.boolean(),
    })
    .safeParse({ key: str(fd, "key"), name: str(fd, "name"), description: str(fd, "description"), position: str(fd, "position") || "0", active: bool(fd, "active") });
  if (!parsed.success) return zodErrors(parsed.error);
  const { key, ...data } = parsed.data;
  if (!data.active) {
    const rows = await db.template.findMany({ select: { key: true, active: true } });
    const activeElsewhere = TEMPLATE_KEYS.filter((k) => k !== key && (rows.find((r) => r.key === k)?.active ?? true));
    if (!activeElsewhere.length) return fail("Au moins un modèle doit rester proposé.");
  }
  await db.template.upsert({ where: { key }, create: { key, ...data }, update: data });
  revalidatePath("/admin/modeles");
  revalidatePath("/");
  return done("Modèle enregistré.");
}

// ---------------------------------------------------------------- Réglages

export async function saveSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      brandName: z.string().trim().min(2, "Nom requis").max(40),
      tagline: z.string().trim().max(160),
      contactEmail: z.union([z.literal(""), z.string().trim().email("Email invalide")]),
      contactPhone: z.string().trim().max(30),
      legalName: z.string().trim().max(120),
      legalAddress: z.string().trim().max(200),
      siret: z.union([z.literal(""), z.string().trim().regex(/^\d{14}$|^\d{3} ?\d{3} ?\d{3} ?\d{5}$/, "SIRET : 14 chiffres")]),
      vatMention: z.string().trim().max(120),
    })
    .safeParse(Object.fromEntries(["brandName", "tagline", "contactEmail", "contactPhone", "legalName", "legalAddress", "siret", "vatMention"].map((k) => [k, str(fd, k)])));
  if (!parsed.success) return zodErrors(parsed.error);
  await db.setting.upsert({ where: { id: "main" }, create: { id: "main", ...parsed.data }, update: parsed.data });
  revalidatePath("/", "layout");
  return done("Réglages enregistrés.");
}

// ---------------------------------------------------------------- Support

export async function adminReply(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(fd, "id");
  const body = str(fd, "body").trim();
  const close = bool(fd, "close");
  if (!body && !close) return { ok: false, errors: { body: "Message vide." } };
  const ticket = await db.supportTicket.findUnique({ where: { id }, include: { business: { select: { user: { select: { email: true } } } } } });
  if (!ticket) return fail("Demande introuvable.");
  await db.$transaction([
    ...(body ? [db.supportMessage.create({ data: { ticketId: id, body: body.slice(0, 4000), fromAdmin: true } })] : []),
    db.supportTicket.update({ where: { id }, data: { status: close ? "FERME" : "REPONDU" } }),
  ]);
  if (body) {
    const { brandName } = await getSettings();
    await sendEmail(ticket.business.user.email, `${brandName} — réponse à votre demande « ${ticket.subject} »`, `Bonjour,\n\n${body}\n\nRépondre : ${appUrl()}/espace/support/${id}`);
  }
  revalidatePath(`/admin/support/${id}`);
  return { ok: true, message: close ? "Demande clôturée." : "Réponse envoyée." };
}

export async function reopenTicket(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = str(fd, "id");
  await db.supportTicket.update({ where: { id }, data: { status: "OUVERT" } });
  redirect(`/admin/support/${id}`);
}
