"use client";

import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Image as ImageIcon, Upload, Loader2, Search, Wand2, Shuffle } from "lucide-react";
import { FORMATS } from "@/lib/labels/formats";
import { FONT_PAIRS, PALETTES, newId, type LabelData, type LabelDoc, type Palette } from "@/lib/labels/doc";
import { GRAPHICS, GRAPHIC_GROUPS, type GraphicDef } from "@/lib/labels/graphics";
import { renderDoc } from "@/lib/labels/render";
import { labelSvg } from "@/lib/labels/svg";
import { contrastRatio } from "@/lib/labels/palette";
import { uploadPhoto } from "../../actions";
import type { EditorApi } from "./store";
import type { PhotoRef } from "./Gallery";

// ------------------------------------------------------------------ Graphismes

/** Aperçu d'un graphisme de la bibliothèque (même tracé que l'impression). */
export function GraphicThumb({ g, className }: { g: GraphicDef; className?: string }) {
  const cid = useId().replace(/:/g, "");
  if (g.kind === "pattern" && g.gen) {
    const d = g.gen(24, 24, 1);
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <clipPath id={`c${cid}`}><rect width="24" height="24" rx="3" /></clipPath>
        <g clipPath={`url(#c${cid})`}>
          <rect width="24" height="24" fill="currentColor" opacity={0.08} />
          <path d={d} {...(g.mode === "stroke" ? { fill: "none", stroke: "currentColor", strokeWidth: 0.35 } : { fill: "currentColor" })} />
        </g>
      </svg>
    );
  }
  const ratio = g.stretch ? g.ratio ?? 1 : 1;
  return (
    <svg viewBox={`0 0 ${100 * Math.max(1, ratio)} ${100 / Math.min(1, ratio)}`} className={className} preserveAspectRatio="xMidYMid meet">
      <path
        d={g.d}
        transform={g.stretch ? `scale(${Math.max(1, ratio)} ${1 / Math.min(1, ratio)})` : undefined}
        {...(g.mode === "stroke" ? { fill: "none", stroke: "currentColor", strokeWidth: 5, strokeLinecap: "round", strokeLinejoin: "round" } : { fill: "currentColor" })}
      />
    </svg>
  );
}

export function GraphicsPanel({ api }: { api: EditorApi }) {
  const [q, setQ] = useState("");
  const doc = api.doc;
  const { w, h } = FORMATS[doc.format];
  const add = (key: string) => {
    const g = GRAPHICS[key]!;
    if (g.kind === "pattern") {
      // Un motif s'ajoute en fond, discret : il ne gêne jamais la lecture.
      api.add({ id: newId("g"), type: "graphic", graphic: key, color: "$secondary", x: 0, y: 0, w, h: h * 0.4, strokeWidth: 0.3, opacity: 0.8, name: g.label }, { back: true });
      return;
    }
    const ratio = g.ratio ?? 1;
    const base = Math.min(w, h) * (g.group === "Formes" ? 0.6 : 0.36);
    const ew = ratio >= 1 ? base * Math.min(ratio, w / base) : base * ratio;
    const eh = ratio >= 1 ? ew / ratio : base;
    const color = g.group === "Formes" ? "$secondary" : g.group === "Badges" ? "$accent" : "$primary";
    api.add(
      { id: newId("g"), type: "graphic", graphic: key, color, x: (w - ew) / 2, y: (h - eh) / 2, w: ew, h: eh, ...(g.mode === "stroke" ? { strokeWidth: 3.5 } : {}), name: g.label },
      { back: g.group === "Formes" },
    );
  };
  const items = Object.entries(GRAPHICS).filter(([k, g]) => !q || `${k} ${g.label} ${g.group}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input className="input py-2 pl-8 text-[13px]" placeholder="Chaudière, vague, rayures…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un graphisme" />
      </div>
      {GRAPHIC_GROUPS.map((group) => {
        const list = items.filter(([, g]) => g.group === group);
        if (!list.length) return null;
        return (
          <div key={group} className="mb-4">
            <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">{group}</div>
            <div className={clsx("grid gap-2", group === "Motifs" || group === "Formes" ? "grid-cols-3" : "grid-cols-4")}>
              {list.map(([key, g]) => (
                <button key={key} type="button" onClick={() => add(key)} title={g.label} aria-label={`Ajouter : ${g.label}`} data-graphic={key} className="group flex flex-col items-center gap-1 rounded-xl p-2 ring-1 ring-line transition hover:bg-brand-soft hover:ring-brand/30">
                  <GraphicThumb g={g} className={clsx("text-brand", group === "Motifs" ? "h-10 w-full" : "h-9 w-9")} />
                  <span className="w-full truncate text-center text-[10.5px] text-muted group-hover:text-ink">{g.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <p className="rounded-lg bg-canvas p-3 text-[12px] leading-relaxed text-muted">Illustrations et motifs dessinés pour l&apos;impression : ils restent nets à toutes les tailles et prennent les couleurs de votre design.</p>
    </div>
  );
}

// ------------------------------------------------------------------ Images

async function prepareImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image"));
      i.src = url;
    });
    const png = file.type === "image/png";
    const s = Math.min(1, (png ? 1200 : 1800) / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    const ctx = c.getContext("2d")!;
    if (!png) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const out = await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("conversion"))), png ? "image/png" : "image/jpeg", 0.86));
    // Un PNG trop lourd (photo enregistrée en PNG) est converti en JPEG.
    if (png && out.size > 1.4 * 1024 * 1024) {
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      return await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("conversion"))), "image/jpeg", 0.86));
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ImagesPanel({ api, hasLogo, photos, onUploaded, notify }: { api: EditorApi; hasLogo: boolean; photos: PhotoRef[]; onUploaded: (p: PhotoRef) => void; notify: (m: string, tone?: "ok" | "err") => void }) {
  const doc = api.doc;
  const { w, h } = FORMATS[doc.format];
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const sel = api.selectedEl;
  const addPhoto = (p: PhotoRef) => {
    if (sel?.type === "image") {
      api.update(sel.id, { src: p.id });
      return;
    }
    const r = p.w / p.h;
    const max = Math.min(w, h) * 0.6;
    const ew = r >= 1 ? max * Math.min(r, 1.6) : max * r;
    const eh = r >= 1 ? ew / Math.min(r, 1.6) : max;
    api.add({ id: newId("p"), type: "image", src: p.id, x: (w - ew) / 2, y: (h - eh) / 2, w: ew, h: eh, radius: 1, name: "Photo" });
  };
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const blob = await prepareImage(file);
      const fd = new FormData();
      fd.set("photo", new File([blob], blob.type === "image/png" ? "image.png" : "image.jpg", { type: blob.type }));
      fd.set("usage", "label");
      const res = await uploadPhoto(fd);
      if (!res.ok || !res.photo) {
        notify(res.message, "err");
        return;
      }
      const p: PhotoRef = { id: res.photo.id, w: res.photo.w, h: res.photo.h, usage: "label" };
      onUploaded(p);
      addPhoto(p);
      notify("Image ajoutée à votre étiquette");
    } catch {
      notify("Cette image n'a pas pu être lue. Utilisez une photo JPG ou PNG.", "err");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const labelPhotos = photos.filter((p) => p.usage === "label");
  const galleryPhotos = photos.filter((p) => p.usage === "gallery");
  const grid = (list: PhotoRef[]) => (
    <div className="grid grid-cols-3 gap-2">
      {list.map((p) => (
        <button key={p.id} type="button" onClick={() => addPhoto(p)} className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-line transition hover:ring-2 hover:ring-brand" aria-label={sel?.type === "image" ? "Remplacer l'image sélectionnée" : "Ajouter cette image"} data-photo={p.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photos/${p.id}`} alt="" className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
        </button>
      ))}
    </div>
  );
  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-line p-4">
        <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} data-testid="label-image-input" />
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-strong disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importer une image
        </button>
        <p className="mt-2 text-[11.5px] leading-snug text-faint">JPG ou PNG (transparence conservée). Photo de chantier, d&apos;équipe, de véhicule, pictogramme de marque…</p>
        {sel?.type === "image" ? <p className="mt-2 rounded-lg bg-brand-soft px-2.5 py-1.5 text-[12px] text-brand">Cliquez une image ci-dessous pour remplacer celle sélectionnée.</p> : null}
      </div>
      <div className="border-b border-line p-4">
        <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">Logo</div>
        {hasLogo ? (
          <button type="button" onClick={() => api.add({ id: newId("l"), type: "logo", x: (w - 14) / 2, y: (h - 10) / 2, w: 14, h: 10, name: "Logo" })} className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left text-[13px] ring-1 ring-line hover:bg-canvas">
            <ImageIcon className="h-5 w-5 text-brand" /> Ajouter mon logo
          </button>
        ) : (
          <p className="text-[12.5px] text-muted">Ajoutez d&apos;abord votre logo dans <Link href="/espace/page" className="link">Ma page</Link>.</p>
        )}
      </div>
      <div className="p-4">
        <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">Images d&apos;étiquette</div>
        {labelPhotos.length ? grid(labelPhotos) : <p className="text-[12.5px] text-muted">Aucune image importée pour le moment.</p>}
        {galleryPhotos.length ? (
          <>
            <div className="mb-2 mt-5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">Photos de ma page</div>
            {grid(galleryPhotos)}
          </>
        ) : null}
        <p className="mt-4 rounded-lg bg-canvas p-3 text-[12px] leading-relaxed text-muted">Une image s&apos;imprime mieux à partir de 1 000 px de large. Le QR reste toujours au-dessus, sur son fond blanc.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Idées (variantes)

/** Propose des variantes du design actuel : harmonies × polices, toutes lisibles. */
export function IdeasPanel({ api, data, logoHref, images, onApplied }: { api: EditorApi; data: LabelData; logoHref: string | null; images: Record<string, string>; onApplied: (m: string) => void }) {
  const doc = api.doc;
  const [seed, setSeed] = useState(0);
  const variants = useMemo(() => {
    const pals = PALETTES.filter((p) => contrastRatio(p.palette.ink, p.palette.paper) >= 4.5 && !samePalette(p.palette, doc.palette));
    const out: { label: string; doc: LabelDoc }[] = [];
    for (let i = 0; i < 6; i++) {
      const p = pals[(i * 5 + seed * 7) % pals.length]!;
      const f = FONT_PAIRS[(i * 3 + seed * 2) % FONT_PAIRS.length]!;
      out.push({ label: `${p.label} · ${f.label}`, doc: { ...doc, palette: p.palette, fonts: i % 2 ? { heading: f.heading, body: f.body } : doc.fonts } });
    }
    return out;
  }, [doc, seed]);
  const svgs = useMemo(() => variants.map((v) => labelSvg(renderDoc(v.doc, data), { logoHref, images, pxWidth: 240 })), [variants, data, logoHref, images]);
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted"><Wand2 className="h-3.5 w-3.5" /> Variantes de votre design</span>
        <button type="button" onClick={() => setSeed((s) => s + 1)} className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-brand hover:bg-brand-soft"><Shuffle className="h-3.5 w-3.5" /> Autres idées</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {variants.map((v, i) => (
          <button key={i} type="button" onClick={() => { api.setDoc(v.doc); onApplied(`Variante « ${v.label} » appliquée`); }} className="group text-left">
            <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-canvas p-2 ring-1 ring-line transition group-hover:ring-brand/40">
              <div className="label-svg w-full drop-shadow-[0_6px_14px_rgb(15_23_42/0.16)]" dangerouslySetInnerHTML={{ __html: svgs[i] ?? "" }} />
            </div>
            <div className="mt-1 truncate text-[11.5px] text-muted">{v.label}</div>
          </button>
        ))}
      </div>
      <p className="mt-4 rounded-lg bg-canvas p-3 text-[12px] leading-relaxed text-muted">Même composition, autres couleurs et polices. Vous pouvez toujours annuler (Ctrl+Z).</p>
    </div>
  );
}

function samePalette(a: Palette, b: Palette) {
  return (Object.keys(a) as (keyof Palette)[]).every((k) => a[k].toUpperCase() === b[k].toUpperCase());
}
