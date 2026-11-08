import type { DayHours } from "@/lib/hours";
import type { PageConfig } from "@/lib/page/config";

export interface PublicPageData {
  slug: string;
  name: string;
  trade: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  zone: string;
  description: string;
  website: string;
  emergency: string;
  hours: DayHours[];
  hoursNote: string;
  accent: string;
  logoUrl: string | null;
  services: { title: string; description: string; price?: string }[];
  tips: { title: string; body: string; url: string }[];
  tipsEnabled: boolean;
  showRequestForm: boolean;
  brandName: string;
  /** Configuration de la vitrine (style, sections, boutons…). */
  page: PageConfig;
  photos: { id: string; url: string; w: number; h: number; caption: string }[];
  /** URL publique de la page (partage, vCard). */
  pageUrl: string;
  /** Étiquette scannée (facultatif) et ses informations d'installation si le pro les publie. */
  code: string | null;
  install: {
    label: string;
    equipment: string;
    brand: string;
    model: string;
    installedAt: string | null;
    lastServiceAt: string | null;
    nextServiceAt: string | null;
    publicNote: string;
  } | null;
}
