import "server-only";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { getSettings } from "@/server/settings";
import { appUrl, env, isProd } from "@/lib/env";
import { hashToken, newToken } from "./tokens";

/** Validité d'un lien de confirmation. */
const TTL_MS = 7 * 86400_000;

/**
 * Envoie un lien de confirmation de l'adresse email du compte (inscription, changement d'email, renvoi).
 * Les anciens liens du compte sont invalidés.
 */
export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  const { token, hash } = newToken();
  await db.$transaction([
    db.emailVerification.deleteMany({ where: { userId } }),
    db.emailVerification.create({ data: { tokenHash: hash, userId, email, expiresAt: new Date(Date.now() + TTL_MS) } }),
  ]);
  const link = `${appUrl()}/verifier-email/${token}`;
  const { brandName } = await getSettings();
  await sendEmail(
    email,
    `${brandName} — confirmez votre adresse email`,
    `Bonjour,\n\nPour confirmer votre adresse email, ouvrez ce lien (valable 7 jours) :\n${link}\n\nC'est à cette adresse que nous envoyons vos factures, vos notifications et le lien de mot de passe oublié.\n\nSi vous n'avez pas créé de compte ${brandName}, ignorez cet email.`,
  );
}

/**
 * En développement sans service d'email, aucun email ne part : l'espace pro propose alors un bouton
 * de confirmation directe pour tester le parcours. Jamais en production.
 */
export function devVerificationLinksVisible(): boolean {
  const e = env();
  return !isProd() && !(e.RESEND_API_KEY && e.EMAIL_FROM);
}

/** Confirme l'adresse si le lien est valable et correspond toujours à l'adresse du compte. */
export async function confirmEmailToken(token: string): Promise<"ok" | "expired" | "invalid"> {
  if (!token || token.length > 200) return "invalid";
  const row = await db.emailVerification.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { select: { email: true } } } });
  if (!row) return "invalid";
  if (row.expiresAt < new Date()) return "expired";
  if (row.user.email !== row.email) return "invalid";
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
    db.emailVerification.deleteMany({ where: { userId: row.userId } }),
  ]);
  return "ok";
}
