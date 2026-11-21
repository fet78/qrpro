import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Moteurs de recherche : la vitrine, les pages légales et les pages pro publiques sont indexables ;
 * l'espace pro, l'administration, l'API et les liens de QR / de notification ne le sont pas.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/espace", "/admin", "/api/", "/d/", "/q/", "/connexion", "/inscription", "/mot-de-passe-oublie", "/reinitialiser", "/verifier-email"] }],
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
