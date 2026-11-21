"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { rateLimit } from "@/server/rate-limit";
import { devVerificationLinksVisible, sendVerificationEmail } from "@/server/auth/email-verification";
import { done, fail, type ActionResult } from "@/lib/action";

/** Renvoie le lien de confirmation de l'adresse email du compte. */
export async function resendVerification(): Promise<ActionResult> {
  const user = await requirePro();
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailVerifiedAt: true } });
  if (row.emailVerifiedAt) return done("Votre adresse est déjà confirmée.");
  if (!(await rateLimit("verify-resend", user.id, 3, 3600))) return fail("Lien déjà renvoyé plusieurs fois. Réessayez dans une heure.");
  await sendVerificationEmail(user.id, user.email);
  return done(`Lien envoyé à ${user.email}. Pensez à regarder dans les indésirables.`);
}

/** Développement sans service d'email uniquement : confirme directement l'adresse (jamais en production). */
export async function confirmEmailDev(): Promise<ActionResult> {
  if (!devVerificationLinksVisible()) return fail("Indisponible.");
  const user = await requirePro();
  await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  await db.emailVerification.deleteMany({ where: { userId: user.id } });
  revalidatePath("/espace", "layout");
  return done("Adresse confirmée (mode développement).");
}
