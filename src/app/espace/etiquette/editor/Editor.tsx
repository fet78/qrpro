"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import {
  ArrowLeft, Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Ruler, Home, LayoutTemplate, Shapes, Type, Palette, Layers, SlidersHorizontal,
  ShieldCheck, AlertTriangle, AlertOctagon, Loader2, Check, X, Wand2, ScanLine, Brush, Image as ImageIcon, Lightbulb,
} from "lucide-react";
import { FORMATS, type FormatKey } from "@/lib/labels/formats";
import { rescaleDoc, type LabelDoc, type LabelData } from "@/lib/labels/doc";
import { buildTemplate } from "@/lib/labels/library";
import { renderDoc, fixIssue, fixAll, type Issue } from "@/lib/labels/render";
import { loadClientFonts } from "@/lib/labels/fonts-client";
import { saveDesignDoc } from "../../actions";
import { useEditor } from "./store";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { ElementsPanel, TextPanel, BrandPanel, LayersPanel } from "./Panels";
import { GraphicsPanel, ImagesPanel, IdeasPanel } from "./Assets";
import { Gallery, type PhotoRef } from "./Gallery";

type Tab = "templates" | "elements" | "graphics" | "images" | "text" | "brand" | "ideas" | "layers" | "props";
const TABS: { key: Tab; label: string; icon: typeof Type; mobileOnly?: boolean }[] = [
  { key: "templates", label: "Modèles", icon: LayoutTemplate },
  { key: "text", label: "Texte", icon: Type },
  { key: "graphics", label: "Graphismes", icon: Brush },
  { key: "elements", label: "Formes", icon: Shapes },
  { key: "images", label: "Images", icon: ImageIcon },
  { key: "brand", label: "Marque", icon: Palette },
  { key: "ideas", label: "Idées", icon: Lightbulb },
  { key: "layers", label: "Calques", icon: Layers },
  { key: "props", label: "Réglages", icon: SlidersHorizontal, mobileOnly: true },
];

export function Editor({
  initial, data: baseData, logoHref, activeKeys, validated, draftKey, photos: initialPhotos, startInGallery,
}: {
  initial: LabelDoc;
  data: LabelData;
  logoHref: string | null;
  activeKeys: string[];
  validated: boolean;
  draftKey: string;
  photos: PhotoRef[];
  /** Ouvrir d'abord la bibliothèque (aucun design validé). */
  startInGallery: boolean;
}) {
  const api = useEditor(initial);
  const { doc } = api;
  const [photos, setPhotos] = useState<PhotoRef[]>(initialPhotos);
  const data: LabelData = useMemo(() => ({ ...baseData, images: Object.fromEntries(photos.map((p) => [p.id, { w: p.w, h: p.h }])) }), [baseData, photos]);
  const images = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, `/api/photos/${p.id}`])), [photos]);
  const [gallery, setGallery] = useState(startInGallery);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [fontError, setFontError] = useState(false);
  const [tab, setTab] = useState<Tab>("text");
  const [mobileSheet, setMobileSheet] = useState(false);
  const [zoom, setZoom] = useState<number | "fit" | "real">("fit");
  const [scene, setScene] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const [editTextNonce, setEditTextNonce] = useState(0);
  const [toast, setToast] = useState<{ msg: string; undo?: boolean; tone?: "ok" | "err" } | null>(null);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [isValidated, setIsValidated] = useState(validated);
  const [draft, setDraft] = useState<{ doc: LabelDoc; at: number } | null>(null);
  const [saving, startSave] = useTransition();
  const workspace = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 800, h: 600 });

  // Polices (texte converti en contours, comme dans le PDF).
  useEffect(() => {
    loadClientFonts().then(() => setReady(true), () => setFontError(true));
  }, []);

  // Brouillon local (sécurité si l'onglet est fermé avant validation).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as { doc: LabelDoc; at: number };
      if (d?.doc && JSON.stringify(d.doc) !== JSON.stringify(initial)) setDraft(d);
    } catch {
      /* stockage indisponible */
    }
  }, [draftKey, initial]);
  const dirty = JSON.stringify(doc) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ doc, at: Date.now() }));
      } catch {
        /* stockage plein ou bloqué : sans conséquence */
      }
    }, 700);
    return () => clearTimeout(t);
  }, [doc, dirty, draftKey]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Taille du plan de travail.
  useEffect(() => {
    const el = workspace.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e!.contentRect.width);
      const h = Math.round(e!.contentRect.height);
      setArea((a) => (Math.abs(a.w - w) < 2 && Math.abs(a.h - h) < 2 ? a : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  const { w, h } = FORMATS[doc.format];
  const fit = Math.max(2, Math.min((area.w - 88) / w, (area.h - 152) / h));
  const scale = zoom === "fit" ? fit : zoom === "real" ? 96 / 25.4 : fit * zoom;
  const label = useMemo(() => (ready ? renderDoc(doc, data) : null), [ready, doc, data]);
  const errors = label?.issues.filter((i) => i.level === "error") ?? [];
  const warnings = label?.issues.filter((i) => i.level === "warning") ?? [];

  const notify = useCallback((msg: string, undo = false, tone: "ok" | "err" = "ok") => {
    setToast({ msg, undo, tone });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 6000 : 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Raccourcis clavier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gallery || editingId) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) api.redo();
        else api.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        api.redo();
        return;
      }
      const el = api.selectedEl;
      if (!el) return;
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        api.duplicate(el.id);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        api.remove(el.id);
      } else if (e.key === "Escape") api.select(null);
      else if (e.key === "Enter" && el.type === "text") {
        e.preventDefault();
        openTextEdit(el.id);
      } else if (e.key.startsWith("Arrow") && !el.locked) {
        e.preventDefault();
        const step = e.shiftKey ? 2 : 0.5;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        api.update(el.id, { x: el.x + dx, y: el.y + dy });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** Ordinateur : édition directement sur l'étiquette. Mobile : champ de texte du panneau Réglages. */
  function openTextEdit(id: string) {
    api.select(id);
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setEditingId(id);
      return;
    }
    setTab("props");
    setMobileSheet(true);
    setEditTextNonce((n) => n + 1);
  }
  const selectTab = (t: Tab) => {
    if (t === "templates") {
      setGallery(true);
      return;
    }
    setTab(t);
  };
  const usedPhoto = doc.elements.find((e) => e.type === "image")?.src ?? photos[0]?.id ?? null;

  const changeFormat = (f: FormatKey) => {
    if (f === doc.format) return;
    const next = doc.template && !doc.edited ? buildTemplate(doc.template, f, { palette: doc.palette, fonts: doc.fonts, logo: !!data.logo, photo: usedPhoto }) : rescaleDoc(doc, f);
    api.setDoc(next, true, !!doc.edited);
    notify(`Design adapté au format ${FORMATS[f].label}. Vérifiez la mise en page.`, true);
  };

  const validate = () =>
    startSave(async () => {
      const res = await saveDesignDoc(JSON.stringify(doc), true);
      if (res.ok) {
        setSaved(JSON.stringify(doc));
        setIsValidated(true);
        setDraft(null);
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* rien */
        }
      }
      notify(res.message, false, res.ok ? "ok" : "err");
    });

  const applyFix = (issue: Issue) => {
    api.setDoc(fixIssue(doc, issue, data));
    if (issue.elementId) api.select(issue.elementId);
  };

  if (fontError) return <div className="p-10 text-center text-[15px] text-danger">Impossible de charger les polices de l&apos;éditeur. Vérifiez votre connexion et rechargez la page.</div>;

  const panel = !ready ? (
    <div className="grid h-40 place-items-center text-[13px] text-muted"><Loader2 className="h-4 w-4 animate-spin" /></div>
  ) : (
    <>
      {tab === "elements" ? <ElementsPanel api={api} hasLogo={!!data.logo} /> : null}
      {tab === "graphics" ? <GraphicsPanel api={api} /> : null}
      {tab === "images" ? <ImagesPanel api={api} hasLogo={!!data.logo} photos={photos} onUploaded={(p) => setPhotos((ps) => [p, ...ps])} notify={(m, tone) => notify(m, false, tone)} /> : null}
      {tab === "ideas" ? <IdeasPanel api={api} data={data} logoHref={logoHref} images={images} onApplied={(m) => notify(m, true)} /> : null}
      {tab === "text" ? <TextPanel api={api} data={data} /> : null}
      {tab === "brand" ? <BrandPanel api={api} logoHref={logoHref} onApplied={(m) => notify(m, true)} /> : null}
      {tab === "layers" ? <LayersPanel api={api} data={data} /> : null}
      {tab === "props" ? <Inspector api={api} onFormat={changeFormat} editTextNonce={editTextNonce} hasLogo={!!data.logo} onReplaceImage={() => { setTab("images"); setMobileSheet(true); }} /> : null}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#EEF0F4] text-ink">
      {/* Barre du haut */}
      <header className="flex h-14 flex-none items-center gap-2 border-b border-line bg-surface px-2 sm:px-3">
        <Link href="/espace" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-ink/[0.05] hover:text-ink" title="Retour à l'espace" aria-label="Retour à l'espace">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="hidden min-w-0 sm:block">
          <div className="text-[14px] font-semibold leading-tight">Mon étiquette</div>
          <div className="text-[12px] leading-tight text-muted">
            {FORMATS[doc.format].label} · {dirty ? "modifications non validées" : isValidated ? "design validé" : "non validé"}
          </div>
        </div>
        <div className="mx-auto flex items-center gap-0.5 rounded-xl bg-canvas p-1 ring-1 ring-line">
          <ToolBtn title="Annuler (Ctrl+Z)" onClick={api.undo} disabled={!api.canUndo}><Undo2 className="h-4 w-4" /></ToolBtn>
          <ToolBtn title="Rétablir (Ctrl+Y)" onClick={api.redo} disabled={!api.canRedo}><Redo2 className="h-4 w-4" /></ToolBtn>
          <span className="mx-1 h-5 w-px bg-line" />
          <ToolBtn title="Dézoomer" onClick={() => setZoom((z) => Math.max(0.5, (typeof z === "number" ? z : z === "real" ? (96 / 25.4) / fit : 1) - 0.25))}><ZoomOut className="h-4 w-4" /></ToolBtn>
          <button type="button" onClick={() => setZoom("fit")} className="hidden h-8 min-w-12 rounded-md px-1 text-[12px] font-medium tabular-nums text-muted hover:bg-surface sm:block" title="Ajuster à l'écran">
            {Math.round((scale / fit) * 100)} %
          </button>
          <ToolBtn title="Zoomer" onClick={() => setZoom((z) => Math.min(4, (typeof z === "number" ? z : z === "real" ? (96 / 25.4) / fit : 1) + 0.25))}><ZoomIn className="h-4 w-4" /></ToolBtn>
          <ToolBtn title="Ajuster à l'écran" onClick={() => setZoom("fit")} active={zoom === "fit"}><Maximize className="h-4 w-4" /></ToolBtn>
          <ToolBtn title="Taille réelle (approx.)" onClick={() => setZoom(zoom === "real" ? "fit" : "real")} active={zoom === "real"}><Ruler className="h-4 w-4" /></ToolBtn>
          <ToolBtn title="Mise en situation sur un équipement" onClick={() => setScene((s) => !s)} active={scene}><Home className="h-4 w-4" /></ToolBtn>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowChecks((s) => !s)}
            className={clsx(
              "flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold transition",
              errors.length ? "bg-danger-soft text-danger" : warnings.length ? "bg-warn-soft text-warn" : "bg-success-soft text-success",
            )}
          >
            {errors.length ? <AlertOctagon className="h-4 w-4" /> : warnings.length ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            <span className="hidden md:inline">{errors.length ? `${errors.length} problème${errors.length > 1 ? "s" : ""}` : warnings.length ? `${warnings.length} conseil${warnings.length > 1 ? "s" : ""}` : "Prêt à imprimer"}</span>
          </button>
          {showChecks && label ? (
            <div className="absolute right-0 top-11 z-20 w-[min(92vw,360px)] rounded-2xl border border-line bg-surface p-2 shadow-lift">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[13px] font-semibold">Vérification d&apos;impression</span>
                <button type="button" onClick={() => setShowChecks(false)} className="grid h-7 w-7 place-items-center rounded-md hover:bg-ink/[0.05]" aria-label="Fermer"><X className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-[12.5px]">
                <ScanLine className="h-4 w-4 text-success" /> QR relu avec succès · modules de {label.qr.moduleMm.toFixed(2)} mm · {label.qr.size.toFixed(1)} mm
              </div>
              {label.issues.length ? (
                <ul className="mt-2 max-h-[50vh] space-y-1 overflow-y-auto">
                  {label.issues.map((i, k) => (
                    <li key={k} className="flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-canvas">
                      {i.level === "error" ? <AlertOctagon className="mt-0.5 h-4 w-4 flex-none text-danger" /> : <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-warn" />}
                      <button type="button" className="min-w-0 flex-1 text-left text-[12.5px] leading-snug" onClick={() => i.elementId && api.select(i.elementId)}>{i.message}</button>
                      {i.fixable ? <button type="button" onClick={() => applyFix(i)} className="flex-none rounded-md bg-brand-soft px-2 py-1 text-[11.5px] font-semibold text-brand hover:bg-brand/15">Corriger</button> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-3 text-[12.5px] text-muted">Aucun point à signaler : textes lisibles, contrastes suffisants, tout est dans la marge de découpe.</p>
              )}
              {label.issues.some((i) => i.fixable) ? (
                <button type="button" onClick={() => { api.setDoc(fixAll(doc, data)); notify("Corrections appliquées", true); }} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-2 text-[13px] font-semibold text-white hover:bg-ink/90">
                  <Wand2 className="h-4 w-4" /> Tout corriger
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={validate}
          disabled={saving || !!errors.length || !ready}
          className="flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-[13.5px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.15)] transition hover:bg-brand-strong disabled:opacity-50 sm:px-4"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          <span className="hidden sm:inline">Valider le design</span>
          <span className="sm:hidden">Valider</span>
        </button>
      </header>

      {draft ? (
        <div className="flex flex-none flex-wrap items-center justify-center gap-3 border-b border-warn/20 bg-warn-soft px-4 py-2 text-[13px]">
          Un brouillon non validé du {new Date(draft.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} a été retrouvé.
          <button type="button" className="font-semibold text-brand" onClick={() => { api.setDoc(draft.doc); setDraft(null); }}>Le reprendre</button>
          <button type="button" className="text-muted" onClick={() => { setDraft(null); try { localStorage.removeItem(draftKey); } catch { /* rien */ } }}>Ignorer</button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Rail (ordinateur) */}
        <nav className="hidden w-[72px] flex-none flex-col items-center gap-1 border-r border-line bg-surface py-3 lg:flex">
          {TABS.filter((t) => !t.mobileOnly).map(({ key, label: l, icon: Icon }) => (
            <button key={key} type="button" onClick={() => selectTab(key)} data-tab={key} className={clsx("flex w-[64px] flex-col items-center gap-1 rounded-xl py-2 text-[10.5px] font-medium transition", tab === key && key !== "templates" ? "bg-brand-soft text-brand" : key === "templates" ? "text-brand hover:bg-brand-soft" : "text-muted hover:bg-canvas hover:text-ink")}>
              <Icon className="h-5 w-5" />
              {l}
            </button>
          ))}
        </nav>
        <aside className="hidden w-[300px] flex-none border-r border-line bg-surface lg:block">{tab !== "props" || !ready ? panel : <GraphicsPanel api={api} />}</aside>

        {/* Plan de travail */}
        <main
          ref={workspace}
          className={clsx("relative min-w-0 flex-1 overflow-hidden", scene ? "bg-[linear-gradient(135deg,#C9CED6_0%,#E7EAEE_35%,#B9BFC8_60%,#DDE1E6_100%)]" : "bg-[radial-gradient(#D5D9E0_1px,transparent_1px)] [background-size:18px_18px]")}
          onPointerDown={(e) => e.target === e.currentTarget && api.select(null)}
        >
          {/* La zone mesurée (main) ne défile pas : seule cette couche défile. Sinon l'apparition d'une barre
              de défilement changerait la place disponible, donc le zoom, donc la barre… (boucle). */}
          <div className="absolute inset-0 overflow-auto" onPointerDown={(e) => e.target === e.currentTarget && api.select(null)}>
          {!ready || !label ? (
            <div className="grid h-full place-items-center text-[14px] text-muted">
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Préparation de l&apos;éditeur…</span>
            </div>
          ) : (
            <div className="flex min-h-full min-w-full items-center justify-center p-8 pb-24" onPointerDown={(e) => e.target === e.currentTarget && api.select(null)}>
              <div className={clsx(scene && "rounded-[18px] bg-gradient-to-b from-white/50 to-white/0 p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.7)]")}>
                <Canvas api={api} label={label} scale={scale} logoHref={logoHref} images={images} editingId={editingId} onEditText={openTextEdit} onStopEdit={() => setEditingId(null)} showSafe={!!api.selectedEl && !scene} />
              </div>
              {scene ? <p className="absolute bottom-16 left-0 right-0 text-center text-[12px] text-ink/60">Mise en situation sur la façade d&apos;une chaudière · {FORMATS[doc.format].label}</p> : null}
            </div>
          )}
          {ready && !api.selectedEl ? (
            <p className="pointer-events-none absolute bottom-4 left-0 right-0 hidden text-center text-[12px] text-muted md:block">
              Cliquez sur un élément pour le modifier · glissez pour le déplacer · double-cliquez sur un texte pour l&apos;éditer
            </p>
          ) : null}
          </div>
        </main>

        {/* Propriétés (ordinateur) */}
        <aside className="hidden w-[310px] flex-none overflow-y-auto border-l border-line bg-surface lg:block">
          {ready ? <Inspector api={api} onFormat={changeFormat} editTextNonce={editTextNonce} hasLogo={!!data.logo} onReplaceImage={() => setTab("images")} /> : null}
        </aside>
      </div>

      {/* Mobile : onglets + panneau en feuille */}
      {mobileSheet ? (
        <div className="max-h-[52vh] flex-none overflow-y-auto border-t border-line bg-surface lg:hidden">
          <div className="sticky top-0 z-10 flex justify-end bg-surface/95 px-2 pt-1 backdrop-blur">
            <button type="button" onClick={() => setMobileSheet(false)} className="grid h-8 w-8 place-items-center rounded-md text-muted" aria-label="Fermer le panneau"><X className="h-4 w-4" /></button>
          </div>
          <div className="h-full">{panel}</div>
        </div>
      ) : null}
      <nav className="flex flex-none overflow-x-auto border-t border-line bg-surface px-1 py-1 lg:hidden">
        {TABS.map(({ key, label: l, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (key === "templates") setGallery(true);
              else if (tab === key && mobileSheet) setMobileSheet(false);
              else {
                setTab(key);
                setMobileSheet(true);
              }
            }}
            className={clsx("flex min-w-[64px] flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium", tab === key && mobileSheet ? "text-brand" : "text-muted")}
          >
            <Icon className="h-5 w-5" />
            {l}
          </button>
        ))}
      </nav>

      {gallery && ready ? (
        <Gallery
          data={data}
          logoHref={logoHref}
          photos={photos}
          activeKeys={activeKeys}
          current={doc}
          onClose={() => setGallery(false)}
          onPick={(d, msg) => {
            api.setDoc(d, true, !!d.edited);
            api.select(null);
            setGallery(false);
            notify(msg, true);
          }}
        />
      ) : null}

      {toast ? (
        <div className={clsx("fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 animate-fade-up items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] text-white shadow-lift lg:bottom-6", toast.tone === "err" ? "bg-danger" : "bg-ink")}>
          {toast.msg}
          {toast.undo ? (
            <button type="button" className="font-semibold text-sky-300" onClick={() => { api.undo(); setToast(null); }}>Annuler</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolBtn({ title, onClick, children, disabled, active }: { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; active?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} className={clsx("grid h-8 w-8 place-items-center rounded-md transition disabled:opacity-35", active ? "bg-surface text-brand shadow-card" : "text-muted hover:bg-surface hover:text-ink")}>
      {children}
    </button>
  );
}
