"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Search, X, FilePlus2, PenLine, Image as ImageIcon, Sparkles, Moon, Sun, Check, ArrowRight, Eye, Brush } from "lucide-react";
import { FORMATS, FORMAT_KEYS, type FormatKey } from "@/lib/labels/formats";
import { PALETTES, FONT_PAIRS, FONTS, resolveColor, type LabelData, type LabelDoc, type Palette, type FontKey } from "@/lib/labels/doc";
import { TEMPLATES, CATEGORIES, buildTemplate, blankDoc, formatsOf, paletteByKey, type TemplateDef } from "@/lib/labels/library";
import { GRAPHICS } from "@/lib/labels/graphics";
import { renderDoc } from "@/lib/labels/render";
import { labelSvg } from "@/lib/labels/svg";
import { contrastRatio } from "@/lib/labels/palette";

export interface PhotoRef {
  id: string;
  w: number;
  h: number;
  usage: "label" | "gallery";
}

type Tag = "photo" | "illustration" | "logo" | "sombre" | "clair";
interface Meta {
  t: TemplateDef;
  tags: Set<Tag>;
}

const SCENES = ["chaudiere", "metal", "mur", "pac"] as const;
type SceneKind = (typeof SCENES)[number];
const SCENE_LABEL: Record<SceneKind, string> = { chaudiere: "Façade de chaudière", metal: "Tôle brossée", mur: "Mur", pac: "Groupe extérieur" };

function sceneOf(t: TemplateDef): SceneKind {
  if (t.category === "Industriel" || t.key === "pac") return t.key === "pac" ? "pac" : "metal";
  if (t.category === "Métier" || t.category === "Minimaliste" || t.category === "Moderne") return "chaudiere";
  return "mur";
}

/** Décor réaliste (CSS pur) sur lequel l'étiquette est « collée ». */
export function Scene({ kind, children, className }: { kind: SceneKind; children: React.ReactNode; className?: string }) {
  const bg: Record<SceneKind, string> = {
    chaudiere: "bg-[linear-gradient(180deg,#F7F8FA_0%,#E9ECF0_55%,#DADFE5_100%)]",
    metal: "bg-[repeating-linear-gradient(90deg,#C9CED4_0px,#D3D8DD_2px,#C3C8CE_3px,#CDD2D8_5px)]",
    mur: "bg-[radial-gradient(circle_at_20%_15%,#F3EEE6_0%,#E7E0D5_55%,#DCD3C6_100%)]",
    pac: "bg-[linear-gradient(180deg,#4B5158_0%,#3B4046_100%)]",
  };
  return (
    <div className={clsx("relative isolate overflow-hidden", bg[kind], className)}>
      {kind === "chaudiere" ? (
        <>
          <div className="absolute inset-x-0 top-[14%] h-px bg-black/[0.07]" />
          <div className="absolute right-[7%] top-[5%] h-[5%] w-[16%] rounded-sm bg-[#1F2937]/80 shadow-inner" />
          <div className="absolute bottom-[9%] left-[8%] h-[3%] w-[3%] rounded-full bg-black/10" />
        </>
      ) : null}
      {kind === "metal" ? <div className="absolute inset-0 bg-[linear-gradient(115deg,rgb(255_255_255/0.35)_0%,transparent_40%,rgb(255_255_255/0.25)_70%,transparent_100%)]" /> : null}
      {kind === "pac" ? <div className="absolute inset-y-0 left-[8%] w-[38%] bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.35)_0px,rgb(0_0_0/0.35)_2px,transparent_2px,transparent_7px)] opacity-60" /> : null}
      {kind === "mur" ? <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(rgb(0_0_0/0.06)_1px,transparent_1px)] [background-size:5px_5px]" /> : null}
      <div className="relative flex h-full w-full items-center justify-center">{children}</div>
    </div>
  );
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

function tagsOf(doc: LabelDoc, t: TemplateDef): Set<Tag> {
  const tags = new Set<Tag>();
  const bg = resolveColor(doc.background, doc.palette) ?? "#FFFFFF";
  tags.add(luminance(bg) < 0.3 ? "sombre" : "clair");
  if (t.usesPhoto) tags.add("photo");
  if (doc.elements.some((e) => e.type === "graphic" && GRAPHICS[e.graphic]?.group === "Illustrations métier")) tags.add("illustration");
  if (doc.elements.some((e) => e.type === "logo")) tags.add("logo");
  return tags;
}

const TAG_LABEL: Record<Tag, string> = { photo: "Photo", illustration: "Illustration", logo: "Logo", sombre: "Fond sombre", clair: "Fond clair" };

export function Gallery({
  data, logoHref, photos, activeKeys, current, onPick, onClose,
}: {
  data: LabelData;
  logoHref: string | null;
  photos: PhotoRef[];
  activeKeys: string[];
  /** Design actuel (pour « continuer » et « garder mes couleurs »). */
  current: LabelDoc;
  onPick: (doc: LabelDoc, message: string) => void;
  onClose?: () => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("Tous");
  const [format, setFormat] = useState<FormatKey>(current.format);
  const [tone, setTone] = useState<"all" | "clair" | "sombre">("all");
  const [need, setNeed] = useState<Set<"photo" | "illustration" | "logo">>(new Set());
  const [keepStyle, setKeepStyle] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const photo = photos[0]?.id ?? null;
  const hrefs = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, `/api/photos/${p.id}`])), [photos]);
  const style = keepStyle ? { palette: current.palette, fonts: current.fonts } : {};

  const available = useMemo(() => TEMPLATES.filter((t) => activeKeys.includes(t.key)), [activeKeys]);
  const metas: Meta[] = useMemo(
    () => available.filter((t) => formatsOf(t).includes(format)).map((t) => ({ t, tags: tagsOf(buildTemplate(t.key, format, { logo: !!data.logo, photo }), t) })),
    [available, format, data.logo, photo],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = { Tous: metas.length };
    for (const m of metas) c[m.t.category] = (c[m.t.category] ?? 0) + 1;
    return c;
  }, [metas]);

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const list = metas.filter(({ t, tags }) => {
    if (cat !== "Tous" && t.category !== cat) return false;
    if (tone !== "all" && !tags.has(tone)) return false;
    for (const n of need) if (!tags.has(n)) return false;
    if (q.trim()) {
      const hay = norm(`${t.name} ${t.category} ${t.description} ${t.keywords ?? ""} ${[...tags].map((x) => TAG_LABEL[x]).join(" ")}`);
      return norm(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
    }
    return true;
  });

  // Vignettes calculées par petits lots : l'écran s'affiche tout de suite, les aperçus arrivent.
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const styleKey = keepStyle ? JSON.stringify(style) : "";
  useEffect(() => {
    setThumbs({});
    let cancelled = false;
    const keys = metas.map((m) => m.t.key);
    let i = 0;
    const step = () => {
      if (cancelled) return;
      const batch: Record<string, string> = {};
      for (const end = Math.min(keys.length, i + 4); i < end; i++) {
        const key = keys[i]!;
        const doc = buildTemplate(key, format, { ...style, logo: !!data.logo, photo });
        const f = FORMATS[format];
        batch[key] = labelSvg(renderDoc(doc, data), { logoHref, images: hrefs, pxWidth: Math.round(Math.max(f.w, f.h) * 3.4 * (f.w / Math.max(f.w, f.h))) });
      }
      setThumbs((t) => ({ ...t, ...batch }));
      if (i < keys.length) setTimeout(step, 0);
    };
    const t = setTimeout(step, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [metas, format, styleKey, data, logoHref, hrefs, photo]); // eslint-disable-line react-hooks/exhaustive-deps

  const use = (key: string, override?: { palette?: Palette; fonts?: { heading: FontKey; body: FontKey } }) => {
    const t = TEMPLATES.find((x) => x.key === key)!;
    onPick(buildTemplate(key, format, { ...style, ...override, logo: !!data.logo, photo }), `Modèle « ${t.name} » appliqué : tout est modifiable`);
  };

  const toggle = (n: "photo" | "illustration" | "logo") =>
    setNeed((s) => {
      const x = new Set(s);
      if (x.has(n)) x.delete(n);
      else x.add(n);
      return x;
    });
  const reset = () => {
    setQ("");
    setCat("Tous");
    setTone("all");
    setNeed(new Set());
  };
  const filtered = q || cat !== "Tous" || tone !== "all" || need.size > 0;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-[#F4F5F8] text-ink" role="dialog" aria-label="Bibliothèque de modèles">
      <header className="flex h-16 flex-none items-center gap-3 border-b border-line bg-surface px-3 sm:px-5">
        <div className="hidden min-w-0 md:block">
          <div className="text-[16px] font-semibold leading-tight">Bibliothèque de modèles</div>
          <div className="text-[12.5px] text-muted">{metas.length} compositions pour le format {FORMATS[format].label} · toutes modifiables</div>
        </div>
        <div className="relative mx-auto w-full max-w-[520px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            className="input h-11 rounded-xl pl-9 text-[14.5px]"
            placeholder="Rechercher : chaudière, plomberie, sombre, photo, élégant…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Rechercher un modèle"
            autoFocus
          />
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="flex h-10 items-center gap-2 rounded-xl px-3 text-[13.5px] font-medium text-muted hover:bg-ink/[0.05] hover:text-ink" aria-label="Fermer la bibliothèque">
            <X className="h-5 w-5" /> <span className="hidden sm:inline">Fermer</span>
          </button>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Filtres */}
        <aside className="hidden w-[248px] flex-none overflow-y-auto border-r border-line bg-surface p-4 lg:block">
          <FilterTitle>Catégories</FilterTitle>
          <div className="space-y-0.5">
            {["Tous", ...CATEGORIES].map((c) =>
              counts[c] || c === "Tous" ? (
                <button key={c} type="button" onClick={() => setCat(c)} className={clsx("flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[13.5px] transition", cat === c ? "bg-brand-soft font-semibold text-brand" : "text-ink hover:bg-canvas")}>
                  {c === "Tous" ? "Tous les modèles" : c}
                  <span className={clsx("text-[12px] tabular-nums", cat === c ? "text-brand" : "text-faint")}>{counts[c] ?? 0}</span>
                </button>
              ) : null,
            )}
          </div>
          <FilterTitle className="mt-5">Format</FilterTitle>
          <div className="grid grid-cols-3 gap-1.5">
            {FORMAT_KEYS.map((f) => (
              <button key={f} type="button" onClick={() => setFormat(f)} aria-pressed={format === f} className={clsx("rounded-lg border py-1.5 text-[12px] font-semibold tabular-nums transition", format === f ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-canvas")}>
                {FORMATS[f].w}×{FORMATS[f].h}
              </button>
            ))}
          </div>
          <FilterTitle className="mt-5">Ambiance</FilterTitle>
          <div className="flex gap-1.5">
            {([["all", "Toutes", null], ["clair", "Claire", Sun], ["sombre", "Sombre", Moon]] as const).map(([v, l, Icon]) => (
              <button key={v} type="button" onClick={() => setTone(v)} className={clsx("flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-[12.5px] font-medium", tone === v ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-canvas")}>
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                {l}
              </button>
            ))}
          </div>
          <FilterTitle className="mt-5">Contient</FilterTitle>
          <div className="space-y-1.5">
            {([["photo", "Une photo", ImageIcon], ["illustration", "Une illustration métier", Brush], ["logo", "Mon logo", Sparkles]] as const).map(([v, l, Icon]) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 text-[13.5px] hover:bg-canvas">
                <input type="checkbox" checked={need.has(v)} onChange={() => toggle(v)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                <Icon className="h-4 w-4 text-faint" /> {l}
              </label>
            ))}
          </div>
          <FilterTitle className="mt-5">Style</FilterTitle>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 text-[13px] leading-snug hover:bg-canvas">
            <input type="checkbox" checked={keepStyle} onChange={(e) => setKeepStyle(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" />
            Appliquer mes couleurs et mes polices actuelles
          </label>
          {photos.length === 0 ? (
            <p className="mt-5 rounded-xl bg-canvas p-3 text-[12px] leading-relaxed text-muted">
              Les modèles « Photo » utilisent vos photos. Sans photo, ils affichent une illustration à la place. Ajoutez-en depuis l&apos;onglet <b>Images</b> de l&apos;éditeur.
            </p>
          ) : null}
        </aside>

        {/* Grille */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {/* Filtres compacts (mobile / tablette) */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-line bg-surface px-3 py-2 lg:hidden">
            {["Tous", ...CATEGORIES].filter((c) => counts[c] || c === "Tous").map((c) => (
              <button key={c} type="button" onClick={() => setCat(c)} className={clsx("flex-none rounded-full px-3 py-1.5 text-[12.5px] font-medium", cat === c ? "bg-ink text-white" : "bg-canvas text-muted ring-1 ring-line")}>
                {c}
              </button>
            ))}
            <select className="input w-auto flex-none py-1 text-[12.5px]" value={format} onChange={(e) => setFormat(e.target.value as FormatKey)} aria-label="Format">
              {FORMAT_KEYS.map((f) => <option key={f} value={f}>{FORMATS[f].w}×{FORMATS[f].h} mm</option>)}
            </select>
          </div>

          <div className="mx-auto max-w-[1400px] p-4 sm:p-6">
            {!filtered ? (
              <div className="mb-7 grid gap-3 sm:grid-cols-2">
                {onClose ? (
                  <button type="button" onClick={onClose} className="group flex items-center gap-4 rounded-2xl bg-surface p-4 text-left ring-1 ring-line transition hover:ring-brand/40">
                    <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-brand-soft text-brand"><PenLine className="h-5 w-5" /></span>
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-semibold">Continuer mon design</span>
                      <span className="block text-[12.5px] text-muted">Revenir à l&apos;éditeur sans rien changer</span>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-brand" />
                  </button>
                ) : null}
                <button type="button" onClick={() => onPick(blankDoc(format, current.palette), "Page blanche : composez librement")} className="group flex items-center gap-4 rounded-2xl border-2 border-dashed border-line bg-surface/60 p-4 text-left transition hover:border-brand">
                  <span className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-canvas text-muted group-hover:text-brand"><FilePlus2 className="h-5 w-5" /></span>
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold">Partir d&apos;une page blanche</span>
                    <span className="block text-[12.5px] text-muted">Votre QR et votre nom, le reste est à composer</span>
                  </span>
                </button>
              </div>
            ) : null}

            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-semibold">{cat === "Tous" ? "Tous les modèles" : cat} <span className="font-normal text-muted">· {list.length}</span></h2>
              {filtered ? <button type="button" onClick={reset} className="text-[13px] font-medium text-brand">Effacer les filtres</button> : null}
            </div>

            {list.length === 0 ? (
              <div className="rounded-2xl bg-surface p-10 text-center ring-1 ring-line">
                <p className="text-[14.5px] font-medium">Aucun modèle ne correspond.</p>
                <p className="mt-1 text-[13px] text-muted">Essayez un autre mot, un autre format, ou partez d&apos;une page blanche.</p>
                <button type="button" onClick={reset} className="btn-secondary mt-4">Effacer les filtres</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {list.map(({ t, tags }) => (
                  <article key={t.key} className="group overflow-hidden rounded-2xl bg-surface ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lift hover:ring-brand/30" data-template={t.key}>
                    <button type="button" onClick={() => setPreview(t.key)} className="block w-full text-left" aria-label={`Aperçu du modèle ${t.name}`}>
                      <Scene kind={sceneOf(t)} className="aspect-[4/3]">
                        {thumbs[t.key] ? (
                          <div className="label-svg w-[62%] max-w-[300px] drop-shadow-[0_10px_18px_rgb(15_23_42/0.28)] transition duration-300 group-hover:scale-[1.03]" style={{ width: `${FORMATS[format].w === FORMATS[format].h ? 46 : 64}%` }} dangerouslySetInnerHTML={{ __html: thumbs[t.key]! }} />
                        ) : (
                          <div className="aspect-[3/2] w-[60%] animate-pulse rounded-lg bg-white/60" />
                        )}
                        <span className="absolute bottom-2 right-2 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] font-medium text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                          <Eye className="mr-1 inline h-3 w-3" />Aperçu
                        </span>
                      </Scene>
                    </button>
                    <div className="flex items-center gap-3 p-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-[14.5px] font-semibold">{t.name}</h3>
                          <span className="flex-none rounded-full bg-canvas px-2 py-0.5 text-[11px] text-muted ring-1 ring-line">{t.category}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[12.5px] text-muted" title={t.description}>{t.description}</p>
                      </div>
                      <button type="button" onClick={() => use(t.key)} className="flex-none rounded-lg bg-brand px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-brand-strong">
                        Utiliser
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 px-3.5 pb-3.5">
                      {[...tags].filter((x) => x !== "clair").map((x) => (
                        <span key={x} className="rounded-md bg-canvas px-1.5 py-0.5 text-[10.5px] font-medium text-muted">{TAG_LABEL[x]}{x === "photo" && !photo ? " (illustration sans photo)" : ""}</span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <p className="mt-8 text-center text-[12px] text-faint">Chaque modèle est vérifié : QR relu automatiquement, textes lisibles, marges de découpe respectées.</p>
          </div>
        </main>
      </div>

      {preview ? (
        <Preview
          t={TEMPLATES.find((x) => x.key === preview)!}
          format={format}
          setFormat={setFormat}
          data={data}
          logoHref={logoHref}
          hrefs={hrefs}
          photo={photo}
          current={current}
          onClose={() => setPreview(null)}
          onUse={(o) => use(preview, o)}
        />
      ) : null}
    </div>
  );
}

function FilterTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted", className)}>{children}</div>;
}

function Preview({
  t, format, setFormat, data, logoHref, hrefs, photo, current, onClose, onUse,
}: {
  t: TemplateDef;
  format: FormatKey;
  setFormat: (f: FormatKey) => void;
  data: LabelData;
  logoHref: string | null;
  hrefs: Record<string, string>;
  photo: string | null;
  current: LabelDoc;
  onClose: () => void;
  onUse: (o: { palette?: Palette; fonts?: { heading: FontKey; body: FontKey } }) => void;
}) {
  const base = paletteByKey(t.palette);
  // Harmonies proposées : celle du modèle, la vôtre, puis des harmonies contrastées et lisibles.
  const palettes = useMemo(() => {
    const out: { label: string; palette: Palette }[] = [{ label: "D'origine", palette: base }, { label: "Mes couleurs", palette: current.palette }];
    for (const p of PALETTES) if (out.length < 8 && contrastRatio(p.palette.ink, p.palette.paper) >= 4.5 && p.palette.primary !== base.primary && p.palette.primary !== current.palette.primary) out.push(p);
    return out;
  }, [base, current.palette]);
  const [pi, setPi] = useState(0);
  const [fi, setFi] = useState(-1);
  const scene = sceneOf(t);
  const [sceneKind, setSceneKind] = useState<SceneKind>(scene);
  const fmts = formatsOf(t);
  const fmt = fmts.includes(format) ? format : fmts[0]!;
  const override = { palette: palettes[pi]!.palette, ...(fi >= 0 ? { fonts: { heading: FONT_PAIRS[fi]!.heading, body: FONT_PAIRS[fi]!.body } } : {}) };
  const { svg, label } = useMemo(() => {
    const doc = buildTemplate(t.key, fmt, { ...override, logo: !!data.logo, photo });
    const l = renderDoc(doc, data);
    return { svg: labelSvg(l, { logoHref, images: hrefs, pxWidth: 520 }), label: l };
  }, [t.key, fmt, pi, fi, data, logoHref, hrefs, photo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const f = FORMATS[fmt];
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/55 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-3xl bg-surface shadow-lift md:flex-row" onClick={(e) => e.stopPropagation()}>
        <div className="relative min-h-[300px] flex-1">
          <Scene kind={sceneKind} className="h-full min-h-[300px]">
            <div className="label-svg drop-shadow-[0_18px_30px_rgb(15_23_42/0.32)]" style={{ width: `${Math.min(78, f.w * 0.95)}%` }} dangerouslySetInnerHTML={{ __html: svg }} />
          </Scene>
          <div className="absolute bottom-3 left-3 flex gap-1 rounded-full bg-white/80 p-1 backdrop-blur">
            {SCENES.map((s) => (
              <button key={s} type="button" onClick={() => setSceneKind(s)} className={clsx("rounded-full px-2.5 py-1 text-[11px] font-medium", sceneKind === s ? "bg-ink text-white" : "text-ink/70 hover:text-ink")}>
                {SCENE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex w-full flex-none flex-col overflow-y-auto border-t border-line p-5 md:w-[340px] md:border-l md:border-t-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[12px] font-medium text-brand">{t.category}</div>
              <h3 className="text-[20px] font-semibold leading-tight">{t.name}</h3>
            </div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-ink/[0.05]" aria-label="Fermer l'aperçu"><X className="h-4 w-4" /></button>
          </div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{t.description}</p>

          <div className="mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Format</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FORMAT_KEYS.map((k) => (
              <button key={k} type="button" disabled={!fmts.includes(k)} onClick={() => setFormat(k)} className={clsx("rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold tabular-nums disabled:opacity-35", fmt === k ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-canvas")}>
                {FORMATS[k].w}×{FORMATS[k].h}
              </button>
            ))}
          </div>

          <div className="mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Couleurs</div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {palettes.map((p, i) => (
              <button key={i} type="button" onClick={() => setPi(i)} title={p.label} aria-label={`Couleurs : ${p.label}`} className={clsx("rounded-lg p-1 ring-1 transition", pi === i ? "ring-2 ring-brand" : "ring-line hover:ring-faint")}>
                <span className="flex h-6 overflow-hidden rounded-md">
                  {(["paper", "primary", "secondary", "accent", "ink"] as const).map((r) => <span key={r} className="flex-1" style={{ background: p.palette[r] }} />)}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-muted">{p.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Typographie</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setFi(-1)} className={clsx("rounded-lg border px-2.5 py-1.5 text-[12.5px]", fi === -1 ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-canvas")}>D&apos;origine</button>
            {FONT_PAIRS.map((p, i) => (
              <button key={p.key} type="button" onClick={() => setFi(i)} className={clsx("rounded-lg border px-2.5 py-1.5 text-[13px]", fi === i ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-canvas")} style={{ fontFamily: `qrp-${p.heading}` }} title={`${FONTS[p.heading].label} + ${FONTS[p.body].label}`}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-[12.5px]">
            <Check className="h-4 w-4 flex-none text-success" />
            QR {label.qr.size.toFixed(1)} mm relu automatiquement{label.issues.length ? ` · ${label.issues.length} conseil(s) dans l'éditeur` : " · prêt à imprimer"}
          </div>
          <div className="mt-auto pt-5">
            <button type="button" onClick={() => onUse(override)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-[14.5px] font-semibold text-white hover:bg-brand-strong">
              Utiliser et personnaliser <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-2 text-center text-[12px] text-faint">Textes, couleurs, images et position du QR restent modifiables.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
