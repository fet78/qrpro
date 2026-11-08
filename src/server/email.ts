import "server-only";
import { env, isProd } from "@/lib/env";
import { getSettings } from "@/server/settings";
import { reserveEmail, releaseEmail, markDayExhausted, type EmailKind } from "@/server/email-quota";

/**
 * Envoi d'emails via l'API Resend. Sans RESEND_API_KEY + EMAIL_FROM, l'email n'est PAS envoyé :
 * en développement il est affiché dans la console du serveur, en production un avertissement est journalisé.
 * Un échec d'envoi n'interrompt jamais l'action en cours (commande, demande…).
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    if (isProd()) console.warn(`[email] Resend non configuré : email « ${subject} » non envoyé.`);
    else console.info(`\n[email non envoyé — Resend non configuré]\nÀ : ${to}\nObjet : ${subject}\n${text}\n`);
    return false;
  }
  const { brandName } = await getSettings();
  const res = await sendEmailRich(to, subject, text, toHtml(text, brandName), "account");
  if (!res.ok) console.error(`[email] « ${subject} » non envoyé : ${res.error}`);
  return res.ok;
}

export interface EmailResult {
  ok: boolean;
  providerId?: string;
  error?: string;
  permanent?: boolean;
  /** Limite gratuite atteinte : envoi bloqué volontairement (aucun dépassement facturé). */
  quota?: boolean;
}

/**
 * Envoi via Resend, TOUJOURS dans l'offre gratuite : une place est réservée dans le compteur avant l'appel
 * (src/server/email-quota.ts) ; à la limite, l'email n'est pas envoyé et la raison est renvoyée.
 */
export async function sendEmailRich(to: string, subject: string, text: string, html: string, kind: EmailKind = "notification"): Promise<EmailResult> {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY || !EMAIL_FROM) return { ok: false, error: "Email non configuré (Resend)", permanent: true };
  const blocked = await reserveEmail(kind);
  if (blocked) return { ok: false, error: blocked, quota: true };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (res.status === 429 && /quota/i.test(`${json.name ?? ""} ${json.message ?? ""}`)) {
      // Resend signale lui-même la limite atteinte : on arrête jusqu'à demain.
      await markDayExhausted();
      return { ok: false, error: "Limite gratuite d'emails atteinte chez Resend : reprise demain.", quota: true };
    }
    if (!res.ok) {
      await releaseEmail();
      return { ok: false, error: `Resend ${res.status} : ${json.message ?? "refus"}`.slice(0, 300), permanent: res.status === 422 || res.status === 403 };
    }
    return { ok: true, providerId: json.id };
  } catch (err) {
    await releaseEmail();
    return { ok: false, error: `Resend injoignable : ${err instanceof Error ? err.message : "erreur"}` };
  }
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toHtml(text: string, brand: string): string {
  const body = esc(text)
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1D4ED8">$1</a>')}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0F172A;max-width:560px;margin:0 auto;padding:24px"><div style="font-weight:700;font-size:16px;margin-bottom:20px">${esc(brand)}</div>${body}</div>`;
}

export async function notifyAdmin(subject: string, text: string): Promise<void> {
  const to = env().ADMIN_NOTIFY_EMAIL;
  if (to) await sendEmail(to, subject, text);
}
