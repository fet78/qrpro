import Link from "next/link";
import {
  ArrowRight, Check, Phone, CalendarCheck, Pencil, Smartphone, ShieldCheck, Printer, ScanLine, Sticker, Wrench, BadgeCheck,
} from "lucide-react";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { getCurrentUser } from "@/server/auth/session";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { LabelSvg } from "@/components/label-preview";
import { renderLabelSvg, SAMPLE_DATA } from "@/server/label-render";
import { TEMPLATES, buildTemplate } from "@/lib/labels/library";
import type { FormatKey } from "@/lib/labels/formats";
import { PublicPageView } from "@/components/public-page/view";
import { buttonClass } from "@/components/ui";
import { PricingSection } from "@/components/pricing";
import { DEFAULT_HOURS } from "@/lib/hours";
import { euros } from "@/lib/format";
import type { PublicPageData } from "@/components/public-page/types";
import { DEFAULT_PAGE } from "@/lib/page/config";

export const dynamic = "force-dynamic";

/** Données d'illustration (entreprise fictive, clairement présentée comme un exemple). */
const SAMPLE_PAGE: Omit<PublicPageData, "brandName"> = {
  slug: "exemple",
  name: "Exemple Chauffage",
  trade: "Chauffagiste · Pompes à chaleur",
  phone: "0612345678",
  email: "contact@exemple.fr",
  address: "",
  postalCode: "",
  city: "",
  zone: "Votre ville et 30 km autour",
  description: "",
  website: "",
  emergency: "",
  hours: DEFAULT_HOURS,
  hoursNote: "",
  accent: "bleu",
  logoUrl: null,
  services: [],
  tips: [],
  tipsEnabled: false,
  showRequestForm: false,
  page: { ...DEFAULT_PAGE, actions: ["call", "request", "directions", "save"], stickyBar: false, highlights: ["Devis gratuit", "Intervention sous 48 h"] },
  photos: [],
  pageUrl: "https://exemple.fr/p/exemple",
  code: null,
  install: {
    label: "",
    equipment: "Pompe à chaleur air/eau",
    brand: "Marque · Modèle 8 kW",
    model: "",
    installedAt: "2025-10-14T12:00:00.000Z",
    lastServiceAt: "2026-10-02T12:00:00.000Z",
    nextServiceAt: "2027-10-01T12:00:00.000Z",
    publicNote: "",
  },
};

/** Modèles mis en avant sur la page d'accueil : compositions et formats volontairement variés. */
const SHOWCASE: [string, FormatKey][] = [["braise", "F60X40"], ["flux", "F50X50"], ["sceau", "F70X50"], ["plan", "F60X40"], ["eauvive", "F50X50"], ["securite", "F60X40"], ["arche", "F70X50"], ["entretien", "F60X40"]];

const FAQ = [
  {
    q: "Que se passe-t-il si je change de numéro de téléphone ?",
    a: "Vous modifiez votre page depuis votre espace, et c'est tout. Le QR code ne contient qu'une adresse web permanente, jamais vos coordonnées : les étiquettes déjà collées affichent immédiatement les nouvelles informations.",
  },
  {
    q: "Mes clients doivent-ils installer une application ?",
    a: "Non. L'appareil photo de n'importe quel smartphone récent lit le QR code et ouvre votre page dans le navigateur. Aucun compte, aucune application.",
  },
  {
    q: "Combien ça coûte, au total ?",
    a: "L'offre QR Pro se paie une seule fois : votre page, votre QR code permanent et vos fichiers d'impression, sans abonnement. Vous imprimez ensuite autant d'étiquettes que vous voulez, gratuitement. Si vous préférez les recevoir prêtes à coller, choisissez une quantité : le prix affiché comprend l'impression et la livraison.",
  },
  {
    q: "Dois-je repayer pour réimprimer mes étiquettes ?",
    a: "Non. Votre QR code ne change jamais : téléchargez à nouveau vos planches quand vous voulez, sans rien payer. Seules les étiquettes que nous imprimons et livrons sont facturées, au prix de la quantité choisie.",
  },
  {
    q: "Sur quel papier imprimer mes étiquettes ?",
    a: "Une feuille A4 autocollante suffit. Pour une chaufferie ou un local humide, préférez une étiquette vinyle ou polyester, plus résistante à la chaleur et à l'humidité. Imprimez en « taille réelle » (100 %).",
  },
  {
    q: "Puis-je essayer avant de payer ?",
    a: "Oui. Créez votre compte gratuitement, sans carte bancaire : complétez votre page, composez votre étiquette et voyez le rendu final. Vous payez seulement pour mettre votre page en ligne et télécharger vos fichiers.",
  },
  {
    q: "Le QR code restera-t-il lisible avec mon logo et mes couleurs ?",
    a: "Oui. Le QR code reste toujours noir sur blanc, avec sa marge de sécurité et une taille minimale garantie. Les couleurs et le logo habillent l'étiquette autour, jamais le code. Chaque fichier est relu automatiquement avant téléchargement.",
  },
  {
    q: "Mes étiquettes fonctionneront-elles dans plusieurs années ?",
    a: "Oui. L'adresse de votre QR code est définitive et l'offre est payée une fois pour toutes : tant que votre compte existe, vos clients retrouvent vos coordonnées à jour en scannant l'étiquette.",
  },
];

export default async function Home() {
  const [s, user, tiers, templates] = await Promise.all([
    getSettings(),
    getCurrentUser(),
    db.printTier.findMany({ where: { active: true }, orderBy: { quantity: "asc" } }),
    db.template.findMany({ select: { key: true, active: true } }),
  ]);
  const cta = user ? "/espace" : "/inscription";
  const active = new Set(templates.filter((t) => t.active).map((t) => t.key));
  const isActive = (key: string) => !templates.some((t) => t.key === key) || active.has(key);
  const heroSvg = await renderLabelSvg(buildTemplate("braise", "F50X50"), SAMPLE_DATA);
  const showcase = {
    total: TEMPLATES.filter((t) => isActive(t.key)).length,
    items: await Promise.all(
      SHOWCASE.filter(([key]) => isActive(key)).map(async ([key, format]) => {
        const t = TEMPLATES.find((x) => x.key === key)!;
        return { key, name: t.name, category: t.category, svg: await renderLabelSvg(buildTemplate(key, format), SAMPLE_DATA) };
      }),
    ),
  };

  return (
    <div className="bg-canvas">
      <SiteHeader brandName={s.brandName} loggedIn={!!user} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_0%,rgb(var(--brand)/0.12),transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(var(--line)/0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--line)/0.6)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px] font-medium text-muted shadow-card">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Chauffagistes · Plombiers · Frigoristes · Installateurs PAC
            </span>
            <h1 className="mt-5 text-[38px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[54px]">{s.tagline}</h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
              Collez une étiquette sur chaque chaudière, pompe à chaleur ou ballon que vous installez. Votre client la scanne avec son téléphone et retrouve votre numéro, vos services et sa date d&apos;entretien — même cinq ans plus tard.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href={cta} className={buttonClass("primary", "lg")}>
                {user ? "Accéder à mon espace" : "Créer mon compte"} <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#tarifs" className={buttonClass("secondary", "lg")}>Voir les tarifs</a>
            </div>
            {!user ? (
              <p className="mt-4 flex items-center gap-2 text-[13.5px] text-muted"><Check className="h-4 w-4 text-success" /> Essai gratuit sans carte bancaire · puis {euros(s.digitalPriceCents)} une seule fois, sans abonnement.</p>
            ) : null}
          </div>

          {/* Démonstration : étiquette → page */}
          <div className="relative mx-auto flex w-full max-w-[520px] items-center justify-center lg:justify-end">
            <div className="absolute -left-2 top-10 z-10 w-[46%] rotate-[-6deg] sm:left-0">
              <LabelSvg svg={heroSvg} />
              <div className="mt-3 flex items-center justify-center gap-1.5 text-[12px] font-medium text-muted"><ScanLine className="h-3.5 w-3.5" /> Étiquette 50 × 50 mm</div>
            </div>
            <div className="ml-[38%] w-[62%] max-w-[300px] rounded-[34px] border border-line bg-ink p-2 shadow-lift">
              <div className="pointer-events-none h-[520px] overflow-hidden rounded-[27px] bg-white">
                <div className="origin-top-left scale-[0.78] [width:128.2%]">
                  <PublicPageView preview data={{ ...SAMPLE_PAGE, brandName: s.brandName }} now={new Date("2026-11-05T10:00:00+01:00")} />
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="relative pb-6 text-center text-[12px] text-faint">Exemple d&apos;étiquette et de page, avec une entreprise fictive.</p>
      </section>

      {/* Fonctionnement */}
      <section id="fonctionnement" className="border-y border-line bg-surface py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="eyebrow">Comment ça marche</div>
          <h2 className="mt-2 max-w-2xl text-[32px] font-semibold leading-tight tracking-[-0.025em]">Trois étapes, aucune compétence technique.</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              { icon: Pencil, title: "Créez votre page", text: "Nom, téléphone, services, horaires, zone d'intervention. Vous voyez le résultat sur un téléphone pendant que vous tapez." },
              { icon: Sticker, title: "Choisissez votre étiquette", text: "Quatre modèles professionnels, vos couleurs, votre logo, trois formats. Imprimez la planche A4 ou recevez vos étiquettes par la poste." },
              { icon: Smartphone, title: "Votre client scanne", text: "Il vous appelle, vous envoie une demande d'intervention ou enregistre votre contact. Sans application, sans compte." },
            ].map(({ icon: Icon, title, text }, i) => (
              <div key={title}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="h-5 w-5" /></span>
                  <span className="text-[13px] font-semibold text-faint">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-[18px] font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Avantages */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="eyebrow">Pour les pros du chauffage</div>
          <h2 className="mt-2 max-w-2xl text-[32px] font-semibold leading-tight tracking-[-0.025em]">Le client qui a une panne vous rappelle vous, pas un autre.</h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Phone, title: "Appel en un geste", text: "Le bouton « Appeler » est le premier élément de la page. Plus besoin de chercher la facture ou l'autocollant décollé." },
              { icon: CalendarCheck, title: "Entretien annuel", text: "Affichez la date du dernier entretien et du prochain : le client sait quand vous rappeler." },
              { icon: Wrench, title: "Demandes d'intervention", text: "Un formulaire simple : vous recevez la demande par email avec l'étiquette concernée." },
              { icon: Pencil, title: "Toujours à jour", text: "Nouveau numéro, nouveau logo, nouveaux horaires : modifiez votre page, les étiquettes posées suivent." },
              { icon: ShieldCheck, title: "QR toujours lisible", text: "Noir sur blanc, marge de sécurité, taille minimale garantie. Chaque fichier est relu avant téléchargement." },
              { icon: BadgeCheck, title: "Image professionnelle", text: "Une étiquette soignée sur l'équipement, une page claire sur le téléphone du client." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="bg-surface p-6">
                <Icon className="h-5 w-5 text-brand" />
                <h3 className="mt-4 text-[16px] font-semibold tracking-tight">{title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modèles */}
      <section id="modeles" className="border-y border-line bg-surface py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="eyebrow">Éditeur d&apos;étiquettes</div>
              <h2 className="mt-2 max-w-2xl text-[32px] font-semibold leading-tight tracking-[-0.025em]">{showcase.total} modèles pour démarrer. Ou votre propre design.</h2>
              <p className="mt-3 max-w-2xl text-[16px] text-muted">Partez d&apos;un modèle ou d&apos;une page blanche, puis déplacez, redimensionnez et recolorez chaque élément. Le QR code reste toujours lisible : il est vérifié à chaque modification.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[13px]">
              {["7 typographies", "46 icônes métier", "12 harmonies de couleurs", "3 formats"].map((f) => (
                <span key={f} className="rounded-full border border-line bg-canvas px-3 py-1.5 font-medium text-muted">{f}</span>
              ))}
            </div>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-5 lg:grid-cols-4">
            {showcase.items.map((t) => (
              <div key={t.key} className="group">
                <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-canvas p-5 transition group-hover:bg-brand-soft/50">
                  <LabelSvg svg={t.svg} className="w-full transition duration-300 group-hover:-translate-y-1" />
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold">{t.name}</span>
                  <span className="text-[12px] text-faint">{t.category}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PricingSection
        digitalPriceCents={s.digitalPriceCents}
        tiers={tiers.map((t) => ({ id: t.id, quantity: t.quantity, priceCents: t.priceCents }))}
        cta={cta}
        loggedIn={!!user}
        vatMention={s.vatMention}
        printEnabled={s.printEnabled}
      />

      {/* FAQ */}
      <section id="faq" className="border-t border-line bg-surface py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <div className="eyebrow">Questions fréquentes</div>
            <h2 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.025em]">Tout ce qu&apos;il faut savoir avant de commencer.</h2>
            {s.contactEmail ? <p className="mt-4 text-[15px] text-muted">Une autre question ? <a className="link" href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a></p> : null}
          </div>
          <div className="divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium">
                  {f.q}
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-full border border-line text-muted transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Appel final */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-14 text-center text-white sm:px-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgb(var(--brand)/0.45),transparent_70%)]" />
            <div className="relative">
              <Printer className="mx-auto h-8 w-8 text-white/70" />
              <h2 className="mx-auto mt-4 max-w-2xl text-[30px] font-semibold leading-tight tracking-[-0.025em] sm:text-[36px]">Vos premières étiquettes peuvent être collées cette semaine.</h2>
              <p className="mx-auto mt-3 max-w-xl text-[16px] text-white/70">Créez votre page, imprimez votre planche, posez-la sur votre prochaine installation.</p>
              <Link href={cta} className={buttonClass("secondary", "lg", "mt-8 border-transparent")}>{user ? "Accéder à mon espace" : "Créer mon compte"} <ArrowRight className="h-4 w-4" /></Link>
              {s.contactEmail || s.contactPhone ? (
                <p className="mt-6 text-[13.5px] text-white/60">Contact : {[s.contactEmail, s.contactPhone].filter(Boolean).join(" · ")}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter brandName={s.brandName} contactEmail={s.contactEmail} />
    </div>
  );
}
