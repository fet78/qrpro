import "server-only";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { getSettings } from "@/server/settings";
import { appUrl } from "@/lib/env";
import { RETENTION, PURGE_INTERVAL_MS, retentionCutoffs } from "@/lib/retention";

/** Nombre maximal de suppressions de comptes / d'avertissements par passage (reste sous la limite de 60 s). */
const ACCOUNT_BATCH = 50;
const REQUEST_BATCH = 500;

export interface PurgeStats {
  ran: boolean;
  requests?: number;
  pageEvents?: number;
  sessions?: number;
  tokens?: number;
  rateLimits?: number;
  emailUsage?: number;
  stripeEvents?: number;
  warned?: number;
  accountsDeleted?: number;
}

/**
 * Purge automatique des données anciennes, au plus une fois par jour (appelée par le cron des notifications).
 * Ne touche jamais aux commandes ni aux factures (obligation comptable).
 * Les comptes d'essai jamais activés et inactifs sont avertis par email, puis supprimés 14 jours plus tard
 * s'ils ne se sont pas reconnectés. Sans email envoyé, aucun compte n'est supprimé.
 */
export async function runDailyPurge(now = new Date()): Promise<PurgeStats> {
  // Réservation atomique : deux appels simultanés ne purgent pas deux fois. Une seule requête tant que
  // la purge n'est pas due (le cron passe toutes les 10 minutes). La ligne de réglages est créée par le seed.
  const claimed = await db.setting.updateMany({
    where: { id: "main", OR: [{ lastPurgeAt: null }, { lastPurgeAt: { lte: new Date(now.getTime() - PURGE_INTERVAL_MS) } }] },
    data: { lastPurgeAt: now },
  });
  if (claimed.count === 0) return { ran: false };

  const c = retentionCutoffs(now);
  const stats: PurgeStats = { ran: true };

  // Demandes d'intervention anciennes (pièces jointes et notifications supprimées en cascade), par lots.
  const old = await db.interventionRequest.findMany({ where: { createdAt: { lt: c.requests } }, select: { id: true }, take: REQUEST_BATCH });
  stats.requests = old.length ? (await db.interventionRequest.deleteMany({ where: { id: { in: old.map((r) => r.id) } } })).count : 0;

  stats.pageEvents = (await db.pageEvent.deleteMany({ where: { createdAt: { lt: c.pageEvents } } })).count;
  stats.sessions = (await db.session.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  stats.tokens =
    (await db.passwordReset.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } })).count +
    (await db.emailVerification.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  stats.rateLimits = (await db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } })).count;
  stats.emailUsage = (await db.emailUsage.deleteMany({ where: { day: { lt: c.emailUsageDay } } })).count;
  stats.stripeEvents = (await db.processedEvent.deleteMany({ where: { createdAt: { lt: c.stripeEvents } } })).count;

  // Comptes d'essai jamais activés : dernière activité = dernière connexion, sinon création.
  const inactive = (cutoff: Date) => ({
    role: "PRO" as const,
    disabledAt: null,
    business: { is: { activatedAt: null } },
    OR: [{ lastLoginAt: { lt: cutoff } }, { lastLoginAt: null, createdAt: { lt: cutoff } }],
  });

  // 1. Suppression : averti il y a plus de 14 jours, et aucune connexion depuis l'avertissement.
  const toDelete = await db.user.findMany({
    where: { ...inactive(c.inactiveTrial), inactivityWarnedAt: { lt: c.warnedBefore } },
    select: { id: true, inactivityWarnedAt: true, lastLoginAt: true },
    take: ACCOUNT_BATCH,
  });
  const ids = toDelete.filter((u) => !u.lastLoginAt || (u.inactivityWarnedAt && u.lastLoginAt < u.inactivityWarnedAt)).map((u) => u.id);
  // Les commandes éventuelles sont conservées sans lien avec le compte (relation SetNull).
  stats.accountsDeleted = ids.length ? (await db.user.deleteMany({ where: { id: { in: ids } } })).count : 0;

  // 2. Avertissement : pas encore averti depuis la dernière activité.
  const toWarn = await db.user.findMany({
    where: inactive(c.inactiveTrial),
    select: { id: true, email: true, lastLoginAt: true, createdAt: true, inactivityWarnedAt: true },
    take: ACCOUNT_BATCH * 4,
  });
  const { brandName } = await getSettings();
  let warned = 0;
  for (const u of toWarn) {
    if (warned >= ACCOUNT_BATCH) break;
    const lastActivity = u.lastLoginAt ?? u.createdAt;
    if (u.inactivityWarnedAt && u.inactivityWarnedAt > lastActivity) continue;
    const sent = await sendEmail(
      u.email,
      `${brandName} — votre compte d'essai sera supprimé dans ${RETENTION.warningDays} jours`,
      `Bonjour,\n\nVotre compte d'essai ${brandName} n'a pas été utilisé depuis plusieurs mois et l'offre n'a jamais été activée.\n\nPour protéger vos données, il sera supprimé dans ${RETENTION.warningDays} jours, avec sa page et ses étiquettes.\n\nPour le conserver, il suffit de vous connecter :\n${appUrl()}/connexion\n\nSi vous n'en avez plus besoin, vous n'avez rien à faire.`,
    );
    // Sans email réellement envoyé, le compte n'est jamais marqué (donc jamais supprimé).
    if (!sent) continue;
    await db.user.update({ where: { id: u.id }, data: { inactivityWarnedAt: now } });
    warned++;
  }
  stats.warned = warned;
  return stats;
}
