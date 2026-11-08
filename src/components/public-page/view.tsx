import {
  Phone, Mail, MapPin, Clock, Wrench, CalendarCheck, Globe, UserPlus, AlertTriangle, Lightbulb, ChevronRight, ShieldCheck, ExternalLink,
  MessageCircle, Navigation, Star, Images, BadgeCheck, CreditCard, Sparkles, CalendarPlus, MessageSquareText, Award, Link2, FileText, Siren,
} from "lucide-react";
import { clsx } from "clsx";
import { accent as accentOf } from "@/lib/labels/palette";
import { DAYS, dayLabel, hoursStatus } from "@/lib/hours";
import { phoneFr, telHref, dateFr } from "@/lib/format";
import { PAGE_STYLES, CERT_KINDS, PAYMENT_METHODS, LINK_KINDS, whatsappLink, isMobile, certIsValid, type ActionKey, type SectionKey, type PageStyle } from "@/lib/page/config";
import type { PublicPageData } from "./types";
import { RequestForm } from "./request-form";
import { ActionLink, ShareButton, Gallery, ViewTracker, type TrackAction } from "./interactive";

/**
 * Vitrine publique d'un professionnel. Composant pur : utilisé par la route publique /p/… ET par
 * l'aperçu en direct de l'espace pro (`preview`). Cinq styles aux mises en page différentes ;
 * les sections suivent l'ordre choisi par le pro et n'apparaissent que si l'information existe.
 */

interface Theme {
  dark: boolean;
  page: string;
  card: string;
  pad: string;
  title: string;
  muted: string;
  faint: string;
  line: string;
  tile: string;
  chip: string;
  editorial: boolean;
}

const THEMES: Record<PageStyle, Theme> = {
  moderne: { dark: false, page: "bg-[#F2F4F7] text-slate-900", card: "rounded-2xl bg-white shadow-[0_1px_2px_rgb(15_23_42/0.05),0_10px_30px_-14px_rgb(15_23_42/0.14)]", pad: "p-5", title: "text-[12.5px] font-semibold uppercase tracking-[0.08em] text-slate-500", muted: "text-slate-500", faint: "text-slate-400", line: "border-slate-100", tile: "rounded-2xl border border-slate-200/80 bg-white text-slate-900 hover:border-slate-300", chip: "rounded-full bg-slate-100 text-slate-700", editorial: false },
  immersif: { dark: false, page: "bg-[#F4F2EF] text-stone-900", card: "rounded-[22px] bg-white shadow-[0_1px_2px_rgb(0_0_0/0.05),0_14px_34px_-18px_rgb(0_0_0/0.25)]", pad: "p-5", title: "text-[12.5px] font-semibold uppercase tracking-[0.1em] text-stone-500", muted: "text-stone-500", faint: "text-stone-400", line: "border-stone-100", tile: "rounded-2xl bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/70", chip: "rounded-full bg-stone-100 text-stone-700", editorial: false },
  epure: { dark: false, page: "bg-white text-neutral-900", card: "border-t border-neutral-200", pad: "py-7", title: "text-[22px] font-semibold tracking-[-0.01em] text-neutral-900", muted: "text-neutral-500", faint: "text-neutral-400", line: "border-neutral-200", tile: "border-b border-neutral-200 text-neutral-900", chip: "rounded-full border border-neutral-300 text-neutral-700", editorial: true },
  nuit: { dark: true, page: "bg-[#0A0F1E] text-white", card: "rounded-2xl bg-white/[0.045] ring-1 ring-white/[0.09]", pad: "p-5", title: "text-[12.5px] font-semibold uppercase tracking-[0.12em] text-white/50", muted: "text-white/60", faint: "text-white/40", line: "border-white/10", tile: "rounded-2xl bg-white/[0.06] text-white ring-1 ring-white/10 hover:bg-white/[0.1]", chip: "rounded-full bg-white/[0.08] text-white/80", editorial: false },
  chaleureux: { dark: false, page: "bg-[#FBF6EF] text-stone-900", card: "rounded-[28px] bg-white ring-1 ring-stone-200/70 shadow-[0_2px_0_rgb(120_80_40/0.04)]", pad: "p-6", title: "text-[19px] font-semibold text-stone-900", muted: "text-stone-500", faint: "text-stone-400", line: "border-stone-100", tile: "rounded-[22px] bg-white text-stone-900 ring-1 ring-stone-200/80 hover:ring-stone-300", chip: "rounded-full bg-[var(--accent-soft)] text-stone-800", editorial: false },
};

function initials(name: string) {
  return name.split(/\s+/).filter((w) => w.length > 1 || /\d/.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "•";
}

interface Action {
  key: ActionKey;
  label: string;
  href?: string;
  icon: typeof Phone;
  track: TrackAction;
  external?: boolean;
  download?: boolean;
}

export function PublicPageView({ data, preview = false, now }: { data: PublicPageData; preview?: boolean; now?: Date }) {
  const cfg = data.page;
  const t = THEMES[cfg.style];
  const a = accentOf(data.accent);
  const headingFont = `qrp-${cfg.font || PAGE_STYLES[cfg.style].font}`;
  const status = hoursStatus(data.hours, now);
  const todayIdx = ((now ?? new Date()).getDay() + 6) % 7;
  const addressLine = [data.address, [data.postalCode, data.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const directions = cfg.googleMapsUrl || (addressLine ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${data.name} ${addressLine}`)}` : "");
  const wa = cfg.whatsapp ? whatsappLink(cfg.whatsapp, `Bonjour ${data.name}, `) : null;
  const sms = cfg.smsEnabled && isMobile(data.phone) ? `sms:${data.phone.replace(/[^\d+]/g, "")}` : null;
  const cover = cfg.coverPhotoId ? data.photos.find((p) => p.id === cfg.coverPhotoId) : data.photos[0];
  const code = data.code;
  const slug = data.slug;
  const accentText = t.dark ? a.light : a.main;

  // Boutons disponibles (seulement si l'information existe), dans l'ordre choisi par le pro.
  const available: Partial<Record<ActionKey, Action>> = {
    ...(data.phone ? { call: { key: "call", label: "Appeler", href: telHref(data.phone), icon: Phone, track: "call" } } : {}),
    ...(wa ? { whatsapp: { key: "whatsapp", label: "WhatsApp", href: wa, icon: MessageCircle, track: "whatsapp", external: true } } : {}),
    ...(sms ? { sms: { key: "sms", label: "SMS", href: sms, icon: MessageSquareText, track: "sms" } } : {}),
    ...(data.email ? { email: { key: "email", label: "Email", href: `mailto:${data.email}?subject=${encodeURIComponent("Demande de renseignements")}`, icon: Mail, track: "email" } } : {}),
    ...(data.showRequestForm && cfg.requestTypes.includes("intervention") ? { request: { key: "request", label: "Intervention", href: "#demande", icon: Wrench, track: "request_open" } } : {}),
    ...(data.showRequestForm && cfg.requestTypes.includes("devis") ? { quote: { key: "quote", label: "Devis", href: "#devis", icon: FileText, track: "request_open" } } : {}),
    ...(data.showRequestForm && cfg.requestTypes.includes("urgence") ? { emergency: { key: "emergency", label: "Urgence", href: "#urgence", icon: Siren, track: "request_open" } } : {}),
    ...(data.showRequestForm && cfg.requestTypes.includes("contact") ? { message: { key: "message", label: "Message", href: "#message", icon: MessageSquareText, track: "request_open" } } : {}),
    ...(directions ? { directions: { key: "directions", label: "Itinéraire", href: directions, icon: Navigation, track: "directions", external: true } } : {}),
    save: { key: "save", label: "Contact", href: `/api/vcard/${slug}`, icon: UserPlus, track: "save", download: true },
    share: { key: "share", label: "Partager", icon: Link2, track: "share" },
    ...(cfg.googleReviewUrl ? { review: { key: "review", label: "Avis Google", href: cfg.googleReviewUrl, icon: Star, track: "review", external: true } } : {}),
    ...(data.website ? { website: { key: "website", label: "Site web", href: data.website, icon: Globe, track: "website", external: true } } : {}),
  };
  const actions = cfg.actions.map((k) => available[k]).filter((x): x is Action => !!x);
  const primary = available[cfg.primaryAction] ?? available.call ?? available.request ?? null;
  const tiles = actions.filter((x) => x.key !== primary?.key);

  const primaryLabel = primary?.key === "call" ? `Appeler · ${phoneFr(data.phone)}` : primary?.key === "whatsapp" ? "Écrire sur WhatsApp" : "Demander une intervention";

  const PrimaryButton = ({ className = "" }: { className?: string }) =>
    primary?.href ? (
      <ActionLink href={primary.href} action={primary.track} slug={slug} code={code} preview={preview} external={primary.external} className={clsx("flex h-[54px] items-center justify-center gap-2.5 rounded-2xl text-[16px] font-semibold text-white transition active:scale-[0.99]", className)} style={{ background: a.main, boxShadow: `0 12px 26px -12px ${a.main}` }}>
        <primary.icon className="h-[18px] w-[18px]" /> {primaryLabel}
      </ActionLink>
    ) : null;

  const Tiles = ({ glass = false }: { glass?: boolean }) =>
    tiles.length ? (
      <div className={clsx("grid gap-2", tiles.length === 4 || tiles.length >= 7 ? "grid-cols-4" : tiles.length === 3 || tiles.length === 5 || tiles.length === 6 ? "grid-cols-3" : tiles.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
        {tiles.slice(0, 8).map((x) => {
          const inner = (
            <>
              <x.icon className="h-[19px] w-[19px]" style={{ color: glass ? "#fff" : accentText }} />
              <span className="text-[11.5px] font-medium leading-tight">{x.label}</span>
            </>
          );
          const cls = clsx("flex flex-col items-center justify-center gap-1.5 px-1 py-3 text-center transition active:scale-[0.97]", glass ? "rounded-2xl bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md hover:bg-white/25" : t.editorial ? "rounded-xl border border-neutral-200 hover:bg-neutral-50" : t.tile);
          return x.key === "share" ? (
            <ShareButton key={x.key} url={data.pageUrl} title={data.name} slug={slug} code={code} preview={preview} className={cls}>{inner}</ShareButton>
          ) : (
            <ActionLink key={x.key} href={x.href!} action={x.track} slug={slug} code={code} preview={preview} external={x.external} download={x.download} className={cls}>{inner}</ActionLink>
          );
        })}
      </div>
    ) : null;

  const StatusPill = ({ onDark = false }: { onDark?: boolean }) =>
    status ? (
      <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium", onDark ? "bg-black/25 text-white backdrop-blur" : t.dark ? "bg-white/10 text-white/85" : "bg-black/[0.04]")}>
        <span className={clsx("h-2 w-2 rounded-full", status.open ? (status.soon ? "bg-amber-400" : "bg-emerald-500") : "bg-slate-400")} />
        <span className={clsx(!onDark && !t.dark && (status.open ? "text-emerald-700" : "text-slate-600"))}>{status.label}</span>
      </span>
    ) : null;

  const Logo = ({ size = 64, className = "" }: { size?: number; className?: string }) =>
    data.logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={data.logoUrl} alt="" className={clsx("flex-none rounded-2xl bg-white object-contain p-1.5 ring-1 ring-black/5", className)} style={{ width: size, height: size }} />
    ) : (
      <div className={clsx("grid flex-none place-items-center rounded-2xl font-semibold text-white", className)} style={{ width: size, height: size, background: a.main, fontSize: size * 0.34 }}>{initials(data.name)}</div>
    );

  const since = cfg.foundedYear ? `Depuis ${cfg.foundedYear}` : "";

  // ------------------------------------------------------------------ En-têtes (un par style)

  let hero: React.ReactNode;
  if (cfg.style === "immersif") {
    // Toute la zone (identité + boutons) est posée sur la photo assombrie : contraste garanti.
    hero = (
      <header className="relative overflow-hidden text-white">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `radial-gradient(120% 70% at 0% 0%, ${a.light}66, transparent 60%), linear-gradient(160deg, ${a.main}, #0B0F19 75%)` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/45 to-black/85" />
        <div className="relative px-5 pb-6 pt-44">
          <div className="flex items-center gap-3">
            <Logo size={52} />
            <StatusPill onDark />
          </div>
          <h1 className="mt-3 text-[30px] font-bold leading-[1.05] tracking-[-0.02em]" style={{ fontFamily: headingFont }}>{data.name || "Votre entreprise"}</h1>
          <p className="mt-1.5 text-[15px] text-white/80">{cfg.tagline || data.trade}</p>
          <div className="mt-6 space-y-3">
            <PrimaryButton />
            <Tiles glass />
          </div>
        </div>
      </header>
    );
  } else if (cfg.style === "epure") {
    hero = (
      <header className="px-6 pb-8 pt-8">
        <div className="flex items-center justify-between">
          <Logo size={46} className="rounded-xl" />
          <StatusPill />
        </div>
        <p className="mt-10 text-[12px] font-semibold uppercase tracking-[0.2em]" style={{ color: accentText }}>{data.trade || "Artisan"}</p>
        <h1 className="mt-2 text-[40px] font-semibold leading-[1.02] tracking-[-0.025em]" style={{ fontFamily: headingFont }}>{data.name || "Votre entreprise"}</h1>
        {cfg.tagline ? <p className="mt-4 max-w-[34ch] text-[17px] leading-relaxed text-neutral-600">{cfg.tagline}</p> : null}
        {since || data.zone ? <p className="mt-4 text-[13.5px] text-neutral-500">{[since, data.zone].filter(Boolean).join(" · ")}</p> : null}
        <div className="mt-8 space-y-3">
          <PrimaryButton className="rounded-xl" />
          <Tiles />
        </div>
      </header>
    );
  } else if (cfg.style === "nuit") {
    hero = (
      <header className="relative overflow-hidden px-5 pb-6 pt-10">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[130%] -translate-x-1/2 rounded-full opacity-60 blur-3xl" style={{ background: `radial-gradient(closest-side, ${a.main}, transparent)` }} />
        <div className="relative flex flex-col items-center text-center">
          <Logo size={76} className="shadow-[0_10px_40px_-10px_rgb(0_0_0/0.8)]" />
          <h1 className="mt-5 text-[30px] font-bold leading-[1.08] tracking-[-0.02em]" style={{ fontFamily: headingFont }}>{data.name || "Votre entreprise"}</h1>
          <p className="mt-1.5 text-[14.5px]" style={{ color: a.light }}>{cfg.tagline || data.trade}</p>
          <div className="mt-3"><StatusPill /></div>
        </div>
        <div className="relative mt-7 space-y-3">
          <PrimaryButton />
          <Tiles />
        </div>
      </header>
    );
  } else if (cfg.style === "chaleureux") {
    hero = (
      <header className="relative overflow-hidden px-4 pb-4 pt-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-70" style={{ background: a.soft }} />
        <div className="pointer-events-none absolute -left-10 top-40 h-32 w-32 rounded-full opacity-60" style={{ background: a.soft }} />
        <div className="relative rounded-[30px] bg-white p-6 ring-1 ring-stone-200/70">
          <div className="flex items-center gap-4">
            <Logo size={68} className="rounded-[22px]" />
            <div className="min-w-0">
              <h1 className="text-[23px] font-semibold leading-tight" style={{ fontFamily: headingFont }}>{data.name || "Votre entreprise"}</h1>
              <p className="mt-0.5 text-[14px] text-stone-500">{data.trade}</p>
            </div>
          </div>
          {cfg.tagline ? <p className="mt-4 text-[15.5px] leading-relaxed text-stone-700">« {cfg.tagline} »</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-2"><StatusPill />{since ? <span className={clsx("px-2.5 py-1 text-[12px]", t.chip)}>{since}</span> : null}</div>
          <div className="mt-5 space-y-3">
            <PrimaryButton className="rounded-[20px]" />
            <Tiles />
          </div>
        </div>
      </header>
    );
  } else {
    hero = (
      <header className="relative px-4 pb-2 pt-5">
        <div className="absolute inset-x-0 top-0 h-48" style={{ background: `linear-gradient(155deg, ${a.main}, ${a.main}E0 55%, ${a.main}B8)` }} />
        <div className="relative rounded-[22px] bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_22px_48px_-22px_rgb(15_23_42/0.45)]">
          <div className="flex items-center gap-4">
            <Logo size={64} />
            <div className="min-w-0">
              <h1 className="text-[21px] font-semibold leading-tight tracking-[-0.015em]" style={{ fontFamily: headingFont }}>{data.name || "Votre entreprise"}</h1>
              <p className="mt-0.5 text-[14px] text-slate-500">{cfg.tagline || data.trade}</p>
              <div className="mt-1.5"><StatusPill /></div>
            </div>
          </div>
          <div className="mt-5 space-y-2.5">
            <PrimaryButton />
            <Tiles />
          </div>
        </div>
      </header>
    );
  }

  // ------------------------------------------------------------------ Sections

  let n = 0;
  const Section = ({ id, title, icon: Icon, children, flush = false }: { id: string; title: string; icon: typeof Phone; children: React.ReactNode; flush?: boolean }) => {
    n++;
    if (t.editorial)
      return (
        <section id={id} className={clsx("mx-6", t.card, t.pad)}>
          <h2 className={clsx("mb-4 flex items-baseline gap-3", t.title)} style={{ fontFamily: headingFont }}>
            <span className="text-[13px] font-medium tabular-nums" style={{ color: accentText }}>{String(n).padStart(2, "0")}</span>
            {title}
          </h2>
          {children}
        </section>
      );
    return (
      <section id={id} className={clsx(t.card, flush ? "overflow-hidden" : t.pad)}>
        <h2 className={clsx("flex items-center gap-2", t.title, flush ? "px-5 pt-5" : "", cfg.style === "chaleureux" ? "mb-4" : "mb-3")} style={cfg.style === "chaleureux" ? { fontFamily: headingFont } : undefined}>
          <Icon className="h-4 w-4" style={{ color: accentText }} />
          {title}
        </h2>
        {children}
      </section>
    );
  };

  const install = data.install;
  const hasInstall = !!install && !!(install.equipment || install.brand || install.model || install.installedAt || install.nextServiceAt || install.publicNote);
  const validCerts = cfg.certifications.filter((c) => certIsValid(c.validUntil, now));

  const render: Record<SectionKey, () => React.ReactNode> = {
    install: () =>
      hasInstall && install ? (
        <Section id="installation" title="Votre installation" icon={ShieldCheck}>
          {install.equipment || install.brand || install.model ? (
            <div className="mb-3">
              <div className="text-[17px] font-semibold">{install.equipment || "Équipement"}</div>
              {install.brand || install.model ? <div className={clsx("text-[14px]", t.muted)}>{[install.brand, install.model].filter(Boolean).join(" · ")}</div> : null}
            </div>
          ) : null}
          <dl className={clsx("divide-y text-[14px]", t.dark ? "divide-white/10" : "divide-black/5")}>
            {install.installedAt ? <div className="flex justify-between py-2.5"><dt className={t.muted}>Installé le</dt><dd className="font-medium">{dateFr(install.installedAt)}</dd></div> : null}
            {install.lastServiceAt ? <div className="flex justify-between py-2.5"><dt className={t.muted}>Dernier entretien</dt><dd className="font-medium">{dateFr(install.lastServiceAt)}</dd></div> : null}
            {install.nextServiceAt ? <div className="flex justify-between py-2.5"><dt className={t.muted}>Prochain entretien</dt><dd className="font-semibold" style={{ color: accentText }}>{dateFr(install.nextServiceAt)}</dd></div> : null}
          </dl>
          {install.publicNote ? <p className={clsx("mt-3 whitespace-pre-line rounded-xl p-3 text-[14px] leading-relaxed", t.dark ? "bg-white/[0.06]" : "bg-[var(--accent-soft)]")}>{install.publicNote}</p> : null}
          {install.nextServiceAt && code ? (
            <ActionLink href={`/api/ics/${code}`} action="calendar" slug={slug} code={code} preview={preview} download className={clsx("mt-4 flex items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold ring-1", t.dark ? "ring-white/15 hover:bg-white/5" : "ring-black/10 hover:bg-black/[0.03]")}>
              <CalendarPlus className="h-4 w-4" style={{ color: accentText }} /> Ajouter le rappel d&apos;entretien à mon agenda
            </ActionLink>
          ) : null}
        </Section>
      ) : null,
    emergency: () =>
      data.emergency ? (
        <div className={clsx("flex gap-3 rounded-2xl border p-4 text-[14px] leading-relaxed", t.editorial && "mx-6", t.dark ? "border-amber-400/30 bg-amber-400/10 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-900")}>
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-amber-500" />
          <p className="whitespace-pre-line">{data.emergency}</p>
        </div>
      ) : null,
    highlights: () =>
      cfg.highlights.length ? (
        <div className={clsx("flex flex-wrap gap-2", t.editorial && "mx-6")}>
          {cfg.highlights.map((h) => (
            <span key={h} className={clsx("inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium", t.chip)}>
              <Sparkles className="h-3.5 w-3.5" style={{ color: accentText }} /> {h}
            </span>
          ))}
        </div>
      ) : null,
    about: () =>
      data.description || cfg.links.length ? (
        <Section id="entreprise" title="L'entreprise" icon={Globe}>
          {data.description ? <p className={clsx("whitespace-pre-line text-[15px] leading-relaxed", t.dark ? "text-white/85" : "text-black/75")}>{data.description}</p> : null}
          {since && cfg.style !== "epure" && cfg.style !== "chaleureux" ? <p className={clsx("mt-3 text-[13.5px] font-medium", t.muted)}>{since}{cfg.foundedYear ? ` · ${new Date().getFullYear() - cfg.foundedYear} ans d'expérience` : ""}</p> : null}
          {cfg.links.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {cfg.links.map((l, i) => (
                <ActionLink key={i} href={l.url} action="link" slug={slug} code={code} preview={preview} external className={clsx("inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium", t.chip)}>
                  {LINK_KINDS[l.kind]} <ExternalLink className="h-3 w-3 opacity-60" />
                </ActionLink>
              ))}
            </div>
          ) : null}
        </Section>
      ) : null,
    services: () =>
      data.services.length ? (
        <Section id="services" title="Services" icon={Wrench}>
          <ul className={clsx("divide-y", t.dark ? "divide-white/10" : "divide-black/5")}>
            {data.services.map((s, i) => (
              <li key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-[8px] h-1.5 w-1.5 flex-none rounded-full" style={{ background: accentText }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-medium">{s.title}</div>
                  {s.description ? <div className={clsx("text-[13.5px]", t.muted)}>{s.description}</div> : null}
                </div>
                {s.price ? <span className="flex-none text-[13.5px] font-semibold" style={{ color: accentText }}>{s.price}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null,
    gallery: () =>
      data.photos.length ? (
        <Section id="realisations" title="Réalisations" icon={Images}>
          <Gallery photos={data.photos} tileClass={cfg.style === "chaleureux" ? "rounded-2xl" : cfg.style === "epure" ? "" : "rounded-xl"} preview={preview} />
        </Section>
      ) : null,
    trust: () =>
      validCerts.length ? (
        <Section id="garanties" title="Certifications & garanties" icon={BadgeCheck}>
          <ul className="grid gap-2.5">
            {validCerts.map((c, i) => {
              const Icon = c.kind === "decennale" || c.kind === "rcpro" || c.kind === "garantie" ? ShieldCheck : Award;
              const body = (
                <>
                  <span className={clsx("grid h-10 w-10 flex-none place-items-center rounded-xl", t.dark ? "bg-white/10" : "bg-[var(--accent-soft)]")}><Icon className="h-5 w-5" style={{ color: accentText }} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold">{c.label || CERT_KINDS[c.kind]}</span>
                    <span className={clsx("block text-[12.5px]", t.muted)}>{[c.detail, c.validUntil ? `valide jusqu'au ${dateFr(c.validUntil)}` : ""].filter(Boolean).join(" · ")}</span>
                  </span>
                  {c.url ? <ExternalLink className={clsx("h-4 w-4 flex-none", t.faint)} /> : null}
                </>
              );
              return (
                <li key={i}>
                  {c.url ? (
                    <ActionLink href={c.url} action="link" slug={slug} code={code} preview={preview} external className="flex items-center gap-3">{body}</ActionLink>
                  ) : (
                    <div className="flex items-center gap-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null,
    hours: () =>
      data.hours.some((d) => d.open) || data.hoursNote ? (
        <Section id="horaires" title="Horaires" icon={Clock}>
          {status ? <p className={clsx("mb-3 text-[15px] font-semibold", status.open ? (t.dark ? "text-emerald-300" : "text-emerald-700") : t.dark ? "text-white/80" : "text-slate-700")}>{status.label}</p> : null}
          <ul className="text-[14px]">
            {data.hours.map((d, i) => (
              <li key={i} className={clsx("flex justify-between rounded-lg px-2.5 py-1.5", i === todayIdx && (t.dark ? "bg-white/[0.08] font-semibold" : "bg-[var(--accent-soft)] font-semibold"))}>
                <span>{DAYS[i]}</span>
                <span className={d.open ? "" : t.faint}>{dayLabel(d)}</span>
              </li>
            ))}
          </ul>
          {data.hoursNote ? <p className={clsx("mt-3 text-[13.5px]", t.muted)}>{data.hoursNote}</p> : null}
        </Section>
      ) : null,
    zone: () =>
      data.zone || addressLine ? (
        <Section id="zone" title="Zone d'intervention" icon={MapPin}>
          {data.zone ? <p className="text-[15.5px] font-medium">{data.zone}</p> : null}
          {addressLine ? (
            <ActionLink href={directions} action="directions" slug={slug} code={code} preview={preview} external className={clsx("mt-3 flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-[14px]", t.dark ? "bg-white/[0.06]" : "bg-black/[0.035]")}>
              <span className={t.dark ? "text-white/80" : "text-black/70"}>{addressLine}</span>
              <span className="inline-flex flex-none items-center gap-1 text-[13px] font-semibold" style={{ color: accentText }}>Itinéraire <ChevronRight className="h-4 w-4" /></span>
            </ActionLink>
          ) : null}
        </Section>
      ) : null,
    review: () =>
      cfg.googleReviewUrl ? (
        <section className={clsx("relative overflow-hidden rounded-2xl p-5 text-white", t.editorial && "mx-6")} style={{ background: `linear-gradient(135deg, ${a.main}, #0F172A)` }}>
          <div className="flex gap-1">{[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-5 w-5 fill-amber-300 text-amber-300" />)}</div>
          <p className="mt-3 text-[17px] font-semibold leading-snug" style={{ fontFamily: headingFont }}>Satisfait de notre intervention&nbsp;?</p>
          <p className="mt-1 text-[14px] text-white/75">Votre avis Google aide d&apos;autres particuliers à nous trouver. Cela prend 30 secondes.</p>
          <ActionLink href={cfg.googleReviewUrl} action="review" slug={slug} code={code} preview={preview} external className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-[14px] font-semibold text-slate-900">
            <Star className="h-4 w-4" /> Laisser un avis
          </ActionLink>
        </section>
      ) : null,
    tips: () =>
      data.tipsEnabled && data.tips.length ? (
        <Section id="conseils" title="Conseils utiles" icon={Lightbulb}>
          <div className="space-y-2.5">
            {data.tips.map((tip, i) => (
              <details key={i} className={clsx("group rounded-xl px-3.5 py-3", t.dark ? "bg-white/[0.05] open:bg-white/[0.09]" : "bg-black/[0.03] open:bg-[var(--accent-soft)]")}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14.5px] font-medium">
                  {tip.title}
                  <ChevronRight className={clsx("h-4 w-4 flex-none transition group-open:rotate-90", t.faint)} />
                </summary>
                {tip.body ? <p className={clsx("mt-2 whitespace-pre-line text-[14px] leading-relaxed", t.muted)}>{tip.body}</p> : null}
                {tip.url ? (
                  <ActionLink href={tip.url} action="link" slug={slug} code={code} preview={preview} external className="mt-2 inline-flex items-center gap-1 text-[13.5px] font-semibold" style={{ color: accentText }}>
                    Ouvrir le document <ExternalLink className="h-3.5 w-3.5" />
                  </ActionLink>
                ) : null}
              </details>
            ))}
          </div>
        </Section>
      ) : null,
    payments: () =>
      cfg.payments.length ? (
        <Section id="paiement" title="Moyens de paiement" icon={CreditCard}>
          <div className="flex flex-wrap gap-2">
            {cfg.payments.map((p) => <span key={p} className={clsx("px-3 py-1.5 text-[13px] font-medium", t.chip)}>{PAYMENT_METHODS[p]}</span>)}
          </div>
        </Section>
      ) : null,
    request: () =>
      data.showRequestForm ? (
        <Section id="demande-section" title="Votre demande" icon={CalendarCheck}>
          <RequestForm
            slug={slug}
            code={code}
            preview={preview}
            businessName={data.name}
            phone={data.phone}
            dark={t.dark}
            config={{ types: cfg.requestKinds ? cfg.requestTypes : ["intervention"], problems: cfg.requestProblems, address: cfg.requestAddress, availability: cfg.requestAvailability, files: cfg.requestPhotos, intro: cfg.requestIntro }}
          />
        </Section>
      ) : null,
  };

  const sticky = cfg.stickyBar && (available.call || available.request || available.whatsapp);
  const second = available.request && primary?.key !== "request" ? available.request : available.whatsapp && primary?.key !== "whatsapp" ? available.whatsapp : null;

  return (
    <div
      style={{ ["--accent" as string]: a.main, ["--accent-soft" as string]: t.dark ? "rgb(255 255 255 / 0.08)" : a.soft }}
      className={clsx("relative min-h-full font-sans antialiased", t.page)}
    >
      <ViewTracker slug={slug} code={code} preview={preview} />
      <div className={clsx("mx-auto max-w-[480px]", sticky ? "pb-24" : "pb-10")}>
        {hero}
        <div className={clsx("mt-3 space-y-4", !t.editorial && "px-4")}>
          {cfg.sections.filter((s) => s.visible).map((s) => {
            const node = render[s.key]();
            return node ? <div key={s.key} className="animate-fade-up">{node}</div> : null;
          })}
        </div>
        <footer className={clsx("mt-10 px-6 text-center text-[12px] leading-relaxed", t.faint)}>
          {code ? <div>Étiquette {code}</div> : null}
          <div>
            Page professionnelle fournie par {data.brandName} ·{" "}
            <a href={preview ? undefined : "/confidentialite"} className="underline-offset-2 hover:underline">Confidentialité</a>
          </div>
        </footer>
      </div>

      {sticky && primary?.href ? (
        <div className={clsx("inset-x-0 bottom-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2", preview ? "sticky" : "fixed", t.dark ? "bg-gradient-to-t from-[#0A0F1E] via-[#0A0F1E]/90 to-transparent" : "bg-gradient-to-t from-white via-white/90 to-transparent")}>
          <div className="mx-auto flex max-w-[480px] gap-2">
            <ActionLink href={primary.href} action={primary.track} slug={slug} code={code} preview={preview} external={primary.external} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white shadow-lg" style={{ background: a.main }}>
              <primary.icon className="h-[18px] w-[18px]" /> {primary.key === "call" ? "Appeler" : primary.key === "whatsapp" ? "WhatsApp" : "Demande"}
            </ActionLink>
            {second?.href ? (
              <ActionLink href={second.href} action={second.track} slug={slug} code={code} preview={preview} external={second.external} className={clsx("flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold shadow-lg ring-1", t.dark ? "bg-white/10 text-white ring-white/15 backdrop-blur" : "bg-white text-slate-900 ring-black/10")}>
                <second.icon className="h-[18px] w-[18px]" style={{ color: accentText }} /> {second.key === "request" ? "Demande" : "WhatsApp"}
              </ActionLink>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
