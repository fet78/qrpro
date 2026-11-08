"use server";

import { after } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { rateLimit, clientIp } from "@/server/rate-limit";
import { queueNotifications, processNotifications } from "@/server/notify/dispatch";
import { fail, str, zodErrors, type ActionResult } from "@/lib/action";
import { CODE_RE } from "@/lib/slug";
import { jpegSize } from "@/lib/images";
import { parsePageConfig } from "@/lib/page/config";
import { FORM_KINDS, FORM_URGENCY, REQUEST_CONTACT, AVAILABILITY_SLOTS, MAX_FILES, MAX_PHOTO_BYTES, MAX_PDF_BYTES, MAX_TOTAL_BYTES, sizeLabel } from "@/lib/page/requests";

export type RequestResult = (NonNullable<ActionResult> & { ref?: string }) | null;

const schema = z.object({
  slug: z.string().min(1).max(60),
  code: z.string().max(12),
  clientKey: z.union([z.literal(""), z.string().regex(/^[\w-]{16,64}$/)]).catch(""),
  kind: z.enum(FORM_KINDS).catch("intervention"),
  name: z.string().trim().min(2, "Indiquez votre nom et prénom").max(80),
  phone: z.string().trim().regex(/^[\d\s+().-]{6,20}$/, "Numéro de téléphone invalide"),
  email: z.union([z.string().trim().email("Email invalide").max(160), z.literal("")]),
  address: z.string().trim().max(200),
  postalCode: z.union([z.literal(""), z.string().trim().regex(/^\d{5}$/, "Code postal à 5 chiffres")]),
  city: z.string().trim().max(80),
  problem: z.string().trim().max(40),
  message: z.string().trim().max(2000, "2000 caractères maximum"),
  urgency: z.enum(FORM_URGENCY).catch("flexible"),
  contactPref: z.enum(Object.keys(REQUEST_CONTACT) as [keyof typeof REQUEST_CONTACT]).catch("appel"),
  slots: z.array(z.enum(AVAILABILITY_SLOTS)).max(AVAILABILITY_SLOTS.length).catch([]),
  availabilityNote: z.string().trim().max(160),
});

type ParsedFile = { data: Uint8Array<ArrayBuffer>; mime: string; name: string; size: number; width: number; height: number };

/** Pièces jointes : photos JPEG (compressées par le navigateur) et documents PDF, vérifiés octet par octet. */
async function readFiles(fd: FormData): Promise<ParsedFile[] | string> {
  const out: ParsedFile[] = [];
  const all = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (all.length > MAX_FILES) return `${MAX_FILES} fichiers maximum.`;
  const total = all.reduce((s, f) => s + f.size, 0);
  if (total > MAX_TOTAL_BYTES) return `Pièces jointes trop lourdes (${sizeLabel(total)}) : ${sizeLabel(MAX_TOTAL_BYTES)} au total maximum. Retirez un fichier.`;
  for (const f of all) {
    const data = new Uint8Array(await f.arrayBuffer());
    const isPdf = data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46; // %PDF
    if (isPdf) {
      if (f.size > MAX_PDF_BYTES) return `Le document « ${f.name.slice(0, 40)} » dépasse ${sizeLabel(MAX_PDF_BYTES)}.`;
      out.push({ data, mime: "application/pdf", name: f.name.slice(0, 80) || "document.pdf", size: f.size, width: 0, height: 0 });
      continue;
    }
    if (f.size > MAX_PHOTO_BYTES) return `Une photo dépasse ${sizeLabel(MAX_PHOTO_BYTES)}.`;
    const size = jpegSize(data);
    if (!size || size.w > 4000 || size.h > 4000) return "Une pièce jointe n'a pas pu être lue (photo ou PDF uniquement).";
    out.push({ data, mime: "image/jpeg", name: f.name.slice(0, 80), size: f.size, width: size.w, height: size.h });
  }
  return out;
}

/**
 * Demande envoyée par un client final depuis la page publique.
 * 1. Tout est validé ici (jamais de confiance dans le navigateur) ;
 * 2. la demande, ses pièces jointes et ses notifications sont enregistrées ensemble (transaction) ;
 * 3. les notifications partent juste après la réponse au client (after) ; le cron reprend les échecs.
 */
export async function requestIntervention(_: ActionResult, fd: FormData): Promise<RequestResult> {
  if (str(fd, "company_site")) return { ok: true }; // robot : on fait comme si de rien n'était
  const parsed = schema.safeParse({
    ...Object.fromEntries(["slug", "code", "clientKey", "kind", "name", "phone", "email", "address", "postalCode", "city", "problem", "message", "urgency", "contactPref", "availabilityNote"].map((k) => [k, str(fd, k)])),
    slots: fd.getAll("slots").map(String),
  });
  if (!parsed.success) return zodErrors(parsed.error);
  const d = parsed.data;

  // Double clic, réseau qui renvoie la requête… : la même clé ne crée jamais deux demandes.
  if (d.clientKey) {
    const existing = await db.interventionRequest.findUnique({ where: { clientKey: d.clientKey }, select: { id: true } });
    if (existing) return { ok: true, message: "Demande envoyée.", ref: existing.id.slice(-6).toUpperCase() };
  }

  const business = await db.business.findUnique({
    where: { slug: d.slug },
    select: { id: true, email: true, notify: true, page: true, showRequestForm: true, activatedAt: true, user: { select: { email: true, disabledAt: true } } },
  });
  if (!business || business.user.disabledAt || !business.showRequestForm) return fail("Cette entreprise ne reçoit pas de demandes en ligne.");
  if (!business.activatedAt) return fail("Cette page n'est pas encore en ligne : les demandes seront reçues dès son activation.");
  const cfg = parsePageConfig(business.page);
  const kind = cfg.requestTypes.includes(d.kind) ? d.kind : cfg.requestTypes[0]!;

  // Règles selon le type de demande et la configuration du pro.
  const errors: Record<string, string> = {};
  if (kind !== "contact" && d.message.length < 5 && !d.problem) errors.message = "Décrivez le problème en quelques mots";
  if (kind === "contact" && d.message.length < 5) errors.message = "Écrivez votre message";
  const needsAddress = (kind === "intervention" || kind === "urgence") && cfg.requestAddress === "required";
  if (needsAddress && (!d.address || !d.city)) errors.address = "Indiquez l'adresse de l'intervention";
  if (d.contactPref === "email" && !d.email) errors.email = "Indiquez votre email pour être recontacté par email.";
  if (Object.keys(errors).length) return { ok: false, errors };

  const files = cfg.requestPhotos ? await readFiles(fd) : [];
  if (typeof files === "string") return fail(files);

  const ip = await clientIp();
  if (!(await rateLimit("intervention-ip", ip, 8, 3600))) return fail("Trop de demandes envoyées. Appelez directement l'entreprise ou réessayez plus tard.");
  if (!(await rateLimit("intervention-biz", business.id, 60, 86400))) return fail("Le service est momentanément saturé. Appelez directement l'entreprise.");

  const code = CODE_RE.test(d.code) ? await db.qrCode.findFirst({ where: { code: d.code, businessId: business.id }, select: { id: true } }) : null;
  const availability = [d.slots.join(", "), d.availabilityNote].filter(Boolean).join(" — ");
  const urgency = kind === "urgence" ? "urgent" : kind === "contact" || kind === "devis" ? "flexible" : d.urgency;

  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      const r = await tx.interventionRequest.create({
        data: {
          businessId: business.id,
          qrCodeId: code?.id ?? null,
          clientKey: d.clientKey || null,
          kind,
          name: d.name,
          phone: d.phone,
          email: d.email,
          address: kind === "contact" ? "" : d.address,
          postalCode: kind === "contact" ? "" : d.postalCode,
          city: kind === "contact" ? "" : d.city,
          problem: kind === "contact" ? "" : d.problem,
          message: d.message || d.problem,
          urgency,
          contactPref: d.contactPref,
          availability: cfg.requestAvailability && kind !== "contact" ? availability.slice(0, 240) : "",
          photos: { create: files.map((f) => ({ data: f.data, mime: f.mime, name: f.name, size: f.size, width: f.width, height: f.height })) },
        },
        select: { id: true, kind: true, urgency: true },
      });
      await queueNotifications(tx, r, { id: business.id, email: business.email, notify: business.notify, userEmail: business.user.email });
      return r.id;
    });
  } catch (e) {
    // Course entre deux envois identiques : la contrainte d'unicité a joué, la demande existe déjà.
    const existing = d.clientKey ? await db.interventionRequest.findUnique({ where: { clientKey: d.clientKey }, select: { id: true } }) : null;
    if (existing) return { ok: true, message: "Demande envoyée.", ref: existing.id.slice(-6).toUpperCase() };
    throw e;
  }
  await db.pageEvent.create({ data: { businessId: business.id, action: "request", withCode: !!code } }).catch(() => undefined);

  // Envoi immédiat, après la réponse : le client n'attend pas les fournisseurs SMS / email.
  after(async () => {
    try {
      await processNotifications({ requestId: id });
    } catch (e) {
      console.error("[notifications] envoi différé en échec, repris par le cron :", e instanceof Error ? e.message : e);
    }
  });
  return { ok: true, message: "Demande envoyée.", ref: id.slice(-6).toUpperCase() };
}
