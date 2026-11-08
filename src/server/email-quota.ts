import "server-only";
import { db } from "@/server/db";
import { env } from "@/lib/env";

/**
 * Compteur d'emails pour rester DANS l'offre gratuite de Resend (100 emails / jour, 3 000 / mois à ce jour).
 * Chaque envoi réserve une place AVANT d'appeler Resend ; si la limite est atteinte, l'email n'est pas envoyé :
 * aucun dépassement, aucune facturation. Une marge est gardée pour les emails de compte
 * (mot de passe oublié, confirmation de commande) : les notifications s'arrêtent un peu avant.
 */
export type EmailKind = "notification" | "account";

const DAY_RESERVE = 10;
const MONTH_RESERVE = 100;

export function emailLimits() {
  const e = env();
  return { day: e.EMAIL_DAILY_LIMIT, month: e.EMAIL_MONTHLY_LIMIT };
}

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const monthPrefix = (d = new Date()) => d.toISOString().slice(0, 7);

export async function emailUsage(now = new Date()): Promise<{ today: number; month: number; day: number; monthLimit: number; notificationsBlocked: boolean; allBlocked: boolean }> {
  const rows = await db.emailUsage.findMany({ where: { day: { startsWith: monthPrefix(now) } } });
  const today = rows.find((r) => r.day === dayKey(now))?.count ?? 0;
  const month = rows.reduce((s, r) => s + r.count, 0);
  const lim = emailLimits();
  return {
    today,
    month,
    day: lim.day,
    monthLimit: lim.month,
    notificationsBlocked: today >= lim.day - DAY_RESERVE || month >= lim.month - MONTH_RESERVE,
    allBlocked: today >= lim.day || month >= lim.month,
  };
}

/**
 * Réserve une place d'envoi. Atomique pour la journée (UPDATE … WHERE count < limite) ;
 * le total mensuel est vérifié juste avant. Renvoie null si l'envoi est autorisé, sinon la raison.
 */
export async function reserveEmail(kind: EmailKind, now = new Date()): Promise<string | null> {
  const lim = emailLimits();
  const dayCap = kind === "notification" ? lim.day - DAY_RESERVE : lim.day;
  const monthCap = kind === "notification" ? lim.month - MONTH_RESERVE : lim.month;
  const usage = await emailUsage(now);
  if (usage.month >= monthCap) return `Limite gratuite mensuelle d'emails atteinte (${usage.month}/${lim.month}).`;
  const day = dayKey(now);
  await db.emailUsage.upsert({ where: { day }, create: { day, count: 0 }, update: {} });
  const updated = await db.$executeRaw`UPDATE "EmailUsage" SET "count" = "count" + 1, "updatedAt" = NOW() WHERE "day" = ${day} AND "count" < ${dayCap}`;
  if (updated !== 1) return `Limite gratuite quotidienne d'emails atteinte (${lim.day} par jour) : reprise demain.`;
  return null;
}

/** L'email n'est finalement pas parti (refus de Resend, réseau) : la place est rendue. */
export async function releaseEmail(now = new Date()): Promise<void> {
  await db.$executeRaw`UPDATE "EmailUsage" SET "count" = GREATEST("count" - 1, 0) WHERE "day" = ${dayKey(now)}`;
}

/** Resend signale lui-même un quota atteint (compte partagé, autre application…) : on bloque jusqu'à demain. */
export async function markDayExhausted(now = new Date()): Promise<void> {
  const day = dayKey(now);
  const { day: cap } = emailLimits();
  await db.emailUsage.upsert({ where: { day }, create: { day, count: cap }, update: { count: cap } });
}
