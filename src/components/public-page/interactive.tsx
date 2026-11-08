"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Share2, X } from "lucide-react";
import { clsx } from "clsx";

export type TrackAction = "view" | "call" | "whatsapp" | "sms" | "email" | "directions" | "save" | "share" | "review" | "website" | "calendar" | "request_open" | "link";

/** Statistiques anonymes (aucun cookie, aucune donnée personnelle). Jamais en aperçu. */
export function track(slug: string, action: TrackAction, code: string | null, preview: boolean) {
  if (preview || typeof window === "undefined") return;
  const body = JSON.stringify({ slug, action, code });
  try {
    if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  } catch {
    /* statistique facultative */
  }
}

export function ViewTracker({ slug, code, preview }: { slug: string; code: string | null; preview: boolean }) {
  useEffect(() => track(slug, "view", code, preview), [slug, code, preview]);
  return null;
}

/** Lien d'action suivi dans les statistiques (désactivé en aperçu). */
export function ActionLink({ href, action, slug, code, preview, className, children, external, download, style, ariaLabel }: {
  href: string;
  action: TrackAction;
  slug: string;
  code: string | null;
  preview: boolean;
  className?: string;
  children: React.ReactNode;
  external?: boolean;
  download?: boolean;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  return (
    <a
      href={preview ? undefined : href}
      onClick={() => track(slug, action, code, preview)}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer nofollow" : undefined}
      download={download || undefined}
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}

/** Partage natif (téléphone) ou copie du lien (ordinateur). */
export function ShareButton({ url, title, slug, code, preview, className, children }: { url: string; title: string; slug: string; code: string | null; preview: boolean; className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (preview) return;
        track(slug, "share", code, preview);
        try {
          if (navigator.share) await navigator.share({ title, text: `${title} — coordonnées et demande d'intervention`, url });
          else {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }
        } catch {
          /* partage annulé */
        }
      }}
    >
      {copied ? (
        <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> Lien copié</span>
      ) : (
        children
      )}
    </button>
  );
}

/** Galerie : vignettes + visionneuse plein écran (glisser, flèches, clavier). */
export function Gallery({ photos, tileClass, preview }: { photos: { id: string; url: string; w: number; h: number; caption: string }[]; tileClass: string; preview: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const [touch, setTouch] = useState<number | null>(null);
  const go = (d: number) => setOpen((i) => (i === null ? null : (i + d + photos.length) % photos.length));
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  });
  const big = photos.length >= 3;
  return (
    <>
      <div className={clsx("grid gap-2", big ? "grid-cols-3" : "grid-cols-2")}>
        {photos.slice(0, 9).map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(i)}
            className={clsx("group relative overflow-hidden", tileClass, big && i === 0 && photos.length >= 5 ? "col-span-2 row-span-2" : "", "aspect-square")}
            aria-label={p.caption || `Photo ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
            {i === 8 && photos.length > 9 ? <span className="absolute inset-0 grid place-items-center bg-black/50 text-[18px] font-semibold text-white">+{photos.length - 9}</span> : null}
          </button>
        ))}
      </div>
      {open !== null && !preview && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white"
              role="dialog"
              aria-modal="true"
              onTouchStart={(e) => setTouch(e.touches[0]!.clientX)}
              onTouchEnd={(e) => {
                if (touch === null) return;
                const dx = e.changedTouches[0]!.clientX - touch;
                if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
                setTouch(null);
              }}
            >
              <div className="flex items-center justify-between p-3">
                <span className="text-[13px] text-white/70">{open + 1} / {photos.length}</span>
                <button type="button" onClick={() => setOpen(null)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label="Fermer"><X className="h-5 w-5" /></button>
              </div>
              <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img key={photos[open]!.id} src={photos[open]!.url} alt={photos[open]!.caption} className="max-h-full max-w-full animate-fade-up object-contain" />
                {photos.length > 1 ? (
                  <>
                    <button type="button" onClick={() => go(-1)} className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur" aria-label="Photo précédente"><ChevronLeft className="h-6 w-6" /></button>
                    <button type="button" onClick={() => go(1)} className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur" aria-label="Photo suivante"><ChevronRight className="h-6 w-6" /></button>
                  </>
                ) : null}
              </div>
              <p className="min-h-[56px] px-6 py-4 text-center text-[14px] text-white/85">{photos[open]!.caption}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function ShareIcon() {
  return <Share2 className="h-[18px] w-[18px]" />;
}
