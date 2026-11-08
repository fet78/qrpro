/** Statuts de commande (libellés et transitions), partagé navigateur / serveur. */

export const ORDER_STATUS = {
  EN_ATTENTE_PAIEMENT: { label: "En attente de paiement", tone: "neutral" },
  RECUE: { label: "Commande reçue", tone: "info" },
  EN_ATTENTE_VALIDATION: { label: "En attente de validation", tone: "warn" },
  EN_IMPRESSION: { label: "En cours d'impression", tone: "info" },
  EXPEDIEE: { label: "Expédiée", tone: "info" },
  LIVREE: { label: "Livrée", tone: "success" },
  TERMINEE: { label: "Terminée", tone: "success" },
  ANNULEE: { label: "Annulée", tone: "danger" },
} as const;

export type OrderStatusKey = keyof typeof ORDER_STATUS;

/** Étapes affichées au client pour une commande d'étiquettes imprimées. */
export const PRINT_STEPS: OrderStatusKey[] = ["RECUE", "EN_ATTENTE_VALIDATION", "EN_IMPRESSION", "EXPEDIEE", "LIVREE"];

/** Statuts que l'administrateur peut appliquer manuellement à une commande payée. */
export const ADMIN_PRINT_STATUSES: OrderStatusKey[] = ["RECUE", "EN_ATTENTE_VALIDATION", "EN_IMPRESSION", "EXPEDIEE", "LIVREE", "ANNULEE"];
