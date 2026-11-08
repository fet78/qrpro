import { z } from "zod";

/**
 * Préférences de notification d'un professionnel (Business.notify).
 *
 * Lancement à 0 € : deux canaux GRATUITS seulement.
 *  - push : notification sur le téléphone / l'ordinateur (Web Push, sans fournisseur payant) — canal principal ;
 *  - email : Resend, offre gratuite uniquement (compteur interne, envoi bloqué avant la limite).
 * Aucun SMS ni WhatsApp (services facturés au message) : rien ne peut déclencher de paiement.
 * Une demande n'est jamais perdue : elle est enregistrée avant tout envoi et reste dans l'espace pro.
 */
export const CHANNELS = ["push", "email"] as const;
export type Channel = (typeof CHANNELS)[number];
/** Canal de secours (email au pro si le push n'a pas pu être remis). Les anciennes valeurs restent lisibles. */
export type LogChannel = Channel | "secours" | "sms" | "whatsapp";

export const CHANNEL_INFO: Record<LogChannel, { label: string }> = {
  push: { label: "Notification sur l'appareil" },
  email: { label: "Email" },
  secours: { label: "Email de secours" },
  sms: { label: "SMS (ancien canal)" },
  whatsapp: { label: "WhatsApp (ancien canal)" },
};

/** always : un email à chaque demande ; fallback : seulement si aucune notification push n'a pu être remise. */
export const EMAIL_MODES = { always: "À chaque demande", fallback: "Seulement si la notification push n'arrive pas" } as const;
export type EmailMode = keyof typeof EMAIL_MODES;

export const notifyPrefsSchema = z.object({
  push: z.object({ on: z.boolean() }),
  email: z.object({
    on: z.boolean(),
    to: z.union([z.literal(""), z.string().trim().email("Email invalide").max(160)]),
    mode: z.enum(["always", "fallback"]),
  }),
});
export type NotifyPrefs = z.infer<typeof notifyPrefsSchema>;

/** Par défaut : push en priorité, email seulement si le push n'aboutit pas (économise le quota gratuit). */
export const DEFAULT_PREFS: NotifyPrefs = {
  push: { on: true },
  email: { on: true, to: "", mode: "fallback" },
};

/** Lit les préférences stockées (anciennes clés SMS / WhatsApp ignorées). */
export function parsePrefs(raw: unknown): NotifyPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const email = (r.email && typeof r.email === "object" ? r.email : {}) as Record<string, unknown>;
  const merged = {
    push: { ...DEFAULT_PREFS.push, ...(r.push && typeof r.push === "object" ? r.push : {}) },
    email: { ...DEFAULT_PREFS.email, ...email, mode: email.mode === "always" || email.mode === "fallback" ? email.mode : raw ? "always" : DEFAULT_PREFS.email.mode },
  };
  const p = notifyPrefsSchema.safeParse(merged);
  return p.success ? p.data : DEFAULT_PREFS;
}
