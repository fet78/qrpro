"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Brush, Eye, EyeOff, Lock, Unlock, Type, Square, Shapes, Image as ImageIcon, QrCode, Search, Sparkles, Wand2, Palette as PaletteIcon } from "lucide-react";
import { FORMATS } from "@/lib/labels/formats";
import { FONTS, FONT_PAIRS, PALETTES, newId, type Element, type LabelData, type LabelDoc, type Palette, type TextEl, type ShapeEl } from "@/lib/labels/doc";
import { ICONS, ICON_GROUPS } from "@/lib/labels/icons";
import { GRAPHICS } from "@/lib/labels/graphics";
import { resolveText } from "@/lib/labels/doc";
import { logoColors, paletteFromColors } from "./colors";
import type { EditorApi } from "./store";

// ------------------------------------------------------------------ Éléments

function center(doc: LabelDoc, w: number, h: number) {
  const f = FORMATS[doc.format];
  return { x: (f.w - w) / 2, y: (f.h - h) / 2, w, h };
}

const SHAPES: { key: string; label: string; make: (doc: LabelDoc) => ShapeEl }[] = [
  { key: "rect", label: "Rectangle", make: (d) => ({ id: newId("s"), type: "shape", shape: "rect", ...center(d, 18, 10), fill: "$primary" }) },
  { key: "rounded", label: "Arrondi", make: (d) => ({ id: newId("s"), type: "shape", shape: "rect", ...center(d, 18, 10), fill: "$primary", radius: 2.5 }) },
  { key: "pill", label: "Pilule", make: (d) => ({ id: newId("s"), type: "shape", shape: "rect", ...center(d, 22, 7), fill: "$secondary", radius: 3.5 }) },
  { key: "circle", label: "Cercle", make: (d) => ({ id: newId("s"), type: "shape", shape: "ellipse", ...center(d, 12, 12), fill: "$primary" }) },
  { key: "frame", label: "Cadre", make: (d) => ({ id: newId("s"), type: "shape", shape: "rect", x: 1.5, y: 1.5, w: FORMATS[d.format].w - 3, h: FORMATS[d.format].h - 3, fill: "none", stroke: "$primary", strokeWidth: 0.5, radius: 1.5, name: "Cadre" }) },
  { key: "line", label: "Ligne", make: (d) => ({ id: newId("s"), type: "shape", shape: "line", ...center(d, 20, 1), fill: "none", stroke: "$ink", strokeWidth: 0.35 }) },
  { key: "dashed", label: "Pointillés", make: (d) => ({ id: newId("s"), type: "shape", shape: "line", ...center(d, 20, 1), fill: "none", stroke: "$ink", strokeWidth: 0.3, dashed: true, name: "Ligne à compléter" }) },
  { key: "band", label: "Bandeau", make: (d) => ({ id: newId("s"), type: "shape", shape: "rect", x: 0, y: 0, w: FORMATS[d.format].w, h: 9, fill: "$primary", name: "Bandeau" }) },
  { key: "triangle", label: "Triangle", make: (d) => ({ id: newId("s"), type: "shape", shape: "polygon", ...center(d, 12, 10), fill: "$accent", points: [[0.5, 0], [1, 1], [0, 1]] }) },
  { key: "diamond", label: "Losange", make: (d) => ({ id: newId("s"), type: "shape", shape: "polygon", ...center(d, 10, 10), fill: "$accent", points: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]] }) },
  { key: "ribbon", label: "Ruban", make: (d) => ({ id: newId("s"), type: "shape", shape: "polygon", ...center(d, 26, 8), fill: "$primary", points: [[0, 0], [1, 0], [0.92, 0.5], [1, 1], [0, 1], [0.08, 0.5]], name: "Ruban" }) },
  { key: "bubble", label: "Bulle", make: (d) => ({ id: newId("s"), type: "shape", shape: "polygon", ...center(d, 24, 12), fill: "$primary", points: [[0, 0], [1, 0], [1, 0.78], [0.3, 0.78], [0.18, 1], [0.18, 0.78], [0, 0.78]], name: "Bulle" }) },
  { key: "star", label: "Étoile", make: (d) => ({ id: newId("s"), type: "shape", shape: "polygon", ...center(d, 12, 12), fill: "$accent", points: Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? 0.2 : 0.5; return [0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)] as [number, number]; }) }) },
  { key: "stripes", label: "Rayures", make: (d) => ({ id: newId("s"), type: "shape", shape: "polygon", x: 0, y: 0, w: 14, h: 5, fill: "$secondary", points: [[0, 1], [0.35, 0], [0.65, 0], [0.3, 1]], name: "Rayure" }) },
];

function ShapePreview({ s }: { s: ShapeEl & { key?: string } }) {
  const vb = 24;
  const sw = 1.6;
  if (s.shape === "line") return <svg viewBox="0 0 24 24" className="h-7 w-7"><path d="M3 12H21" stroke="currentColor" strokeWidth={2} strokeDasharray={s.dashed ? "3 2.5" : undefined} /></svg>;
  if (s.shape === "ellipse") return <svg viewBox="0 0 24 24" className="h-7 w-7"><circle cx="12" cy="12" r="9" fill="currentColor" /></svg>;
  if (s.shape === "polygon") {
    const k = Math.max(s.w, s.h);
    const pts = s.points!.map(([u, v]) => `${2 + (u * s.w * 20) / k + (20 - (s.w * 20) / k) / 2},${2 + (v * s.h * 20) / k + (20 - (s.h * 20) / k) / 2}`).join(" ");
    return <svg viewBox="0 0 24 24" className="h-7 w-7"><polygon points={pts} fill="currentColor" /></svg>;
  }
  const k = Math.max(s.w, s.h);
  const w = (s.w / k) * 20;
  const h = (s.h / k) * 20;
  return (
    <svg viewBox={`0 0 ${vb} ${vb}`} className="h-7 w-7">
      <rect x={(24 - w) / 2} y={(24 - h) / 2} width={w} height={h} rx={s.radius ? Math.min(w, h) / (s.key === "pill" ? 2 : 4) : 0} fill={s.fill === "none" ? "none" : "currentColor"} stroke={s.stroke ? "currentColor" : undefined} strokeWidth={s.stroke ? sw : undefined} />
    </svg>
  );
}

export function ElementsPanel({ api, hasLogo }: { api: EditorApi; hasLogo: boolean }) {
  const [q, setQ] = useState("");
  const doc = api.doc;
  const icons = Object.entries(ICONS).filter(([k, i]) => !q || `${k} ${i.label} ${i.group}`.toLowerCase().includes(q.toLowerCase()));
  const addIcon = (key: string) => api.add({ id: newId("i"), type: "icon", icon: key, color: "$primary", strokeWidth: 2, ...center(doc, 8, 8) });
  const addLogo = () => api.add({ id: newId("l"), type: "logo", ...center(doc, 14, 10), name: "Logo" });
  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-line p-4">
        <div className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">Formes</div>
        <div className="grid grid-cols-4 gap-2">
          {SHAPES.map((s) => {
            const sample = s.make(doc);
            return (
              <button key={s.key} type="button" onClick={() => api.add(s.make(doc))} title={s.label} className="flex flex-col items-center gap-1 rounded-lg p-2 text-brand ring-1 ring-line transition hover:bg-brand-soft">
                <ShapePreview s={{ ...sample, key: s.key } as ShapeEl & { key: string }} />
                <span className="text-[10.5px] text-muted">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-b border-line p-4">
        <div className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">Logo</div>
        {hasLogo ? (
          <button type="button" onClick={addLogo} className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-[13px] ring-1 ring-line hover:bg-canvas">
            <ImageIcon className="h-5 w-5 text-brand" /> Ajouter mon logo
          </button>
        ) : (
          <p className="text-[12.5px] text-muted">Ajoutez d&apos;abord votre logo dans <Link href="/espace/page" className="link">Ma page</Link>.</p>
        )}
      </div>
      <div className="p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">Icônes métier</span>
        </div>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input className="input py-2 pl-8 text-[13px]" placeholder="Chercher : flamme, eau, froid…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher une icône" />
        </div>
        {ICON_GROUPS.map((g) => {
          const items = icons.filter(([, i]) => i.group === g);
          if (!items.length) return null;
          return (
            <div key={g} className="mb-3">
              <div className="mb-1.5 text-[11.5px] text-faint">{g}</div>
              <div className="grid grid-cols-6 gap-1">
                {items.map(([key, icon]) => (
                  <button key={key} type="button" title={icon.label} aria-label={icon.label} onClick={() => addIcon(key)} className="grid aspect-square place-items-center rounded-md text-ink transition hover:bg-brand-soft hover:text-brand">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={icon.d} /></svg>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Texte

const TEXT_PRESETS: { label: string; hint: string; make: (doc: LabelDoc) => TextEl }[] = [
  { label: "Titre", hint: "Grand et gras", make: (d) => ({ id: newId("t"), type: "text", ...center(d, 30, 7), text: "Votre titre", font: "$heading", bold: true, size: 4.2, color: "$ink", align: "center" }) },
  { label: "Sous-titre", hint: "Moyen", make: (d) => ({ id: newId("t"), type: "text", ...center(d, 30, 5), text: "Votre sous-titre", font: "$heading", bold: false, size: 2.8, color: "$primary", align: "center" }) },
  { label: "Texte", hint: "Petit paragraphe", make: (d) => ({ id: newId("t"), type: "text", ...center(d, 30, 8), text: "Ajoutez votre texte", font: "$body", bold: false, size: 2.2, color: "$ink", align: "left" }) },
  { label: "Nom de l'entreprise", hint: "{nom}", make: (d) => ({ id: newId("t"), type: "text", ...center(d, 34, 6), text: "{nom}", font: "$heading", bold: true, size: 3.4, color: "$ink", align: "center", name: "Nom" }) },
  { label: "Téléphone", hint: "{telephone}, jamais coupé", make: (d) => ({ id: newId("t"), type: "text", ...center(d, 30, 6), text: "{telephone}", font: "$heading", bold: true, size: 3.6, color: "$primary", align: "center", maxLines: 1, name: "Téléphone" }) },
  { label: "Métier", hint: "{metier}", make: (d) => ({ id: newId("t"), type: "text", ...center(d, 30, 4), text: "{metier|Entretien · Dépannage}", font: "$body", bold: false, size: 2, color: "$accent", align: "center", uppercase: true, tracking: 0.08 }) },
  { label: "Appel à l'action", hint: "« Scannez-moi »", make: (d) => ({ id: newId("t"), type: "text", ...center(d, 30, 5), text: "SCANNEZ-MOI", font: "$heading", bold: true, size: 3, color: "$primary", align: "center", tracking: 0.12 }) },
  { label: "Site internet", hint: "{site}", make: (d) => ({ id: newId("t"), type: "text", ...center(d, 30, 4), text: "{site}", font: "$body", bold: false, size: 2.2, color: "$ink", align: "center", maxLines: 1 }) },
  { label: "Ligne à compléter", hint: "Entretien le …", make: (d) => ({ id: newId("t"), type: "text", ...center(d, 30, 4), text: "Prochain entretien :", font: "$body", bold: false, size: 2, color: "$accent", align: "left" }) },
];

export function TextPanel({ api, data }: { api: EditorApi; data: LabelData }) {
  const doc = api.doc;
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-2">
        {TEXT_PRESETS.map((p) => {
          const el = p.make(doc);
          const fam = el.font === "$heading" ? doc.fonts.heading : el.font === "$body" ? doc.fonts.body : el.font;
          return (
            <button key={p.label} type="button" onClick={() => api.add(el)} className="block w-full rounded-xl p-3 text-left ring-1 ring-line transition hover:bg-brand-soft/50 hover:ring-brand/30">
              <span className="block truncate text-ink" style={{ fontFamily: `qrp-${fam}`, fontWeight: el.bold ? 700 : 400, fontSize: Math.min(22, 7 + el.size * 3), textTransform: el.uppercase ? "uppercase" : undefined, letterSpacing: el.tracking ? `${el.tracking}em` : undefined }}>
                {resolveText(el.text, data) || p.label}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-faint">{p.label} · {p.hint}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 rounded-lg bg-canvas p-3 text-[12px] leading-relaxed text-muted">
        Les informations entre accolades (nom, téléphone…) viennent de « Ma page » : si vous les modifiez, toutes vos étiquettes futures suivent.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ Marque

export function BrandPanel({ api, logoHref, onApplied }: { api: EditorApi; logoHref: string | null; onApplied: (m: string) => void }) {
  const doc = api.doc;
  const [fromLogo, setFromLogo] = useState<Palette | null>(null);
  const [busy, setBusy] = useState(false);
  const swatches = (p: Palette) => (
    <span className="flex h-7 overflow-hidden rounded-md ring-1 ring-black/10">
      {(["paper", "secondary", "primary", "accent", "ink"] as const).map((r) => <span key={r} className="flex-1" style={{ background: p[r] }} />)}
    </span>
  );
  const sameP = (a: Palette, b: Palette) => (Object.keys(a) as (keyof Palette)[]).every((k) => a[k].toUpperCase() === b[k].toUpperCase());
  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-line p-4">
        <div className="mb-2.5 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted"><Wand2 className="h-3.5 w-3.5" /> Couleurs de votre logo</div>
        {logoHref ? (
          fromLogo ? (
            <button type="button" onClick={() => { api.setDoc({ ...doc, palette: fromLogo }); onApplied("Couleurs de votre logo appliquées"); }} className="block w-full rounded-xl p-2.5 text-left ring-1 ring-line hover:ring-brand/40">
              {swatches(fromLogo)}
              <span className="mt-1.5 block text-[12.5px] font-medium">Appliquer cette harmonie</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  setFromLogo(paletteFromColors(await logoColors(logoHref)));
                } finally {
                  setBusy(false);
                }
              }}
              className="flex w-full items-center gap-2 rounded-xl bg-brand-soft p-3 text-left text-[13px] font-medium text-brand hover:bg-brand/15"
            >
              <Sparkles className="h-4 w-4" /> {busy ? "Analyse du logo…" : "Créer une harmonie à partir de mon logo"}
            </button>
          )
        ) : (
          <p className="text-[12.5px] text-muted">Ajoutez votre logo dans <Link className="link" href="/espace/page">Ma page</Link> : nous en tirerons une harmonie de couleurs lisible.</p>
        )}
      </div>
      <div className="border-b border-line p-4">
        <div className="mb-2.5 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted"><PaletteIcon className="h-3.5 w-3.5" /> Harmonies</div>
        <div className="grid grid-cols-2 gap-2">
          {PALETTES.map((p) => (
            <button key={p.key} type="button" onClick={() => api.setDoc({ ...doc, palette: p.palette })} className={clsx("rounded-xl p-2 text-left ring-1 transition", sameP(doc.palette, p.palette) ? "ring-2 ring-brand" : "ring-line hover:ring-faint")}>
              {swatches(p.palette)}
              <span className="mt-1 block text-[11.5px] font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        <div className="mb-2.5 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted"><Type className="h-3.5 w-3.5" /> Associations de polices</div>
        <div className="space-y-2">
          {FONT_PAIRS.map((p) => (
            <button key={p.key} type="button" onClick={() => api.setDoc({ ...doc, fonts: { heading: p.heading, body: p.body } })} className={clsx("block w-full rounded-xl px-3 py-2.5 text-left ring-1 transition", doc.fonts.heading === p.heading && doc.fonts.body === p.body ? "ring-2 ring-brand" : "ring-line hover:ring-faint")}>
              <span className="block text-[18px] leading-tight" style={{ fontFamily: `qrp-${p.heading}`, fontWeight: 700 }}>{p.label}</span>
              <span className="block text-[12px] text-muted" style={{ fontFamily: `qrp-${p.body}` }}>{FONTS[p.heading].label} + {FONTS[p.body].label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Calques

const TYPE_ICON = { text: Type, shape: Shapes, icon: Square, logo: ImageIcon, graphic: Brush, image: ImageIcon, qr: QrCode };

export function LayersPanel({ api, data }: { api: EditorApi; data: LabelData }) {
  const items = [...api.doc.elements].reverse();
  const label = (e: Element) => {
    if (e.name) return e.name;
    if (e.type === "text") return resolveText(e.text, data) || "Texte vide";
    if (e.type === "icon") return ICONS[e.icon]?.label ?? "Icône";
    if (e.type === "shape") return { rect: "Rectangle", ellipse: "Cercle", polygon: "Forme", line: "Ligne" }[e.shape];
    if (e.type === "graphic") return GRAPHICS[e.graphic]?.label ?? "Graphisme";
    if (e.type === "image") return "Image";
    return e.type === "logo" ? "Logo" : "QR code";
  };
  return (
    <div className="h-full overflow-y-auto p-2">
      <p className="px-2 pb-2 pt-1 text-[12px] text-muted">Du premier plan à l&apos;arrière-plan. Le QR code reste toujours au-dessus.</p>
      {items.map((e) => {
        const Icon = TYPE_ICON[e.type];
        const active = api.selected === e.id;
        return (
          <div key={e.id} className={clsx("group flex items-center gap-2 rounded-lg px-2 py-1.5", active ? "bg-brand-soft" : "hover:bg-canvas")}>
            <button type="button" onClick={() => api.select(e.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <Icon className={clsx("h-4 w-4 flex-none", active ? "text-brand" : "text-faint")} />
              <span className={clsx("truncate text-[13px]", e.hidden && "text-faint line-through")}>{label(e)}</span>
            </button>
            {e.type !== "qr" ? (
              <span className="flex flex-none items-center opacity-60 group-hover:opacity-100">
                <button type="button" title={e.hidden ? "Afficher" : "Masquer"} aria-label={e.hidden ? "Afficher" : "Masquer"} onClick={() => api.update(e.id, { hidden: !e.hidden })} className="grid h-7 w-7 place-items-center rounded-md hover:bg-ink/[0.06]">
                  {e.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button type="button" title={e.locked ? "Déverrouiller" : "Verrouiller"} aria-label={e.locked ? "Déverrouiller" : "Verrouiller"} onClick={() => api.update(e.id, { locked: !e.locked })} className="grid h-7 w-7 place-items-center rounded-md hover:bg-ink/[0.06]">
                  {e.locked ? <Lock className="h-3.5 w-3.5 text-brand" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
              </span>
            ) : (
              <Lock className="mr-2 h-3.5 w-3.5 text-emerald-600" />
            )}
          </div>
        );
      })}
    </div>
  );
}

