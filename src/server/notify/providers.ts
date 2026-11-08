import "server-only";
import webpush from "web-push";
import { env, isProd } from "@/lib/env";
import { sendEmailRich, type EmailResult } from "@/server/email";

/**
 * Canaux d'envoi — uniquement GRATUITS :
 *  - Web Push : protocole standard des navigateurs, sans fournisseur ni abonnement (clés VAPID générées une fois) ;
 *  - Email : Resend, plafonné par l'application sous les limites de l'offre gratuite.
 * Aucun canal facturé au message (SMS, WhatsApp) n'existe dans le code : impossible de déclencher un paiement.
 */

export type SendResult = EmailResult;

export interface ProviderStatus {
  ready: boolean;
  provider: string;
  detail: string;
}

export function emailStatus(): ProviderStatus {
  const e = env();
  return e.RESEND_API_KEY && e.EMAIL_FROM
    ? { ready: true, provider: "Resend (offre gratuite)", detail: `Expéditeur ${e.EMAIL_FROM} · plafond ${e.EMAIL_DAILY_LIMIT}/jour, ${e.EMAIL_MONTHLY_LIMIT}/mois` }
    : { ready: false, provider: "Resend (offre gratuite)", detail: "RESEND_API_KEY et EMAIL_FROM manquants" };
}

export function pushStatus(): ProviderStatus {
  const e = env();
  return e.VAPID_PUBLIC_KEY && e.VAPID_PRIVATE_KEY
    ? { ready: true, provider: "Web Push (gratuit)", detail: "Clés VAPID configurées" }
    : { ready: false, provider: "Web Push (gratuit)", detail: "VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY manquantes (npx web-push generate-vapid-keys)" };
}

export const vapidPublicKey = () => env().VAPID_PUBLIC_KEY ?? null;

export async function sendEmailChannel(to: string, subject: string, text: string, html: string): Promise<SendResult> {
  if (!emailStatus().ready) {
    if (!isProd()) console.info(`\n[notification email non envoyée — Resend non configuré]\nÀ : ${to}\nObjet : ${subject}\n${text}\n`);
    return { ok: false, error: "Email non configuré sur ce site (Resend)", permanent: true };
  }
  return sendEmailRich(to, subject, text, html, "notification");
}

let vapidSet = false;
export async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: object): Promise<SendResult> {
  if (!pushStatus().ready) return { ok: false, error: "Notifications web non configurées (clés VAPID)", permanent: true };
  const e = env();
  if (!vapidSet) {
    webpush.setVapidDetails(e.VAPID_SUBJECT || `mailto:${e.ADMIN_NOTIFY_EMAIL || "contact@example.com"}`, e.VAPID_PUBLIC_KEY!, e.VAPID_PRIVATE_KEY!);
    vapidSet = true;
  }
  try {
    const res = await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 86400, urgency: "high" });
    return { ok: true, providerId: String(res.statusCode) };
  } catch (err) {
    const code = (err as { statusCode?: number }).statusCode;
    // 404 / 410 : l'appareil s'est désabonné (navigateur réinstallé, autorisation retirée).
    return { ok: false, error: `Push ${code ?? ""} ${err instanceof Error ? err.message : ""}`.trim().slice(0, 300), permanent: code === 404 || code === 410 };
  }
}
