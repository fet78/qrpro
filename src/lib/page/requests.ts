/**
 * Demandes des clients finaux : vocabulaire partagé (formulaire public, notifications, espace pro).
 * Les anciennes valeurs (panne, entretien, autre, semaine) restent lisibles.
 */

/** Ce que le client veut faire (choisi en haut du formulaire, ou par le bouton de la page). */
export const REQUEST_KINDS = {
  intervention: "Demande d'intervention",
  devis: "Demande de devis",
  urgence: "Urgence",
  contact: "Message",
  // anciennes valeurs
  panne: "Panne / dépannage",
  entretien: "Entretien",
  autre: "Autre",
} as const;
export type RequestKind = keyof typeof REQUEST_KINDS;
/** Types proposés aux clients aujourd'hui. */
export const FORM_KINDS = ["intervention", "devis", "urgence", "contact"] as const;
export type FormKind = (typeof FORM_KINDS)[number];

export const REQUEST_URGENCY = {
  urgent: "Urgent (aujourd'hui)",
  rapide: "Sous 48 h",
  flexible: "Pas pressé",
  semaine: "Cette semaine",
} as const;
export type Urgency = keyof typeof REQUEST_URGENCY;
export const FORM_URGENCY = ["urgent", "rapide", "flexible"] as const;

export const REQUEST_CONTACT = { appel: "Appel", sms: "SMS", whatsapp: "WhatsApp", email: "Email" } as const;

export const AVAILABILITY_SLOTS = ["Dès que possible", "Matin", "Midi", "Après-midi", "Soir", "Samedi"] as const;

/** Problèmes proposés par défaut (le pro les adapte dans « Ma page »). */
export const DEFAULT_PROBLEMS = [
  "Chaudière en panne",
  "Pas d'eau chaude",
  "Radiateurs froids",
  "Fuite d'eau",
  "Canalisation bouchée",
  "Pompe à chaleur",
  "Entretien annuel",
  "Autre",
];

/** Suivi d'une demande dans l'espace pro. */
export const REQUEST_STATUS = {
  nouvelle: { label: "Nouvelle", tone: "info" },
  en_cours: { label: "En cours", tone: "warn" },
  planifiee: { label: "Planifiée", tone: "info" },
  terminee: { label: "Terminée", tone: "success" },
  annulee: { label: "Annulée", tone: "neutral" },
} as const;
export type RequestStatus = keyof typeof REQUEST_STATUS;
export const STATUS_KEYS = Object.keys(REQUEST_STATUS) as RequestStatus[];
export const OPEN_STATUSES: RequestStatus[] = ["nouvelle", "en_cours", "planifiee"];

export const kindLabel = (k: string) => REQUEST_KINDS[k as RequestKind] ?? "Demande";
export const urgencyLabel = (u: string) => REQUEST_URGENCY[u as Urgency] ?? "";
export const isUrgent = (r: { kind: string; urgency: string }) => r.kind === "urgence" || r.urgency === "urgent";

/**
 * Pièces jointes acceptées. Le total reste sous 4 Mo : les hébergeurs serverless refusent les requêtes
 * plus lourdes (Netlify : 6 Mo encodés, soit environ 4,5 Mo de fichiers ; Vercel : 4,5 Mo).
 * Les photos sont réduites dans le navigateur (≈ 0,3 à 0,6 Mo chacune) : 5 photos tiennent largement.
 */
export const MAX_FILES = 5;
export const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
export const MAX_PDF_BYTES = 2 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

/** « 1,4 Mo » / « 350 Ko » pour les messages. */
export function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}
