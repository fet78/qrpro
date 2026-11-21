"use server";

/**
 * Actions de l'espace professionnel. Règle d'accès unique : la Business vient TOUJOURS de la
 * session (requirePro), jamais d'un identifiant envoyé par le navigateur. Tout identifiant reçu
 * (code, ticket, demande…) est vérifié avec `businessId` dans la clause where.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { requirePro, revokeAllSessions, closeSession } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { availableSlug, dataFor, LABEL_BUSINESS_SELECT } from "@/server/business";
import { loadServerFonts } from "@/lib/labels/fonts-server";
import { renderDoc, blockingIssues } from "@/lib/labels/render";
import { parseDoc } from "@/lib/labels/doc";
import { pageConfigSchema } from "@/lib/page/config";
import { jpegSize, pngSize as pngSizeOf } from "@/lib/images";
import { notifyAdmin } from "@/server/email";
import { sendVerificationEmail } from "@/server/auth/email-verification";
import { rateLimit } from "@/server/rate-limit";
import { appUrl } from "@/lib/env";
import { bool, done, fail, str, zodErrors, type ActionResult } from "@/lib/action";
import { hoursSchema } from "@/lib/hours";
import { isAccentKey } from "@/lib/labels/palette";
import { isValidSlug, slugify } from "@/lib/slug";
import type { LabelFormat, Prisma } from "@/generated/prisma/client";

const text = (max: number) => z.string().trim().max(max, `${max} caractères maximum`);
const url = z.union([z.literal(""), z.string().trim().url("Adresse web invalide (commencez par https://)").max(300).refine((u) => /^https?:\/\//i.test(u), "L'adresse doit commencer par https://")]);
const phone = z.union([z.literal(""), z.string().trim().regex(/^[\d\s+().-]{6,20}$/, "Numéro invalide")]);

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Ma page

const pageSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(80, "80 caractères maximum"),
  trade: text(80),
  phone,
  email: z.union([z.literal(""), z.string().trim().email("Email invalide").max(160)]),
  address: text(160),
  postalCode: z.union([z.literal(""), z.string().trim().regex(/^\d{5}$/, "Code postal à 5 chiffres")]),
  city: text(80),
  zone: text(160),
  description: text(1200),
  website: url,
  emergency: text(300),
  hoursNote: text(200),
  accent: z.string().refine(isAccentKey, "Couleur inconnue"),
  tipsEnabled: z.boolean(),
  showRequestForm: z.boolean(),
  hours: hoursSchema,
  services: z.array(z.object({ title: z.string().trim().min(1, "Intitulé requis").max(80), description: text(160), price: text(40).default("") })).max(20, "20 services maximum"),
  page: pageConfigSchema,
  tips: z.array(z.object({ title: z.string().trim().min(1, "Titre requis").max(80), body: text(1000), url })).max(15, "15 conseils maximum"),
});

export async function savePage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePro();
  const parsed = pageSchema.safeParse({
    name: str(fd, "name"),
    trade: str(fd, "trade"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    address: str(fd, "address"),
    postalCode: str(fd, "postalCode"),
    city: str(fd, "city"),
    zone: str(fd, "zone"),
    description: str(fd, "description"),
    website: str(fd, "website"),
    emergency: str(fd, "emergency"),
    hoursNote: str(fd, "hoursNote"),
    accent: str(fd, "accent"),
    tipsEnabled: bool(fd, "tipsEnabled"),
    showRequestForm: bool(fd, "showRequestForm"),
    hours: parseJson(str(fd, "hours")),
    services: parseJson(str(fd, "services")),
    page: parseJson(str(fd, "page")),
    tips: parseJson(str(fd, "tips")),
  });
  if (!parsed.success) return zodErrors(parsed.error);
  const { services, tips, page, ...data } = parsed.data;
  const id = user.businessId;
  if (page.coverPhotoId && !(await db.photo.findFirst({ where: { id: page.coverPhotoId, businessId: id }, select: { id: true } }))) page.coverPhotoId = "";
  await db.$transaction([
    db.business.update({ where: { id }, data: { ...data, page: page as unknown as Prisma.InputJsonValue } }),
    db.service.deleteMany({ where: { businessId: id } }),
    db.service.createMany({ data: services.map((s, i) => ({ ...s, businessId: id, position: i })) }),
    db.tip.deleteMany({ where: { businessId: id } }),
    db.tip.createMany({ data: tips.map((t, i) => ({ ...t, businessId: id, position: i })) }),
  ]);
  revalidatePath("/espace", "layout");
  return done("Page enregistrée. Elle est déjà à jour pour vos clients.");
}

/** Adresse de la page : modifiable tant qu'aucune étiquette n'existe (sinon les QR imprimés casseraient). */
export async function saveSlug(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePro();
  const slug = slugify(str(fd, "slug"));
  if (!isValidSlug(slug)) return { ok: false, errors: { slug: "3 à 48 caractères : lettres minuscules, chiffres et tirets." } };
  const codes = await db.qrCode.count({ where: { businessId: user.businessId } });
  if (codes > 0) return fail("L'adresse est définitive depuis la création de vos premières étiquettes.");
  const taken = await db.business.findFirst({ where: { slug, id: { not: user.businessId } }, select: { id: true } });
  if (taken) return { ok: false, errors: { slug: `Déjà prise. Suggestion : ${await availableSlug(slug, user.businessId)}` } };
  await db.business.update({ where: { id: user.businessId }, data: { slug } });
  revalidatePath("/espace", "layout");
  return done("Adresse mise à jour.");
}

// ---------------------------------------------------------------- Galerie

const MAX_PHOTOS = 24;

/** Photo de réalisation : JPEG recompressé dans le navigateur (≤ 1600 px), revérifié ici. */
export async function uploadPhoto(fd: FormData): Promise<{ ok: boolean; message: string; photo?: { id: string; w: number; h: number; caption: string } }> {
  const user = await requirePro();
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choisissez une image." };
  if (file.size > 1.5 * 1024 * 1024) return { ok: false, message: "Image trop lourde (1,5 Mo maximum)." };
  const data = new Uint8Array(await file.arrayBuffer());
  const isPng = data[0] === 0x89;
  const size = isPng ? pngSizeOf(data) : jpegSize(data);
  if (!size || size.w > 4000 || size.h > 4000 || size.w < 100 || size.h < 100) return { ok: false, message: "Format non reconnu. Utilisez une photo JPG ou PNG." };
  const usage = str(fd, "usage") === "label" ? "label" : "gallery";
  const count = await db.photo.count({ where: { businessId: user.businessId, usage } });
  if (count >= MAX_PHOTOS) return { ok: false, message: `${MAX_PHOTOS} photos maximum.` };
  if (!(await rateLimit("photo", user.businessId, 60, 3600))) return { ok: false, message: "Trop d'envois. Réessayez dans une heure." };
  const caption = str(fd, "caption").trim().slice(0, 120);
  const p = await db.photo.create({ data: { businessId: user.businessId, data, mime: isPng ? "image/png" : "image/jpeg", width: size.w, height: size.h, caption, position: count, usage } });
  revalidatePath("/espace/page");
  return { ok: true, message: "Photo ajoutée.", photo: { id: p.id, w: size.w, h: size.h, caption } };
}

export async function updatePhoto(id: string, patch: { caption?: string; move?: -1 | 1 }): Promise<{ ok: boolean }> {
  const user = await requirePro();
  const target = await db.photo.findFirst({ where: { id, businessId: user.businessId }, select: { usage: true } });
  if (!target) return { ok: false };
  const photos = await db.photo.findMany({ where: { businessId: user.businessId, usage: target.usage }, orderBy: { position: "asc" }, select: { id: true } });
  const i = photos.findIndex((p) => p.id === id);
  if (i < 0) return { ok: false };
  if (patch.caption !== undefined) await db.photo.update({ where: { id }, data: { caption: patch.caption.trim().slice(0, 120) } });
  if (patch.move) {
    const j = i + patch.move;
    if (j >= 0 && j < photos.length) {
      [photos[i], photos[j]] = [photos[j]!, photos[i]!];
      await db.$transaction(photos.map((p, k) => db.photo.update({ where: { id: p.id }, data: { position: k } })));
    }
  }
  revalidatePath("/espace/page");
  return { ok: true };
}

export async function deletePhoto(id: string): Promise<{ ok: boolean; message?: string }> {
  const user = await requirePro();
  // Une photo utilisée par le design d'étiquette validé ne peut pas disparaître des futures impressions.
  const design = await db.labelDesign.findUnique({ where: { businessId: user.businessId }, select: { doc: true } });
  if (design?.doc && JSON.stringify(design.doc).includes(`"${id}"`)) return { ok: false, message: "Cette photo est utilisée par votre étiquette : retirez-la du design avant de la supprimer." };
  // … ni d'un lot déjà généré (ses PDF sont recalculés à chaque téléchargement).
  const inBatch = await db.$queryRaw<{ n: number }[]>`SELECT 1 AS n FROM "Batch" WHERE "businessId" = ${user.businessId} AND "design"::text LIKE ${`%"${id}"%`} LIMIT 1`;
  if (inBatch.length) return { ok: false, message: "Cette photo figure sur des étiquettes déjà générées : elle doit rester disponible pour leurs réimpressions." };
  const { count } = await db.photo.deleteMany({ where: { id, businessId: user.businessId } });
  revalidatePath("/espace/page");
  return { ok: count === 1 };
}

// ---------------------------------------------------------------- Logo

const MAX_LOGO_BYTES = 1024 * 1024;

/** Lit largeur/hauteur dans l'en-tête PNG (IHDR) ; null si ce n'est pas un PNG valide. */
function pngSize(buf: Buffer): { w: number; h: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 33 || sig.some((b, i) => buf[i] !== b) || buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

export async function uploadLogo(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePro();
  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) return fail("Choisissez une image.");
  if (file.size > MAX_LOGO_BYTES) return fail("Image trop lourde (1 Mo maximum).");
  const buf = Buffer.from(await file.arrayBuffer());
  const size = pngSize(buf);
  if (!size || size.w < 16 || size.h < 16 || size.w > 2400 || size.h > 2400) return fail("Format non reconnu. Utilisez une image PNG ou JPG.");
  await db.business.update({
    where: { id: user.businessId },
    data: { logo: buf, logoWidth: size.w, logoHeight: size.h, logoVersion: { increment: 1 } },
  });
  revalidatePath("/espace", "layout");
  return done("Logo enregistré.");
}

export async function removeLogo(): Promise<ActionResult> {
  const user = await requirePro();
  await db.business.update({ where: { id: user.businessId }, data: { logo: null, logoWidth: null, logoHeight: null, logoVersion: { increment: 1 } } });
  revalidatePath("/espace", "layout");
  return done("Logo retiré.");
}

// ---------------------------------------------------------------- Étiquette (éditeur)

/**
 * Enregistre le design de l'éditeur. Le document est revalidé ici (schéma strict, QR imposé au
 * premier plan, taille minimale, relecture du QR) : rien de ce que le navigateur envoie n'est cru sur parole.
 * `validate` = le pro valide le design pour ses planches et commandes (refusé s'il reste une erreur).
 */
export async function saveDesignDoc(json: string, validate: boolean): Promise<{ ok: boolean; message: string }> {
  const user = await requirePro();
  if (json.length > 200_000) return { ok: false, message: "Design trop volumineux." };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, message: "Design illisible." };
  }
  const doc = parseDoc(raw);
  if (!doc) return { ok: false, message: "Ce design contient des valeurs non autorisées." };
  await loadServerFonts();
  const b = await db.business.findUniqueOrThrow({ where: { id: user.businessId }, select: LABEL_BUSINESS_SELECT });
  const errors = blockingIssues(renderDoc(doc, dataFor(b, "ABCDEFG")));
  if (validate && errors.length) return { ok: false, message: errors[0]!.message };
  const data = { doc: doc as unknown as Prisma.InputJsonValue, format: doc.format as LabelFormat, templateKey: doc.template ?? "personnalise", ...(validate ? { validatedAt: new Date() } : {}) };
  await db.labelDesign.upsert({ where: { businessId: user.businessId }, create: { businessId: user.businessId, ...data }, update: data });
  revalidatePath("/espace", "layout");
  return { ok: true, message: validate ? "Design validé : il sera utilisé pour vos prochaines planches et commandes." : "Brouillon enregistré." };
}

// ---------------------------------------------------------------- Installation (par étiquette)

const optDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")]).transform((v) => (v ? new Date(`${v}T12:00:00Z`) : null));

export async function saveCode(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePro();
  const parsed = z
    .object({
      id: z.string().min(1).max(40),
      label: text(80),
      equipment: text(80),
      brand: text(60),
      model: text(80),
      installedAt: optDate,
      lastServiceAt: optDate,
      nextServiceAt: optDate,
      publicNote: text(600),
      showInstall: z.boolean(),
    })
    .safeParse({
      id: str(fd, "id"),
      label: str(fd, "label"),
      equipment: str(fd, "equipment"),
      brand: str(fd, "brand"),
      model: str(fd, "model"),
      installedAt: str(fd, "installedAt"),
      lastServiceAt: str(fd, "lastServiceAt"),
      nextServiceAt: str(fd, "nextServiceAt"),
      publicNote: str(fd, "publicNote"),
      showInstall: bool(fd, "showInstall"),
    });
  if (!parsed.success) return zodErrors(parsed.error);
  const { id, ...data } = parsed.data;
  const { count } = await db.qrCode.updateMany({ where: { id, businessId: user.businessId }, data });
  if (count !== 1) return fail("Étiquette introuvable.");
  revalidatePath(`/espace/codes/${id}`);
  return done("Informations enregistrées.");
}

// ---------------------------------------------------------------- Demandes reçues

// ---------------------------------------------------------------- Support

export async function createTicket(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePro();
  const parsed = z
    .object({ subject: z.string().trim().min(3, "Objet trop court").max(120), body: z.string().trim().min(10, "Décrivez votre demande").max(4000) })
    .safeParse({ subject: str(fd, "subject"), body: str(fd, "body") });
  if (!parsed.success) return zodErrors(parsed.error);
  if (!(await rateLimit("ticket", user.businessId, 10, 86400))) return fail("Vous avez déjà ouvert plusieurs demandes aujourd'hui.");
  const ticket = await db.supportTicket.create({
    data: { businessId: user.businessId, subject: parsed.data.subject, messages: { create: { body: parsed.data.body } } },
  });
  void notifyAdmin(`Support : ${parsed.data.subject}`, `${user.email} a ouvert une demande.\n\n${parsed.data.body}\n\n${appUrl()}/admin/support/${ticket.id}`);
  redirect(`/espace/support/${ticket.id}`);
}

export async function replyTicket(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePro();
  const id = str(fd, "id");
  const body = str(fd, "body").trim();
  if (body.length < 2 || body.length > 4000) return { ok: false, errors: { body: "Message vide ou trop long." } };
  const ticket = await db.supportTicket.findFirst({ where: { id, businessId: user.businessId }, select: { id: true, subject: true } });
  if (!ticket) return fail("Demande introuvable.");
  if (!(await rateLimit("ticket-reply", user.businessId, 40, 86400))) return fail("Trop de messages aujourd'hui.");
  await db.$transaction([
    db.supportMessage.create({ data: { ticketId: id, body } }),
    db.supportTicket.update({ where: { id }, data: { status: "OUVERT" } }),
  ]);
  void notifyAdmin(`Support (réponse) : ${ticket.subject}`, `${user.email} :\n\n${body}\n\n${appUrl()}/admin/support/${id}`);
  revalidatePath(`/espace/support/${id}`);
  return { ok: true };
}

// ---------------------------------------------------------------- Compte

const shippingSchema = z.object({
  shipName: z.string().trim().min(2, "Nom requis").max(80),
  shipLine1: z.string().trim().min(3, "Adresse requise").max(120),
  shipLine2: text(120),
  shipPostal: z.string().trim().regex(/^\d{5}$/, "Code postal à 5 chiffres"),
  shipCity: z.string().trim().min(2, "Ville requise").max(80),
  shipPhone: z.string().trim().regex(/^[\d\s+().-]{6,20}$/, "Téléphone requis pour le transporteur"),
});

export async function saveShipping(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePro();
  const parsed = shippingSchema.safeParse(Object.fromEntries(["shipName", "shipLine1", "shipLine2", "shipPostal", "shipCity", "shipPhone"].map((k) => [k, str(fd, k)])));
  if (!parsed.success) return zodErrors(parsed.error);
  await db.business.update({ where: { id: user.businessId }, data: parsed.data });
  revalidatePath("/espace", "layout");
  return done("Adresse de livraison enregistrée.");
}

export async function changeEmail(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePro();
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email("Email invalide").max(160), password: z.string().min(1, "Mot de passe requis") })
    .safeParse({ email: str(fd, "email"), password: str(fd, "password") });
  if (!parsed.success) return zodErrors(parsed.error);
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await rateLimit("reauth", user.id, 10, 900))) return fail("Trop de tentatives. Patientez 15 minutes.");
  if (!(await verifyPassword(parsed.data.password, row.passwordHash))) return { ok: false, errors: { password: "Mot de passe incorrect." } };
  if (parsed.data.email !== user.email && (await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } }))) {
    return { ok: false, errors: { email: "Cet email est déjà utilisé par un autre compte." } };
  }
  if (parsed.data.email === user.email) return done("C'est déjà votre email de connexion.");
  await db.user.update({ where: { id: user.id }, data: { email: parsed.data.email, emailVerifiedAt: null } });
  await sendVerificationEmail(user.id, parsed.data.email).catch((e) => console.error("[verification email]", e));
  revalidatePath("/espace", "layout");
  return done("Email de connexion modifié. Un lien de confirmation vient d'être envoyé à la nouvelle adresse.");
}

export async function changePassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePro();
  const parsed = z
    .object({ current: z.string().min(1, "Mot de passe actuel requis"), next: z.string().min(10, "10 caractères minimum").max(200) })
    .safeParse({ current: str(fd, "current"), next: str(fd, "next") });
  if (!parsed.success) return zodErrors(parsed.error);
  if (!(await rateLimit("reauth", user.id, 10, 900))) return fail("Trop de tentatives. Patientez 15 minutes.");
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(parsed.data.current, row.passwordHash))) return { ok: false, errors: { current: "Mot de passe incorrect." } };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  await revokeAllSessions(user.id, user.sessionId);
  return done("Mot de passe modifié. Vos autres appareils ont été déconnectés.");
}

/**
 * Suppression du compte (RGPD) : la page publique, les étiquettes et les données sont supprimées.
 * Les commandes sont conservées (obligation comptable) sans lien avec le compte.
 */
export async function deleteAccount(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePro();
  if (str(fd, "confirm").trim().toUpperCase() !== "SUPPRIMER") return { ok: false, errors: { confirm: "Tapez SUPPRIMER pour confirmer." } };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(str(fd, "password"), row.passwordHash))) return { ok: false, errors: { password: "Mot de passe incorrect." } };
  const pending = await db.order.count({ where: { businessId: user.businessId, kind: "PRINT", status: { in: ["RECUE", "EN_ATTENTE_VALIDATION", "EN_IMPRESSION", "EXPEDIEE"] } } });
  if (pending > 0) return fail("Une commande d'étiquettes est en cours : attendez sa livraison ou contactez le support.");
  await closeSession();
  await db.user.delete({ where: { id: user.id } });
  redirect("/?compte=supprime");
}
