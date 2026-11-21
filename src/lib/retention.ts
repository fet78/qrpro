/**
 * Durées de conservation (RGPD). Une seule source : la purge automatique et la politique de confidentialité.
 * Les commandes et factures ne sont jamais purgées ici (obligation comptable de 10 ans).
 */
export const RETENTION = {
  /** Demandes d'intervention (et leurs pièces jointes et notifications). */
  requestsMonths: 24,
  /** Statistiques de consultation des pages. */
  pageEventsMonths: 13,
  /** Compteurs d'emails envoyés (quota gratuit). */
  emailUsageMonths: 3,
  /** Événements Stripe déjà traités (anti-doublon des webhooks). */
  stripeEventsDays: 90,
  /** Compte d'essai jamais activé, sans connexion depuis… */
  inactiveTrialMonths: 6,
  /** Délai entre l'email d'avertissement et la suppression. */
  warningDays: 14,
} as const;

/** Intervalle minimal entre deux purges (le cron passe toutes les 10 minutes). */
export const PURGE_INTERVAL_MS = 20 * 3600_000;

function monthsBefore(now: Date, months: number): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

export interface RetentionCutoffs {
  requests: Date;
  pageEvents: Date;
  /** Jour au format AAAA-MM-JJ (UTC) : les compteurs antérieurs sont supprimés. */
  emailUsageDay: string;
  stripeEvents: Date;
  /** Dernière activité avant cette date : compte d'essai à avertir. */
  inactiveTrial: Date;
  /** Avertissement envoyé avant cette date : compte à supprimer (s'il est resté inactif). */
  warnedBefore: Date;
}

export function retentionCutoffs(now: Date): RetentionCutoffs {
  return {
    requests: monthsBefore(now, RETENTION.requestsMonths),
    pageEvents: monthsBefore(now, RETENTION.pageEventsMonths),
    emailUsageDay: monthsBefore(now, RETENTION.emailUsageMonths).toISOString().slice(0, 10),
    stripeEvents: new Date(now.getTime() - RETENTION.stripeEventsDays * 86400_000),
    inactiveTrial: new Date(monthsBefore(now, RETENTION.inactiveTrialMonths).getTime() + RETENTION.warningDays * 86400_000),
    warnedBefore: new Date(now.getTime() - RETENTION.warningDays * 86400_000),
  };
}

/** Une purge est due si aucune n'a eu lieu depuis PURGE_INTERVAL_MS. */
export function purgeDue(lastPurgeAt: Date | null, now: Date): boolean {
  return !lastPurgeAt || now.getTime() - lastPurgeAt.getTime() >= PURGE_INTERVAL_MS;
}
