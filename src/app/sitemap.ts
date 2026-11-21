import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Plan du site : la vitrine, les pages légales, et les pages des professionnels en ligne
 * (offre active, compte non désactivé). Les pages par étiquette (/p/<slug>/<code>) n'y figurent pas.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const pros = await db.business.findMany({
    where: { activatedAt: { not: null }, user: { disabledAt: null } },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...["/mentions-legales", "/cgv", "/confidentialite"].map((p) => ({ url: `${base}${p}`, changeFrequency: "yearly" as const, priority: 0.2 })),
    ...pros.map((p) => ({ url: `${base}/p/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
