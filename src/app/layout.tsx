import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getSettings } from "@/server/settings";
import "./globals.css";

/** Le nom de la marque vient de la base : aucune page n'est figée au build (pas besoin de la base pendant le build). */
export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    title: { default: `${s.brandName} — QR codes professionnels pour artisans`, template: `%s · ${s.brandName}` },
    description: s.tagline,
    // Installable sur l'écran d'accueil (notifications web sur iPhone).
    appleWebApp: { capable: true, title: s.brandName, statusBarStyle: "default" },
    icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
