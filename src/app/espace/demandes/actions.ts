"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { done, str, zodErrors, type ActionResult } from "@/lib/action";
import { STATUS_KEYS } from "@/lib/page/requests";

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(STATUS_KEYS as [string, ...string[]]),
  /** Date ISO avec fuseau, calculée par le navigateur du pro (heure locale exacte, été comme hiver). */
  scheduledAt: z.union([z.literal(""), z.iso.datetime({ offset: true, message: "Date invalide" })]),
  note: z.string().trim().max(2000, "2000 caractères maximum"),
});

/** Suivi d'une demande : statut, rendez-vous, note interne (jamais visible du client). */
export async function updateRequest(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const user = await requirePro();
  const parsed = updateSchema.safeParse({ id: str(fd, "id"), status: str(fd, "status"), scheduledAt: str(fd, "scheduledAt"), note: str(fd, "note") });
  if (!parsed.success) return zodErrors(parsed.error);
  const { id, status, scheduledAt, note } = parsed.data;
  if (status === "planifiee" && !scheduledAt) return { ok: false, errors: { scheduledAt: "Indiquez la date du rendez-vous" } };
  const { count } = await db.interventionRequest.updateMany({
    where: { id, businessId: user.businessId },
    data: {
      status,
      note,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      handledAt: status === "terminee" ? new Date() : null,
      readAt: new Date(),
    },
  });
  if (!count) return { ok: false, message: "Demande introuvable." };
  revalidatePath("/espace", "layout");
  return done("Demande mise à jour.");
}

/** Changement rapide de statut depuis la liste ou les boutons de la fiche. */
export async function quickStatus(fd: FormData): Promise<void> {
  const user = await requirePro();
  const status = str(fd, "status");
  if (!(STATUS_KEYS as string[]).includes(status)) return;
  await db.interventionRequest.updateMany({
    where: { id: str(fd, "id"), businessId: user.businessId },
    data: { status, handledAt: status === "terminee" ? new Date() : null, readAt: new Date() },
  });
  revalidatePath("/espace", "layout");
}

/** Suppression définitive (données personnelles du client et pièces jointes), sur demande du pro. */
export async function deleteRequest(fd: FormData): Promise<void> {
  const user = await requirePro();
  await db.interventionRequest.deleteMany({ where: { id: str(fd, "id"), businessId: user.businessId } });
  revalidatePath("/espace", "layout");
  redirect("/espace/demandes?supprimee=1");
}
