import "server-only";
import { z } from "zod";

/** Environnement serveur, validé au premier accès. Aucune de ces valeurs n'atteint le navigateur. */
const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),
  /** Connexions par instance. Facultatif : 1 en serverless (Netlify, Vercel), 5 sur un serveur classique. */
  DATABASE_POOL_MAX: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(1).max(50).optional()),
  APP_URL: z.string().url().default("http://localhost:3500"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET doit contenir au moins 32 caractères"),
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,
  /** Email qui reçoit les alertes (nouvelle commande, nouveau ticket). Facultatif. */
  ADMIN_NOTIFY_EMAIL: optional,

  // ---- Notifications des nouvelles demandes : canaux GRATUITS uniquement (aucun SMS / WhatsApp)
  /** Offre gratuite Resend : l'application s'arrête d'elle-même avant ces limites (aucun dépassement facturé). */
  EMAIL_DAILY_LIMIT: z.coerce.number().int().min(1).max(100000).default(100),
  EMAIL_MONTHLY_LIMIT: z.coerce.number().int().min(1).max(10000000).default(3000),
  /** Notifications web (gratuites) : clés VAPID générées par `npx web-push generate-vapid-keys`. */
  VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: optional,
  /** Secret de l'appel périodique de reprise des envois (GET /api/cron/notifications). */
  CRON_SECRET: optional,
});

export type ServerEnv = z.infer<typeof schema>;
let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Configuration invalide :\n- ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n- ")}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.STRIPE_SECRET_KEY && !parsed.data.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET est requis en production quand Stripe est activé.");
  }
  cached = parsed.data;
  return cached;
}

export const isProd = () => env().NODE_ENV === "production";
export const appUrl = () => env().APP_URL.replace(/\/$/, "");
/** Paiement simulé : uniquement hors production ET sans clé Stripe. Jamais en ligne. */
export const paymentSimulated = () => !isProd() && !env().STRIPE_SECRET_KEY;
