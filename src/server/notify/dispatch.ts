import "server-only";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { parsePrefs, type LogChannel } from "@/lib/notify/prefs";
import type { Prisma } from "@/generated/prisma/client";
import { emailMessage, pushPayload, type RequestForNotif } from "./message";
import { sendEmailChannel, sendPush, type SendResult } from "./providers";

/**
 * File d'envoi des notifications (« outbox ») :
 *  1. la demande et ses lignes de notification sont créées dans la MÊME transaction : rien n'est perdu ;
 *  2. chaque ligne (demande × canal) est unique en base : jamais deux SMS pour la même demande ;
 *  3. une ligne est « réservée » atomiquement avant l'envoi, puis passe à envoyé / échec ;
 *  4. un échec temporaire est retenté (au plus tôt 1, 5 puis 30 min après, au passage suivant du cron, toutes les 10 min) ; si la notification push n'a pas pu être
 *     remise (aucun appareil, échec définitif), un email de secours part vers le pro ;
 *  5. canaux GRATUITS uniquement (push, email dans la limite gratuite) : une limite atteinte bloque
 *     l'envoi proprement (statut « non envoyé » + raison), sans jamais rien facturer ;
 *  6. /api/cron/notifications reprend ce qui est en attente (serveur redémarré, fournisseur en panne…).
 */

const MAX_ATTEMPTS = 4;
const BACKOFF_MIN = [1, 5, 30];
const LEASE_MS = 5 * 60_000;

type Tx = Prisma.TransactionClient;

/**
 * Crée les lignes de notification d'une nouvelle demande (dans la transaction de la demande).
 * Le push passe en premier ; l'email part à chaque demande (mode « always ») ou seulement en secours.
 */
export async function queueNotifications(tx: Tx, req: { id: string; kind: string; urgency: string }, business: { id: string; email: string; notify: unknown; userEmail: string }) {
  const prefs = parsePrefs(business.notify);
  const emailTo = prefs.email.to || business.email || business.userEmail;
  const rows: { channel: LogChannel; recipient: string }[] = [];
  if (prefs.push.on) rows.push({ channel: "push", recipient: "appareils" });
  if (prefs.email.on && (prefs.email.mode === "always" || !prefs.push.on)) rows.push({ channel: "email", recipient: emailTo });
  // Aucun canal actif : un email garantit que la demande n'est pas ignorée.
  if (!rows.length) rows.push({ channel: "secours", recipient: emailTo });
  await tx.notificationLog.createMany({ data: rows.map((r) => ({ requestId: req.id, businessId: business.id, channel: r.channel, recipient: r.recipient })), skipDuplicates: true });
}

async function loadRequest(id: string): Promise<(RequestForNotif & { businessId: string }) | null> {
  const r = await db.interventionRequest.findUnique({
    where: { id },
    include: { photos: { select: { id: true, mime: true, name: true }, orderBy: { createdAt: "asc" } }, qrCode: { select: { code: true, label: true, equipment: true, main: true } } },
  });
  if (!r) return null;
  return { ...r, files: r.photos, code: r.qrCode && !r.qrCode.main ? r.qrCode : null };
}

async function deliver(log: { channel: string; recipient: string; businessId: string }, r: RequestForNotif, brand: string): Promise<SendResult & { skip?: boolean }> {
  switch (log.channel) {
    case "email":
    case "secours": {
      const m = emailMessage(r, brand);
      const subject = log.channel === "secours" ? `${m.subject} (secours)` : m.subject;
      return sendEmailChannel(log.recipient, subject, m.text, m.html);
    }
    case "sms":
    case "whatsapp":
      // Canaux payants retirés : une ancienne ligne n'est jamais envoyée.
      return { ok: false, skip: true, error: "Canal payant désactivé (lancement à 0 €)" };
    case "push": {
      const subs = await db.pushSubscription.findMany({ where: { businessId: log.businessId } });
      if (!subs.length) return { ok: false, skip: true, error: "Aucun appareil enregistré pour les notifications" };
      const payload = pushPayload(r);
      const results = await Promise.all(subs.map(async (s) => ({ s, res: await sendPush(s, payload) })));
      for (const { s, res } of results) {
        if (res.ok) await db.pushSubscription.update({ where: { id: s.id }, data: { lastOkAt: new Date() } });
        else if (res.permanent) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
      }
      const okCount = results.filter((x) => x.res.ok).length;
      if (okCount) return { ok: true, providerId: `${okCount}/${subs.length} appareil(s)` };
      const allPermanent = results.every((x) => x.res.permanent);
      return { ok: false, error: results[0]?.res.error ?? "Échec", permanent: allPermanent };
    }
    default:
      return { ok: false, error: "Canal inconnu", permanent: true };
  }
}

/** Push non remis : email de secours vers le pro, sauf si un email est déjà parti ou si la limite gratuite est atteinte. */
async function ensureFallback(requestId: string, businessId: string) {
  const emailed = await db.notificationLog.findFirst({ where: { requestId, channel: { in: ["email", "secours"] }, status: { in: ["envoye", "en_attente", "envoi"] } } });
  if (emailed) return;
  const b = await db.business.findUnique({ where: { id: businessId }, select: { email: true, notify: true, user: { select: { email: true } } } });
  if (!b) return;
  const to = parsePrefs(b.notify).email.to || b.email || b.user.email;
  await db.notificationLog.createMany({ data: [{ requestId, businessId, channel: "secours", recipient: to }], skipDuplicates: true });
}

/**
 * Envoie ce qui est dû. `requestId` : uniquement cette demande (juste après sa création) ;
 * sinon, reprise générale (cron). Sûr en parallèle : chaque ligne est réservée atomiquement.
 */
export async function processNotifications(opts: { requestId?: string; limit?: number } = {}): Promise<{ sent: number; failed: number; skipped: number }> {
  const now = new Date();
  const due = await db.notificationLog.findMany({
    where: {
      ...(opts.requestId ? { requestId: opts.requestId } : {}),
      OR: [
        { status: { in: ["en_attente", "echec"] }, nextAttemptAt: { lte: now }, attempts: { lt: MAX_ATTEMPTS } },
        { status: "envoi", nextAttemptAt: { lte: now } }, // envoi interrompu (serveur arrêté pendant l'envoi)
      ],
    },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 50,
  });
  const stats = { sent: 0, failed: 0, skipped: 0 };
  if (!due.length) return stats;
  const { brandName } = await getSettings();
  const cache = new Map<string, Awaited<ReturnType<typeof loadRequest>>>();

  for (const log of due) {
    // Réservation : une seule exécution peut envoyer cette ligne.
    const { count } = await db.notificationLog.updateMany({
      where: { id: log.id, status: log.status, attempts: log.attempts },
      data: { status: "envoi", attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + LEASE_MS) },
    });
    if (count !== 1) continue;
    if (!cache.has(log.requestId)) cache.set(log.requestId, await loadRequest(log.requestId));
    const r = cache.get(log.requestId);
    if (!r) continue;

    let res: SendResult & { skip?: boolean };
    try {
      res = await deliver(log, r, brandName);
    } catch (e) {
      res = { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "Erreur inattendue" };
    }
    const attempts = log.attempts + 1;
    if (res.ok) {
      await db.notificationLog.update({ where: { id: log.id }, data: { status: "envoye", sentAt: new Date(), providerId: res.providerId ?? "", lastError: "" } });
      stats.sent++;
    } else if (res.quota) {
      // Limite gratuite atteinte : pas d'envoi, pas de nouvel essai coûteux, raison visible par le pro.
      await db.notificationLog.update({ where: { id: log.id }, data: { status: "ignore", lastError: res.error ?? "Limite gratuite atteinte" } });
      stats.skipped++;
    } else if (res.skip) {
      await db.notificationLog.update({ where: { id: log.id }, data: { status: "ignore", lastError: res.error ?? "" } });
      stats.skipped++;
      if (log.channel === "push") await ensureFallback(log.requestId, log.businessId);
    } else {
      const final = res.permanent || attempts >= MAX_ATTEMPTS;
      await db.notificationLog.update({
        where: { id: log.id },
        data: { status: "echec", lastError: res.error ?? "Échec", nextAttemptAt: final ? new Date(8.64e15) : new Date(Date.now() + (BACKOFF_MIN[attempts - 1] ?? 30) * 60_000), ...(final ? { attempts: MAX_ATTEMPTS } : {}) },
      });
      stats.failed++;
      if (final && log.channel === "push") await ensureFallback(log.requestId, log.businessId);
    }
  }
  // Un secours ajouté pendant ce passage part tout de suite.
  if (opts.requestId) {
    const pendingFallback = await db.notificationLog.count({ where: { requestId: opts.requestId, channel: "secours", status: "en_attente" } });
    if (pendingFallback) {
      const more = await processNotifications({ requestId: opts.requestId, limit: 2 });
      stats.sent += more.sent;
      stats.failed += more.failed;
    }
  }
  return stats;
}
