import type { MetadataRoute } from "next";
import { getSettings } from "@/server/settings";

/**
 * Généré à chaque demande (et non au build) : le build n'a pas besoin d'accéder à la base,
 * et un changement du nom de la marque dans l'admin s'applique sans redéployer.
 */
export const dynamic = "force-dynamic";

/**
 * Application web installable (« Ajouter à l'écran d'accueil ») : sur iPhone, c'est la condition
 * pour recevoir les notifications web (iOS 16.4 et plus). L'espace s'ouvre directement sur les demandes.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  return {
    name: `${s.brandName} — mes demandes`,
    short_name: s.brandName,
    description: "Recevez et gérez les demandes de vos clients.",
    start_url: "/espace/demandes",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1D4ED8",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
