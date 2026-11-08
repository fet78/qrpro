"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Globe, Palette, QrCode, ShoppingBag, Package, Inbox, LifeBuoy, Settings, LogOut, ExternalLink, Menu, X,
  Users, Tags, Layers, ScrollText, BarChart3, BellRing,
} from "lucide-react";
import { BrandMark } from "./brand";
import { logout } from "@/app/(auth)/actions";
import clsx from "clsx";

const NAV = {
  pro: [
    { href: "/espace", label: "Tableau de bord", icon: LayoutDashboard },
    { href: "/espace/page", label: "Ma page", icon: Globe },
    { href: "/espace/etiquette", label: "Mon étiquette", icon: Palette },
    { href: "/espace/codes", label: "Mes fichiers", icon: QrCode },
    { href: "/espace/commander", label: "Offre & commande", icon: ShoppingBag },
    { href: "/espace/commandes", label: "Mes commandes", icon: Package },
    { href: "/espace/demandes", label: "Demandes reçues", icon: Inbox },
    { href: "/espace/notifications", label: "Notifications", icon: BellRing },
    { href: "/espace/support", label: "Support", icon: LifeBuoy },
    { href: "/espace/compte", label: "Compte", icon: Settings },
  ],
  admin: [
    { href: "/admin", label: "Vue d'ensemble", icon: BarChart3 },
    { href: "/admin/commandes", label: "Commandes", icon: Package },
    { href: "/admin/clients", label: "Clients", icon: Users },
    { href: "/admin/qrcodes", label: "QR codes", icon: QrCode },
    { href: "/admin/tarifs", label: "Tarifs", icon: Tags },
    { href: "/admin/modeles", label: "Modèles d'étiquettes", icon: Layers },
    { href: "/admin/support", label: "Support", icon: LifeBuoy },
    { href: "/admin/reglages", label: "Réglages", icon: ScrollText },
  ],
};

export function AppShell({
  brandName, area, title, subtitle, badges = {}, footer, children,
}: {
  brandName: string;
  area: "pro" | "admin";
  title: string;
  subtitle: string;
  badges?: Record<string, number>;
  footer?: { label: string; href: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV[area];
  const root = area === "pro" ? "/espace" : "/admin";
  const isActive = (href: string) => (href === root ? pathname === root : pathname.startsWith(href));

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={clsx(
            "group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition",
            isActive(href) ? "bg-surface font-medium text-ink shadow-card" : "text-muted hover:bg-ink/[0.04] hover:text-ink",
          )}
        >
          <Icon className={clsx("h-[17px] w-[17px]", isActive(href) ? "text-brand" : "text-faint group-hover:text-muted")} />
          <span className="flex-1">{label}</span>
          {badges[href] ? <span className="rounded-full bg-brand px-1.5 text-[11px] font-semibold leading-5 text-white">{badges[href]}</span> : null}
        </Link>
      ))}
    </nav>
  );

  const bottom = (
    <div className="space-y-1 border-t border-line pt-3">
      {footer ? (
        <a href={footer.href} target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-muted transition hover:bg-ink/[0.04] hover:text-ink">
          <ExternalLink className="h-[17px] w-[17px] text-faint" /> {footer.label}
        </a>
      ) : null}
      <form action={logout}>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-muted transition hover:bg-ink/[0.04] hover:text-ink">
          <LogOut className="h-[17px] w-[17px] text-faint" /> Se déconnecter
        </button>
      </form>
      <div className="px-3 pt-2">
        <div className="truncate text-[13px] font-medium">{title}</div>
        <div className="truncate text-[12px] text-muted">{subtitle}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      {/* Barre latérale (ordinateur) */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-canvas px-3 py-5 lg:flex">
        <div className="flex items-center justify-between px-3">
          <BrandMark name={brandName} href={root} />
          {area === "admin" ? <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-white">Admin</span> : null}
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {bottom}
      </aside>

      {/* Barre du haut (mobile) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        <BrandMark name={brandName} href={root} />
        <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg text-ink hover:bg-ink/[0.05]" aria-label="Ouvrir le menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[84%] max-w-[320px] animate-fade-up flex-col gap-4 bg-canvas px-3 py-4 shadow-lift">
            <div className="flex items-center justify-between px-3">
              <span className="text-[13px] font-semibold uppercase tracking-wider text-muted">Menu</span>
              <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-ink/[0.05]" aria-label="Fermer le menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            {bottom}
          </div>
        </div>
      ) : null}

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-[1080px]">{children}</div>
      </main>
    </div>
  );
}
