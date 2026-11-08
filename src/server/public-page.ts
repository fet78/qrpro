import "server-only";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { appUrl } from "@/lib/env";
import { parseHours } from "@/lib/hours";
import { parsePageConfig } from "@/lib/page/config";
import type { PublicPageData } from "@/components/public-page/types";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function logoUrl(b: { id: string; logo?: unknown; logoVersion: number; hasLogo?: boolean }): string | null {
  const has = b.hasLogo ?? !!b.logo;
  return has ? `/api/logo/${b.id}?v=${b.logoVersion}` : null;
}

export function photoUrl(id: string) {
  return `/api/photos/${id}`;
}

/** Données publiques d'une entreprise (jamais l'email du compte, les crédits ou l'adresse de livraison). */
export async function loadPublicBusiness(slug: string) {
  return db.business.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, name: true, trade: true, phone: true, email: true, address: true, postalCode: true, city: true,
      zone: true, description: true, website: true, emergency: true, hours: true, hoursNote: true, accent: true,
      tipsEnabled: true, showRequestForm: true, logoVersion: true, logoWidth: true, userId: true, page: true, activatedAt: true,
      user: { select: { disabledAt: true } },
      services: { orderBy: { position: "asc" }, select: { title: true, description: true, price: true } },
      tips: { orderBy: { position: "asc" }, select: { title: true, body: true, url: true } },
      photos: { where: { usage: "gallery" }, orderBy: { position: "asc" }, select: { id: true, width: true, height: true, caption: true } },
    },
  });
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadPublicBusiness>>>;

export async function toPublicData(
  b: Loaded,
  code: { code: string; showInstall: boolean; label: string; equipment: string; brand: string; model: string; installedAt: Date | null; lastServiceAt: Date | null; nextServiceAt: Date | null; publicNote: string } | null,
): Promise<PublicPageData> {
  const s = await getSettings();
  return {
    slug: b.slug,
    name: b.name,
    trade: b.trade,
    phone: b.phone,
    email: b.email,
    address: b.address,
    postalCode: b.postalCode,
    city: b.city,
    zone: b.zone,
    description: b.description,
    website: b.website,
    emergency: b.emergency,
    hours: parseHours(b.hours),
    hoursNote: b.hoursNote,
    accent: b.accent,
    logoUrl: logoUrl({ id: b.id, logoVersion: b.logoVersion, hasLogo: b.logoWidth != null }),
    services: b.services,
    tips: b.tips,
    tipsEnabled: b.tipsEnabled,
    showRequestForm: b.showRequestForm,
    brandName: s.brandName,
    page: parsePageConfig(b.page),
    photos: b.photos.map((p) => ({ id: p.id, url: photoUrl(p.id), w: p.width, h: p.height, caption: p.caption })),
    pageUrl: `${appUrl()}/p/${b.slug}`,
    code: code?.code ?? null,
    install:
      code && code.showInstall
        ? {
            label: code.label,
            equipment: code.equipment,
            brand: code.brand,
            model: code.model,
            installedAt: iso(code.installedAt),
            lastServiceAt: iso(code.lastServiceAt),
            nextServiceAt: iso(code.nextServiceAt),
            publicNote: code.publicNote,
          }
        : null,
  };
}
