"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import {
  ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2, X, Lock, Star, ImagePlus, Loader2, ChevronLeft, ChevronRight, Check,
  Palette, Building2, Phone, MousePointerClick, LayoutList, Images, Wrench, BadgeCheck, Clock, MessageSquareText, Link2, Smartphone,
} from "lucide-react";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { Card, CardHeader, Notice } from "@/components/ui";
import { LogoUpload } from "@/components/logo-upload";
import { PublicPageView } from "@/components/public-page/view";
import { ACCENTS, ACCENT_KEYS } from "@/lib/labels/palette";
import { FONTS, FONT_KEYS, type FontKey } from "@/lib/labels/doc";
import { DAYS, type DayHours } from "@/lib/hours";
import {
  PAGE_STYLES, PAGE_STYLE_KEYS, SECTIONS, ACTIONS, CERT_KINDS, PAYMENT_METHODS, LINK_KINDS, isMobile,
  type PageConfig, type PageStyle, type ActionKey, type CertKind, type PaymentKey, type LinkKind,
} from "@/lib/page/config";
import Link from "next/link";
import { FORM_KINDS, REQUEST_KINDS } from "@/lib/page/requests";
import { savePage, saveSlug, uploadPhoto, updatePhoto, deletePhoto } from "../actions";

interface Initial {
  slug: string;
  name: string;
  trade: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  zone: string;
  description: string;
  website: string;
  emergency: string;
  hours: DayHours[];
  hoursNote: string;
  accent: string;
  tipsEnabled: boolean;
  showRequestForm: boolean;
  services: { title: string; description: string; price: string }[];
  tips: { title: string; body: string; url: string }[];
  logoUrl: string | null;
  page: PageConfig;
}
type PhotoItem = { id: string; url: string; w: number; h: number; caption: string };

const NAV = [
  { id: "style", label: "Style", icon: Palette },
  { id: "entreprise", label: "Entreprise", icon: Building2 },
  { id: "contact", label: "Coordonnées", icon: Phone },
  { id: "boutons", label: "Boutons", icon: MousePointerClick },
  { id: "sections", label: "Sections", icon: LayoutList },
  { id: "photos", label: "Photos", icon: Images },
  { id: "services", label: "Services", icon: Wrench },
  { id: "confiance", label: "Confiance", icon: BadgeCheck },
  { id: "horaires", label: "Horaires", icon: Clock },
  { id: "formulaire", label: "Formulaire", icon: MessageSquareText },
  { id: "adresse", label: "Adresse web", icon: Link2 },
];

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const copy = [...list];
  [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  return copy;
}

function Toggle({ name, checked, onChange, label, hint }: { name?: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-[14px] font-medium">{label}</span>
        {hint ? <span className="block text-[13px] text-muted">{hint}</span> : null}
      </span>
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative mt-0.5 h-6 w-10 flex-none rounded-full bg-line transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:bg-brand peer-checked:after:translate-x-4 peer-focus-visible:shadow-ring" />
    </label>
  );
}

const RowBtn = ({ onClick, label, children, danger }: { onClick: () => void; label: string; children: React.ReactNode; danger?: boolean }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label} className={clsx("grid h-9 w-9 flex-none place-items-center rounded-lg text-muted", danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-ink/5")}>
    {children}
  </button>
);

/** Recompresse une photo en JPEG (≤ 1600 px) avant envoi. */
async function toJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image"));
      i.src = url;
    });
    const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("jpeg"))), "image/jpeg", 0.82));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PageEditor({ initial, initialPhotos, baseUrl, slugLocked, brandName }: { initial: Initial; initialPhotos: PhotoItem[]; baseUrl: string; slugLocked: boolean; brandName: string }) {
  const [v, setV] = useState(initial);
  const [photos, setPhotos] = useState(initialPhotos);
  const [logo, setLogo] = useState(initial.logoUrl);
  const [showPreview, setShowPreview] = useState(false);
  const [active, setActive] = useState("style");
  const [highlightDraft, setHighlightDraft] = useState("");
  const set = <K extends keyof Initial>(k: K, val: Initial[K]) => setV((p) => ({ ...p, [k]: val }));
  const setPage = <K extends keyof PageConfig>(k: K, val: PageConfig[K]) => setV((p) => ({ ...p, page: { ...p.page, [k]: val } }));
  const pg = v.page;
  const input = (k: keyof Initial, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <>
      <input className="input" id={k} name={k} value={v[k] as string} onChange={(e) => set(k, e.target.value as never)} {...props} />
      <FieldError name={k} />
    </>
  );
  const setDay = (i: number, patch: Partial<DayHours>) => set("hours", v.hours.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  // Sommaire : section visible.
  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(`sec-${n.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id.replace("sec-", ""));
    }, { rootMargin: "-20% 0px -70% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  const preview = (
    <PublicPageView
      preview
      data={{
        ...v,
        logoUrl: logo,
        brandName,
        code: null,
        install: null,
        tips: v.tips.filter((t) => t.title),
        services: v.services.filter((s) => s.title),
        photos,
        pageUrl: `${baseUrl}/p/${v.slug}`,
        page: { ...pg, links: pg.links.filter((l) => l.url), certifications: pg.certifications.filter((c) => c.label || c.kind !== "autre") },
      }}
    />
  );

  const card = (id: string, title: string, description: React.ReactNode, children: React.ReactNode, action?: React.ReactNode) => (
    <Card id={`sec-${id}`} className="scroll-mt-24">
      <CardHeader title={title} description={description} action={action} />
      <div className="space-y-5 p-5 sm:p-6">{children}</div>
    </Card>
  );

  return (
    <div className="grid gap-8 xl:grid-cols-[150px_minmax(0,1fr)_380px]">
      {/* Sommaire */}
      <nav className="hidden xl:block">
        <div className="sticky top-8 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#sec-${id}`} className={clsx("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition", active === id ? "bg-surface font-medium text-ink shadow-card" : "text-muted hover:text-ink")}>
              <Icon className={clsx("h-4 w-4", active === id ? "text-brand" : "text-faint")} /> {label}
            </a>
          ))}
        </div>
      </nav>

      <div className="min-w-0 space-y-6">
        <ActionForm action={savePage} className="space-y-6" id="page-form">
          <input type="hidden" name="hours" value={JSON.stringify(v.hours)} />
          <input type="hidden" name="services" value={JSON.stringify(v.services)} />
          <input type="hidden" name="tips" value={JSON.stringify(v.tips)} />
          <input type="hidden" name="accent" value={v.accent} />
          <input type="hidden" name="page" value={JSON.stringify(pg)} />

          {/* ───────── Style */}
          {card("style", "Style de la page", "Cinq mises en page différentes, à habiller de votre couleur.", (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PAGE_STYLE_KEYS.map((k) => (
                  <button key={k} type="button" onClick={() => setPage("style", k)} aria-pressed={pg.style === k} className={clsx("rounded-xl border p-2 text-left transition", pg.style === k ? "border-brand shadow-ring" : "border-line hover:border-faint")}>
                    <StyleThumb style={k} color={ACCENTS[v.accent as keyof typeof ACCENTS]?.main ?? "#1D4ED8"} />
                    <div className="mt-2 flex items-center justify-between px-1">
                      <span className="text-[13.5px] font-semibold">{PAGE_STYLES[k].label}</span>
                      {pg.style === k ? <Check className="h-4 w-4 text-brand" /> : null}
                    </div>
                    <div className="px-1 pb-1 text-[11.5px] leading-snug text-muted">{PAGE_STYLES[k].description}</div>
                  </button>
                ))}
              </div>
              <div>
                <span className="label">Couleur principale</span>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_KEYS.map((k) => (
                    <button key={k} type="button" onClick={() => set("accent", k)} title={ACCENTS[k].name} aria-label={ACCENTS[k].name} aria-pressed={v.accent === k} className={clsx("h-9 w-9 rounded-full ring-offset-2 transition", v.accent === k ? "ring-2 ring-ink" : "hover:scale-105")} style={{ background: ACCENTS[k].main }} />
                  ))}
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="font">Police des titres</label>
                  <select id="font" className="input" value={pg.font} onChange={(e) => setPage("font", e.target.value as FontKey | "")} style={{ fontFamily: `qrp-${pg.font || PAGE_STYLES[pg.style].font}` }}>
                    <option value="">Celle du style ({FONTS[PAGE_STYLES[pg.style].font].label})</option>
                    {FONT_KEYS.map((f) => <option key={f} value={f}>{FONTS[f].label} — {FONTS[f].style}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="tagline">Phrase d&apos;accroche</label>
                  <input id="tagline" className="input" value={pg.tagline} maxLength={90} placeholder="Votre confort, notre métier depuis 2009" onChange={(e) => setPage("tagline", e.target.value)} />
                  <FieldError name="page.tagline" />
                </div>
              </div>
            </>
          ))}

          {/* ───────── Entreprise */}
          {card("entreprise", "Entreprise", "Ce que vous êtes et ce qui vous distingue.", (
            <>
              <div>
                <span className="label">Logo</span>
                <LogoUpload current={initial.logoUrl} onChange={setLogo} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className="label" htmlFor="name">Nom de l&apos;entreprise</label>{input("name", { required: true, maxLength: 80 })}</div>
                <div><label className="label" htmlFor="trade">Métier</label>{input("trade", { placeholder: "Chauffagiste · Plombier", maxLength: 80 })}</div>
              </div>
              <div>
                <label className="label" htmlFor="description">Présentation</label>
                <textarea className="input min-h-[110px]" id="description" name="description" maxLength={1200} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Ce que vous faites, depuis quand, vos spécialités, votre façon de travailler." />
                <FieldError name="description" />
              </div>
              <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
                <div>
                  <label className="label" htmlFor="foundedYear">Année de création</label>
                  <input id="foundedYear" className="input" inputMode="numeric" maxLength={4} value={pg.foundedYear || ""} placeholder="2009" onChange={(e) => setPage("foundedYear", Number(e.target.value.replace(/\D/g, "").slice(0, 4)) || 0)} />
                  <FieldError name="page.foundedYear" />
                </div>
                <div>
                  <span className="label">Points forts (6 maximum)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {pg.highlights.map((h, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[12.5px] font-medium text-brand">
                        {h}
                        <button type="button" onClick={() => setPage("highlights", pg.highlights.filter((_, j) => j !== i))} aria-label={`Retirer ${h}`}><X className="h-3.5 w-3.5" /></button>
                      </span>
                    ))}
                  </div>
                  {pg.highlights.length < 6 ? (
                    <div className="mt-2 flex gap-2">
                      <input className="input py-2" value={highlightDraft} maxLength={40} placeholder="Ex. : Devis gratuit" onChange={(e) => setHighlightDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (highlightDraft.trim()) { setPage("highlights", [...pg.highlights, highlightDraft.trim()]); setHighlightDraft(""); } } }} aria-label="Nouveau point fort" />
                      <button type="button" className="rounded-lg border border-line px-3 text-[13px] font-medium hover:bg-canvas" onClick={() => { if (highlightDraft.trim()) { setPage("highlights", [...pg.highlights, highlightDraft.trim()]); setHighlightDraft(""); } }}>Ajouter</button>
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {["Devis gratuit", "Intervention sous 24 h", "Contrat d'entretien", "Artisan local", "Dépannage 7j/7"].filter((h) => !pg.highlights.includes(h)).slice(0, 6 - pg.highlights.length).map((h) => (
                      <button key={h} type="button" onClick={() => setPage("highlights", [...pg.highlights, h])} className="rounded-full border border-dashed border-line px-2 py-0.5 text-[11.5px] text-muted hover:border-brand hover:text-brand">+ {h}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="emergency">Message important (facultatif)</label>
                <textarea className="input min-h-[64px]" id="emergency" name="emergency" maxLength={300} value={v.emergency} onChange={(e) => set("emergency", e.target.value)} placeholder="Ex. : En cas d'odeur de gaz, quittez le logement et appelez le 0 800 47 33 33." />
                <FieldError name="emergency" />
              </div>
            </>
          ))}

          {/* ───────── Coordonnées */}
          {card("contact", "Coordonnées et liens", "Chaque bouton n'apparaît que si l'information est renseignée.", (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className="label" htmlFor="phone">Téléphone</label>{input("phone", { type: "tel", placeholder: "06 12 34 56 78", inputMode: "tel" })}</div>
                <div>
                  <label className="label" htmlFor="whatsapp">WhatsApp</label>
                  <div className="flex gap-2">
                    <input id="whatsapp" className="input" type="tel" value={pg.whatsapp} placeholder="Numéro WhatsApp" onChange={(e) => setPage("whatsapp", e.target.value)} />
                    {v.phone && isMobile(v.phone) && pg.whatsapp !== v.phone ? <button type="button" onClick={() => setPage("whatsapp", v.phone)} className="whitespace-nowrap rounded-lg border border-line px-2.5 text-[12.5px] font-medium hover:bg-canvas">Mon mobile</button> : null}
                  </div>
                  <FieldError name="page.whatsapp" />
                </div>
                <div><label className="label" htmlFor="email">Email de contact</label>{input("email", { type: "email", placeholder: "contact@entreprise.fr" })}</div>
                <div><label className="label" htmlFor="website">Site internet</label>{input("website", { type: "url", placeholder: "https://" })}</div>
                <div className="sm:col-span-2"><label className="label" htmlFor="address">Adresse</label>{input("address", { placeholder: "12 rue des Artisans", autoComplete: "street-address" })}</div>
                <div><label className="label" htmlFor="postalCode">Code postal</label>{input("postalCode", { inputMode: "numeric", maxLength: 5 })}</div>
                <div><label className="label" htmlFor="city">Ville</label>{input("city")}</div>
                <div className="sm:col-span-2"><label className="label" htmlFor="zone">Zone d&apos;intervention</label>{input("zone", { placeholder: "Lyon et 30 km autour" })}</div>
              </div>
              {v.phone && isMobile(v.phone) ? <Toggle checked={pg.smsEnabled} onChange={(x) => setPage("smsEnabled", x)} label="Proposer un bouton SMS" hint="Utile quand vous êtes sur un chantier et ne pouvez pas décrocher." /> : null}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="googleReviewUrl">Lien pour laisser un avis Google</label>
                  <input id="googleReviewUrl" className="input" type="url" value={pg.googleReviewUrl} placeholder="https://g.page/r/…/review" onChange={(e) => setPage("googleReviewUrl", e.target.value)} />
                  <p className="hint">Google Business Profile → « Demander des avis » → copiez le lien.</p>
                  <FieldError name="page.googleReviewUrl" />
                </div>
                <div>
                  <label className="label" htmlFor="googleMapsUrl">Lien Google Maps (facultatif)</label>
                  <input id="googleMapsUrl" className="input" type="url" value={pg.googleMapsUrl} placeholder="https://maps.app.goo.gl/…" onChange={(e) => setPage("googleMapsUrl", e.target.value)} />
                  <p className="hint">Sinon, l&apos;itinéraire est calculé à partir de votre adresse.</p>
                  <FieldError name="page.googleMapsUrl" />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="label mb-0">Réseaux et liens</span>
                  {pg.links.length < 8 ? <button type="button" onClick={() => setPage("links", [...pg.links, { kind: "facebook", url: "" }])} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand"><Plus className="h-4 w-4" /> Ajouter</button> : null}
                </div>
                <div className="space-y-2">
                  {pg.links.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <select className="input w-36 py-2" value={l.kind} aria-label="Type de lien" onChange={(e) => setPage("links", pg.links.map((x, j) => (j === i ? { ...x, kind: e.target.value as LinkKind } : x)))}>
                        {Object.entries(LINK_KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                      </select>
                      <input className="input py-2" type="url" value={l.url} placeholder="https://" aria-label="Adresse du lien" onChange={(e) => setPage("links", pg.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                      <RowBtn onClick={() => setPage("links", pg.links.filter((_, j) => j !== i))} label="Supprimer le lien" danger><Trash2 className="h-4 w-4" /></RowBtn>
                    </div>
                  ))}
                  <FieldError name="page.links" />
                </div>
              </div>
            </>
          ))}

          {/* ───────── Boutons */}
          {card("boutons", "Boutons d'action", "Ce que votre client peut faire en un geste. Ordre et choix libres.", (
            <>
              <div>
                <span className="label">Bouton principal</span>
                <div className="flex flex-wrap gap-2">
                  {([["call", "Appeler"], ["request", "Demande d'intervention"], ["whatsapp", "WhatsApp"]] as const).map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setPage("primaryAction", k)} aria-pressed={pg.primaryAction === k} className={clsx("rounded-lg border px-3 py-2 text-[13.5px] font-medium transition", pg.primaryAction === k ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-canvas")}>{label}</button>
                  ))}
                </div>
              </div>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {[...pg.actions, ...(Object.keys(ACTIONS) as ActionKey[]).filter((k) => !pg.actions.includes(k))].map((k) => {
                  const on = pg.actions.includes(k);
                  const i = pg.actions.indexOf(k);
                  const need = k === "whatsapp" && !pg.whatsapp ? "Renseignez un numéro WhatsApp" : k === "review" && !pg.googleReviewUrl ? "Renseignez le lien d'avis Google" : k === "email" && !v.email ? "Renseignez un email" : k === "directions" && !v.address && !pg.googleMapsUrl ? "Renseignez une adresse" : k === "website" && !v.website ? "Renseignez un site" : k === "call" && !v.phone ? "Renseignez un téléphone" : k === "sms" && !(pg.smsEnabled && isMobile(v.phone)) ? "Activez le SMS (mobile requis)" : "";
                  return (
                    <li key={k} className="flex items-center gap-3 px-3 py-2">
                      <input type="checkbox" checked={on} aria-label={`Afficher ${ACTIONS[k].label}`} onChange={(e) => setPage("actions", e.target.checked ? [...pg.actions, k] : pg.actions.filter((x) => x !== k))} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                      <span className={clsx("flex-1 text-[14px]", !on && "text-muted")}>{ACTIONS[k].label}{need && on ? <span className="ml-2 text-[12px] text-warn">· {need}</span> : null}</span>
                      {on ? (
                        <>
                          <RowBtn onClick={() => setPage("actions", move(pg.actions, i, -1))} label="Monter"><ArrowUp className="h-4 w-4" /></RowBtn>
                          <RowBtn onClick={() => setPage("actions", move(pg.actions, i, 1))} label="Descendre"><ArrowDown className="h-4 w-4" /></RowBtn>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <Toggle checked={pg.stickyBar} onChange={(x) => setPage("stickyBar", x)} label="Barre d'appel fixe en bas de l'écran" hint="Le bouton principal reste toujours à portée de pouce pendant la lecture." />
            </>
          ))}

          {/* ───────── Sections */}
          {card("sections", "Sections de la page", "Ordre et affichage. Une section vide ne s'affiche jamais.", (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {pg.sections.map((s, i) => (
                <li key={s.key} className="flex items-center gap-3 px-3 py-2">
                  <RowBtn onClick={() => setPage("sections", pg.sections.map((x, j) => (j === i ? { ...x, visible: !x.visible } : x)))} label={s.visible ? "Masquer" : "Afficher"}>{s.visible ? <Eye className="h-4 w-4 text-brand" /> : <EyeOff className="h-4 w-4" />}</RowBtn>
                  <span className="min-w-0 flex-1">
                    <span className={clsx("block text-[14px] font-medium", !s.visible && "text-muted line-through")}>{SECTIONS[s.key].label}</span>
                    <span className="block truncate text-[12px] text-muted">{SECTIONS[s.key].hint}</span>
                  </span>
                  <RowBtn onClick={() => setPage("sections", move(pg.sections, i, -1))} label="Monter"><ArrowUp className="h-4 w-4" /></RowBtn>
                  <RowBtn onClick={() => setPage("sections", move(pg.sections, i, 1))} label="Descendre"><ArrowDown className="h-4 w-4" /></RowBtn>
                </li>
              ))}
            </ul>
          ))}

          {/* ───────── Photos (enregistrées immédiatement) */}
          <PhotosCard photos={photos} setPhotos={setPhotos} cover={pg.coverPhotoId} setCover={(id) => setPage("coverPhotoId", id)} />

          {/* ───────── Services */}
          {card("services", "Services", "Vos prestations, avec une indication de prix si vous le souhaitez.", (
            <>
              {v.services.length === 0 ? <p className="text-[14px] text-muted">Aucun service. Ajoutez par exemple « Entretien de chaudière ».</p> : null}
              {v.services.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1.1fr_130px]">
                    <input className="input" placeholder="Intitulé" value={s.title} maxLength={80} aria-label={`Service ${i + 1}`} onChange={(e) => set("services", v.services.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                    <input className="input" placeholder="Précision (facultatif)" value={s.description} maxLength={160} aria-label={`Précision du service ${i + 1}`} onChange={(e) => set("services", v.services.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                    <input className="input" placeholder="Prix (facultatif)" value={s.price} maxLength={40} aria-label={`Prix du service ${i + 1}`} onChange={(e) => set("services", v.services.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row">
                    <RowBtn onClick={() => set("services", move(v.services, i, -1))} label="Monter"><ArrowUp className="h-4 w-4" /></RowBtn>
                    <RowBtn onClick={() => set("services", move(v.services, i, 1))} label="Descendre"><ArrowDown className="h-4 w-4" /></RowBtn>
                    <RowBtn onClick={() => set("services", v.services.filter((_, j) => j !== i))} label="Supprimer" danger><Trash2 className="h-4 w-4" /></RowBtn>
                  </div>
                </div>
              ))}
              <FieldError name="services" />
            </>
          ), <button type="button" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand" aria-label="Ajouter un service" onClick={() => set("services", [...v.services, { title: "", description: "", price: "" }])} disabled={v.services.length >= 20}><Plus className="h-4 w-4" /> Ajouter</button>)}

          {/* ───────── Confiance */}
          {card("confiance", "Certifications, assurances et garanties", "Affichées seulement si elles sont valides à la date du jour.", (
            <>
              {pg.certifications.map((c, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-line p-3">
                  <div className="flex gap-2">
                    <select className="input py-2" value={c.kind} aria-label="Type de certification" onChange={(e) => setPage("certifications", pg.certifications.map((x, j) => (j === i ? { ...x, kind: e.target.value as CertKind } : x)))}>
                      {Object.entries(CERT_KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                    <RowBtn onClick={() => setPage("certifications", pg.certifications.filter((_, j) => j !== i))} label="Supprimer" danger><Trash2 className="h-4 w-4" /></RowBtn>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input className="input py-2" placeholder="Intitulé affiché (facultatif)" value={c.label} maxLength={60} aria-label="Intitulé" onChange={(e) => setPage("certifications", pg.certifications.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                    <input className="input py-2" placeholder="N° ou assureur (facultatif)" value={c.detail} maxLength={80} aria-label="Détail" onChange={(e) => setPage("certifications", pg.certifications.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))} />
                    <label className="text-[12.5px] text-muted">Valide jusqu&apos;au
                      <input className="input mt-1 py-2" type="date" value={c.validUntil} onChange={(e) => setPage("certifications", pg.certifications.map((x, j) => (j === i ? { ...x, validUntil: e.target.value } : x)))} />
                    </label>
                    <label className="text-[12.5px] text-muted">Lien de vérification (facultatif)
                      <input className="input mt-1 py-2" type="url" placeholder="https://" value={c.url} onChange={(e) => setPage("certifications", pg.certifications.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                    </label>
                  </div>
                </div>
              ))}
              <FieldError name="page.certifications" />
              <div>
                <span className="label">Moyens de paiement acceptés</span>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(PAYMENT_METHODS) as PaymentKey[]).map((k) => {
                    const on = pg.payments.includes(k);
                    return (
                      <button key={k} type="button" aria-pressed={on} onClick={() => setPage("payments", on ? pg.payments.filter((x) => x !== k) : [...pg.payments, k])} className={clsx("rounded-full border px-3 py-1.5 text-[13px] transition", on ? "border-brand bg-brand-soft font-medium text-brand" : "border-line text-muted hover:text-ink")}>
                        {on ? "✓ " : ""}{PAYMENT_METHODS[k]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ), pg.certifications.length < 10 ? <button type="button" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand" onClick={() => setPage("certifications", [...pg.certifications, { kind: "rge", label: "", detail: "", validUntil: "", url: "" }])}><Plus className="h-4 w-4" /> Ajouter</button> : null)}

          {/* ───────── Horaires */}
          <Card id="sec-horaires" className="scroll-mt-24">
            <CardHeader title="Horaires" description="Le statut « ouvert maintenant », « ferme bientôt » ou « ouvre demain à 8 h » est calculé en direct." />
            <div className="divide-y divide-line">
              {v.hours.map((d, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 sm:px-6">
                  <label className="flex w-32 items-center gap-2.5 text-[14px] font-medium">
                    <input type="checkbox" checked={d.open} onChange={(e) => setDay(i, { open: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                    {DAYS[i]}
                  </label>
                  {d.open ? (
                    <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
                      <input type="time" className="input w-[110px] py-1.5" value={d.from} onChange={(e) => setDay(i, { from: e.target.value })} aria-label={`${DAYS[i]} ouverture`} />
                      <span>à</span>
                      <input type="time" className="input w-[110px] py-1.5" value={d.to} onChange={(e) => setDay(i, { to: e.target.value })} aria-label={`${DAYS[i]} fermeture`} />
                      {d.breakFrom ? (
                        <>
                          <span className="ml-1">pause</span>
                          <input type="time" className="input w-[110px] py-1.5" value={d.breakFrom} onChange={(e) => setDay(i, { breakFrom: e.target.value })} aria-label={`${DAYS[i]} début de pause`} />
                          <span>à</span>
                          <input type="time" className="input w-[110px] py-1.5" value={d.breakTo} onChange={(e) => setDay(i, { breakTo: e.target.value })} aria-label={`${DAYS[i]} fin de pause`} />
                          <button type="button" onClick={() => setDay(i, { breakFrom: "", breakTo: "" })} className="grid h-8 w-8 place-items-center rounded-md hover:bg-ink/5" aria-label="Retirer la pause"><X className="h-4 w-4" /></button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setDay(i, { breakFrom: "12:00", breakTo: "14:00" })} className="text-[13px] font-medium text-brand">+ pause</button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[13.5px] text-faint">Fermé</span>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-line p-5 sm:p-6">
              <label className="label" htmlFor="hoursNote">Précision (facultatif)</label>
              {input("hoursNote", { placeholder: "Astreinte le week-end pour les clients sous contrat", maxLength: 200 })}
              <FieldError name="hours" />
            </div>
          </Card>

          {/* ───────── Formulaire et conseils */}
          {card("formulaire", "Demandes et conseils", "Chaque demande arrive dans « Demandes reçues » et vous est notifiée selon vos préférences.", (
            <>
              <Toggle name="showRequestForm" checked={v.showRequestForm} onChange={(x) => set("showRequestForm", x)} label="Proposer le formulaire « Demander une intervention »" />
              {v.showRequestForm ? (
                <div className="space-y-4 rounded-xl bg-canvas p-4">
                  <div>
                    <div className="label">Demandes proposées à vos clients</div>
                    <div className="grid grid-cols-2 gap-2">
                      {FORM_KINDS.map((k) => {
                        const on = pg.requestTypes.includes(k);
                        return (
                          <label key={k} className={clsx("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13.5px]", on ? "border-brand bg-brand-soft/60" : "border-line bg-surface")}>
                            <input type="checkbox" checked={on} onChange={(e) => setPage("requestTypes", e.target.checked ? [...pg.requestTypes, k] : pg.requestTypes.filter((x) => x !== k).length ? pg.requestTypes.filter((x) => x !== k) : pg.requestTypes)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                            {REQUEST_KINDS[k]}
                          </label>
                        );
                      })}
                    </div>
                    <p className="hint">Chacune a son bouton sur votre page (Intervention, Devis, Urgence, Message).</p>
                  </div>
                  <div>
                    <label className="label" htmlFor="requestProblems">Problèmes proposés (un par ligne)</label>
                    <textarea
                      id="requestProblems"
                      className="input min-h-[120px]"
                      value={pg.requestProblems.join("\n")}
                      onChange={(e) => setPage("requestProblems", e.target.value.split("\n").map((x) => x.slice(0, 40)).slice(0, 12))}
                      onBlur={(e) => setPage("requestProblems", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 12))}
                    />
                    <p className="hint">Le client les choisit d&apos;un geste : « Chaudière en panne », « Fuite d&apos;eau »… (12 maximum).</p>
                  </div>
                  <div>
                    <div className="label">Adresse de l&apos;intervention</div>
                    <div className="flex flex-wrap gap-2">
                      {([["required", "Obligatoire"], ["optional", "Facultative"], ["off", "Ne pas demander"]] as const).map(([val, l]) => (
                        <button key={val} type="button" onClick={() => setPage("requestAddress", val)} aria-pressed={pg.requestAddress === val} className={clsx("rounded-lg border px-3 py-1.5 text-[13px] font-medium", pg.requestAddress === val ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface")}>{l}</button>
                      ))}
                    </div>
                    <p className="hint">Saisie assistée : l&apos;adresse se complète automatiquement (Base Adresse Nationale).</p>
                  </div>
                  <Toggle checked={pg.requestKinds} onChange={(x) => setPage("requestKinds", x)} label="Laisser le client choisir le type de demande" hint="Sinon, le formulaire est une simple demande d'intervention." />
                  <Toggle checked={pg.requestAvailability} onChange={(x) => setPage("requestAvailability", x)} label="Demander ses disponibilités" hint="Créneaux à cocher (matin, après-midi, samedi…) et précision libre." />
                  <Toggle checked={pg.requestPhotos} onChange={(x) => setPage("requestPhotos", x)} label="Permettre de joindre photos et documents PDF" hint="5 fichiers maximum : code erreur, plaque signalétique, plan, devis concurrent…" />
                  <div>
                    <label className="label" htmlFor="requestIntro">Message d&apos;accueil du formulaire (facultatif)</label>
                    <input id="requestIntro" className="input" maxLength={200} value={pg.requestIntro} onChange={(e) => setPage("requestIntro", e.target.value)} placeholder="Réponse sous 24 h ouvrées. Pour une urgence, appelez directement." />
                  </div>
                  <p className="text-[12.5px] text-muted">Comment être prévenu des nouvelles demandes : <Link href="/espace/notifications" className="link">Notifications</Link>.</p>
                </div>
              ) : null}
              <Toggle name="tipsEnabled" checked={v.tipsEnabled} onChange={(x) => set("tipsEnabled", x)} label="Afficher la rubrique « Conseils utiles »" />
              {v.tipsEnabled ? (
                <div className="space-y-3">
                  {v.tips.map((t, i) => (
                    <div key={i} className="space-y-2 rounded-xl border border-line p-3">
                      <div className="flex gap-2">
                        <input className="input" placeholder="Titre (ex. : Remettre la chaudière en pression)" value={t.title} maxLength={80} aria-label={`Titre du conseil ${i + 1}`} onChange={(e) => set("tips", v.tips.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                        <RowBtn onClick={() => set("tips", v.tips.filter((_, j) => j !== i))} label="Supprimer le conseil" danger><Trash2 className="h-4 w-4" /></RowBtn>
                      </div>
                      <textarea className="input min-h-[70px]" placeholder="Le conseil en quelques lignes" value={t.body} maxLength={1000} aria-label={`Texte du conseil ${i + 1}`} onChange={(e) => set("tips", v.tips.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
                      <input className="input" type="url" placeholder="Lien vers un document (facultatif) : https://…" value={t.url} maxLength={300} aria-label={`Lien du conseil ${i + 1}`} onChange={(e) => set("tips", v.tips.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                    </div>
                  ))}
                  {v.tips.length < 15 ? <button type="button" className="inline-flex items-center gap-1 text-[13px] font-medium text-brand" aria-label="Ajouter un conseil" onClick={() => set("tips", [...v.tips, { title: "", body: "", url: "" }])}><Plus className="h-4 w-4" /> Ajouter un conseil</button> : null}
                  <FieldError name="tips" />
                </div>
              ) : null}
            </>
          ))}

          <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-lift backdrop-blur">
            <button type="button" onClick={() => setShowPreview(true)} className="inline-flex items-center gap-2 text-[14px] font-medium text-muted hover:text-ink xl:invisible">
              <Smartphone className="h-4 w-4" /> Aperçu
            </button>
            <SubmitButton pendingLabel="Enregistrement…">Enregistrer ma page</SubmitButton>
          </div>
        </ActionForm>

        <Card id="sec-adresse" className="scroll-mt-24">
          <CardHeader title="Adresse de la page" description="L'adresse contenue dans vos QR codes." />
          <div className="p-5 sm:p-6">
            {slugLocked ? (
              <Notice>
                <span className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-4 w-4 flex-none" />
                  <span><b>{baseUrl}/p/{initial.slug}</b> est définitive : vos étiquettes l&apos;utilisent déjà. Tout le contenu reste modifiable.</span>
                </span>
              </Notice>
            ) : (
              <ActionForm action={saveSlug} className="space-y-2">
                <label className="label" htmlFor="slug">Adresse</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex flex-1 items-center rounded-lg border border-line bg-canvas pl-3 text-[14px] text-muted focus-within:border-brand/60 focus-within:shadow-ring">
                    <span className="whitespace-nowrap">{baseUrl.replace(/^https?:\/\//, "")}/p/</span>
                    <input id="slug" name="slug" defaultValue={initial.slug} className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-ink outline-none" />
                  </div>
                  <SubmitButton variant="secondary">Modifier</SubmitButton>
                </div>
                <FieldError name="slug" />
                <p className="hint">Modifiable jusqu&apos;à la création de vos premières étiquettes, puis définitive.</p>
              </ActionForm>
            )}
          </div>
        </Card>
      </div>

      {/* Aperçu téléphone */}
      <div className="hidden xl:block">
        <div className="sticky top-8">
          <div className="mb-2 flex items-center justify-between text-[13px] text-muted">
            <span className="font-medium text-ink">Aperçu en direct</span>
            <span>{PAGE_STYLES[pg.style].label}</span>
          </div>
          <div className="rounded-[40px] border border-line bg-ink p-2.5 shadow-lift">
            <div className="relative h-[740px] overflow-y-auto overflow-x-hidden rounded-[32px] bg-white [scrollbar-width:none]">{preview}</div>
          </div>
        </div>
      </div>

      {showPreview ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white xl:hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[14px] font-semibold">Aperçu de votre page</span>
            <button type="button" onClick={() => setShowPreview(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-ink/5" aria-label="Fermer l'aperçu"><X className="h-5 w-5" /></button>
          </div>
          <div className="relative flex-1 overflow-y-auto">{preview}</div>
        </div>
      ) : null}
    </div>
  );
}

/** Miniature schématique de chaque style (aide au choix, sans charger d'image). */
function StyleThumb({ style, color }: { style: PageStyle; color: string }) {
  const dark = style === "nuit";
  return (
    <div className={clsx("relative h-[92px] overflow-hidden rounded-lg", dark ? "bg-[#0A0F1E]" : style === "chaleureux" ? "bg-[#FBF6EF]" : style === "epure" ? "bg-white ring-1 ring-line" : style === "immersif" ? "bg-[#F4F2EF]" : "bg-[#F2F4F7]")}>
      {style === "moderne" ? (<><div className="h-8" style={{ background: color }} /><div className="absolute inset-x-2 top-4 h-12 rounded-md bg-white shadow" /><div className="absolute bottom-2 left-4 h-2 w-14 rounded bg-slate-300" /></>) : null}
      {style === "immersif" ? (<><div className="h-14 bg-gradient-to-br from-stone-500 to-stone-800" /><div className="absolute left-2 top-7 h-2 w-16 rounded bg-white/90" /><div className="absolute inset-x-2 top-[60px] flex gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-5 flex-1 rounded bg-white shadow-sm" />)}</div></>) : null}
      {style === "epure" ? (<><div className="absolute left-3 top-3 h-1.5 w-8 rounded" style={{ background: color }} /><div className="absolute left-3 top-6 h-3.5 w-24 rounded bg-neutral-800" /><div className="absolute left-3 top-11 h-3.5 w-16 rounded bg-neutral-800" /><div className="absolute inset-x-3 bottom-4 h-px bg-neutral-300" /><div className="absolute inset-x-3 bottom-2 h-px bg-neutral-300" /></>) : null}
      {style === "nuit" ? (<><div className="absolute left-1/2 top-0 h-16 w-28 -translate-x-1/2 rounded-full opacity-60 blur-xl" style={{ background: color }} /><div className="absolute left-1/2 top-4 h-7 w-7 -translate-x-1/2 rounded-md bg-white/80" /><div className="absolute left-1/2 top-[50px] h-2 w-16 -translate-x-1/2 rounded bg-white/80" /><div className="absolute inset-x-3 bottom-2 h-5 rounded-md" style={{ background: color }} /></>) : null}
      {style === "chaleureux" ? (<><div className="absolute -right-4 -top-4 h-14 w-14 rounded-full opacity-40" style={{ background: color }} /><div className="absolute inset-x-2 top-3 h-[72px] rounded-2xl bg-white ring-1 ring-stone-200" /><div className="absolute left-4 top-6 h-6 w-6 rounded-lg" style={{ background: color }} /><div className="absolute left-12 top-7 h-2 w-14 rounded bg-stone-700" /></>) : null}
    </div>
  );
}

function PhotosCard({ photos, setPhotos, cover, setCover }: { photos: PhotoItem[]; setPhotos: (fn: (p: PhotoItem[]) => PhotoItem[]) => void; cover: string; setCover: (id: string) => void }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = (files: FileList) =>
    start(async () => {
      setMsg("");
      for (const f of Array.from(files).slice(0, 12)) {
        try {
          const blob = await toJpeg(f);
          const fd = new FormData();
          fd.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
          const res = await uploadPhoto(fd);
          if (!res.ok || !res.photo) {
            setMsg(res.message);
            break;
          }
          const p = res.photo;
          setPhotos((ps) => [...ps, { id: p.id, url: URL.createObjectURL(blob), w: p.w, h: p.h, caption: "" }]);
        } catch {
          setMsg("Une image n'a pas pu être lue.");
        }
      }
    });
  return (
    <Card id="sec-photos" className="scroll-mt-24">
      <CardHeader
        title="Photos de réalisations"
        description="Chantiers, installations, équipe : rien ne rassure davantage. Enregistrées immédiatement."
        action={
          <button type="button" disabled={pending} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Ajouter des photos
          </button>
        }
      />
      <div className="p-5 sm:p-6">
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
        {photos.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p, i) => {
              const isCover = cover ? cover === p.id : i === 0;
              return (
                <div key={p.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                  <div className="relative aspect-[4/3] bg-canvas">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption} className="h-full w-full object-cover" />
                    {isCover ? <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-semibold text-white">Couverture</span> : null}
                  </div>
                  <div className="p-2">
                    <input
                      className="input py-1.5 text-[12.5px]"
                      placeholder="Légende (facultatif)"
                      defaultValue={p.caption}
                      maxLength={120}
                      aria-label={`Légende de la photo ${i + 1}`}
                      onBlur={(e) => {
                        const caption = e.target.value;
                        if (caption === p.caption) return;
                        setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, caption } : x)));
                        void updatePhoto(p.id, { caption });
                      }}
                    />
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex">
                        <RowBtn label="Déplacer à gauche" onClick={() => { setPhotos((ps) => move(ps, i, -1)); void updatePhoto(p.id, { move: -1 }); }}><ChevronLeft className="h-4 w-4" /></RowBtn>
                        <RowBtn label="Déplacer à droite" onClick={() => { setPhotos((ps) => move(ps, i, 1)); void updatePhoto(p.id, { move: 1 }); }}><ChevronRight className="h-4 w-4" /></RowBtn>
                        <RowBtn label="Utiliser en couverture (style Immersif)" onClick={() => setCover(p.id)}><Star className={clsx("h-4 w-4", isCover && "fill-amber-400 text-amber-500")} /></RowBtn>
                      </div>
                      <RowBtn label="Supprimer la photo" danger onClick={async () => { const res = await deletePhoto(p.id); if (!res.ok) { setMsg(res.message ?? "Suppression impossible."); return; } setPhotos((ps) => ps.filter((x) => x.id !== p.id)); if (cover === p.id) setCover(""); }}><Trash2 className="h-4 w-4" /></RowBtn>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line py-10 text-[14px] text-muted hover:border-brand hover:text-brand">
            <ImagePlus className="h-6 w-6" /> Ajoutez vos premières photos de réalisations
          </button>
        )}
        {msg ? <p className="mt-3 text-[13px] text-danger">{msg}</p> : null}
        <p className="hint mt-3">La couverture (étoile) est utilisée par le style « Immersif ». Pensez à l&apos;accord de vos clients pour les photos prises chez eux.</p>
      </div>
    </Card>
  );
}
