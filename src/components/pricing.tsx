import Link from "next/link";
import { ArrowRight, Check, Download, Package, Printer, ShieldCheck, Sparkles, Truck, Wallet, BadgeCheck, QrCode, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { euros, eurosExact } from "@/lib/format";
import { OFFER_FEATURES, OFFER_NAME, recommendedTier, savingPct, unitCents, type Tier } from "@/lib/pricing";

/**
 * Section « Tarifs » de la page d'accueil. Deux offres, simples à comparer :
 *  1. Offre QR Pro — un prix, payé une fois ; impressions illimitées.
 *  2. Étiquettes imprimées et livrées — prix dégressif, livraison comprise.
 * Tous les montants viennent de la base (Administration → Tarifs).
 */
export function PricingSection({
  digitalPriceCents, tiers, cta, loggedIn, vatMention, printEnabled,
}: {
  digitalPriceCents: number;
  tiers: Tier[];
  cta: string;
  loggedIn: boolean;
  vatMention: string;
  printEnabled: boolean;
}) {
  const reco = recommendedTier(tiers);
  const minTier = tiers.length ? Math.min(...tiers.map((t) => t.priceCents)) : 0;
  const orderHref = (q?: number) => (loggedIn ? `/espace/commander${q ? `?quantite=${q}` : ""}` : cta);
  const showPrint = printEnabled && tiers.length > 0;

  return (
    <section id="tarifs" className="relative overflow-hidden py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(50%_60%_at_50%_0%,rgb(var(--brand)/0.08),transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow">Tarifs</div>
          <h2 className="mt-3 text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[42px]">Un prix simple, payé une fois</h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-muted">
            Votre QR code et votre page pour {euros(digitalPriceCents)}, sans abonnement. Imprimez vous-même gratuitement, ou recevez vos étiquettes prêtes à coller.
          </p>
        </div>

        <div className={clsx("mt-14 grid gap-6", showPrint && "lg:grid-cols-[0.9fr_1.1fr]")}>
          {/* ─── Offre QR Pro ─── */}
          <div className="relative flex flex-col overflow-hidden rounded-[28px] border-2 border-brand bg-surface p-7 shadow-ring sm:p-9">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-semibold text-brand">
              <QrCode className="h-3.5 w-3.5" /> {OFFER_NAME} · numérique
            </span>
            <div className="mt-5 flex items-end gap-3">
              <span className="text-[56px] font-semibold leading-none tracking-[-0.04em]">{euros(digitalPriceCents)}</span>
              <span className="pb-1.5 text-[14px] leading-tight text-muted">une seule fois<br />sans abonnement</span>
            </div>
            <p className="mt-4 text-[14.5px] leading-relaxed text-muted">Tout pour équiper vos installations vous-même, sur papier autocollant ou chez l&apos;imprimeur de votre choix.</p>
            <ul className="mt-6 space-y-3 text-[14.5px]">
              {OFFER_FEATURES.map((f) => (
                <li key={f} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 flex-none text-success" />{f}</li>
              ))}
            </ul>
            <div className="mt-6 flex items-start gap-3 rounded-2xl bg-canvas p-4 text-[13.5px] leading-snug">
              <RefreshCw className="mt-0.5 h-4 w-4 flex-none text-brand" />
              <span><b className="font-semibold">Réimpression gratuite, à vie.</b> Votre QR code ne change jamais : vous modifiez votre page, pas vos étiquettes.</span>
            </div>
            <div className="flex-1" />
            <Link href={loggedIn ? "/espace/commander" : cta} className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-semibold text-white shadow-[0_6px_16px_-6px_rgb(var(--brand))] transition hover:bg-brand-strong">
              {loggedIn ? "Activer mon offre" : "Essayer gratuitement"} <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-2.5 text-center text-[12.5px] text-faint">Créez et prévisualisez gratuitement. Vous payez pour mettre en ligne.</p>
          </div>

          {/* ─── Étiquettes imprimées ─── */}
          {showPrint ? (
            <div id="offre-impression" className="relative flex flex-col overflow-hidden rounded-[28px] bg-ink p-7 text-white shadow-lift sm:p-9">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,rgb(var(--brand)/0.45),transparent_60%)]" />
              <div className="relative flex flex-1 flex-col">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-semibold">
                  <Truck className="h-3.5 w-3.5" /> Étiquettes imprimées et livrées
                </span>
                <h3 className="mt-5 text-[26px] font-semibold leading-tight tracking-[-0.02em]">Nous imprimons, vous collez</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-white/65">
                  Vinyle autocollant résistant, découpé et contrôlé, envoyé en suivi. <b className="font-semibold text-white">Prix tout compris, livraison incluse.</b> Plus vous en commandez, moins chaque étiquette coûte.
                </p>
                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                  <table className="w-full text-left text-[14px]">
                    <thead>
                      <tr className="text-[12px] uppercase tracking-[0.06em] text-white/45">
                        <th className="px-4 py-2.5 font-medium">Quantité</th>
                        <th className="px-4 py-2.5 text-right font-medium">Prix livré</th>
                        <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Par étiquette</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((t) => {
                        const hot = t.id === reco?.id;
                        const save = savingPct(t, tiers);
                        return (
                          <tr key={t.id} className={clsx("border-t border-white/10", hot && "bg-white/[0.07]")}>
                            <td className="px-4 py-3">
                              <span className="font-semibold">{t.quantity} étiquettes</span>
                              {hot ? <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold"><Sparkles className="h-3 w-3" /> Conseillé</span> : null}
                            </td>
                            <td className="px-4 py-3 text-right text-[17px] font-semibold tabular-nums">{euros(t.priceCents)}</td>
                            <td className="hidden px-4 py-3 text-right tabular-nums text-white/65 sm:table-cell">
                              {eurosExact(unitCents(t))}{save ? <span className="ml-1.5 text-[12px] font-semibold text-emerald-300">−{save} %</span> : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ol className="mt-6 grid gap-3 text-[13.5px] text-white/80 sm:grid-cols-2">
                  {[
                    { icon: BadgeCheck, text: "Vous validez l'aperçu, nous contrôlons le fichier" },
                    { icon: Printer, text: "Impression à la commande, découpe nette" },
                    { icon: Package, text: "Envoi suivi, numéro transmis par email" },
                    { icon: QrCode, text: `${OFFER_NAME} ajoutée une seule fois (${euros(digitalPriceCents)}) si vous ne l'avez pas encore` },
                  ].map(({ icon: Icon, text }) => (
                    <li key={text} className="flex gap-2.5"><Icon className="mt-0.5 h-4 w-4 flex-none text-white/45" />{text}</li>
                  ))}
                </ol>
                <div className="flex-1" />
                <Link href={orderHref(reco?.quantity)} className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-semibold text-ink transition hover:bg-white/90">
                  Commander dès {euros(minTier)} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        {/* Exemple de calcul : rien de caché */}
        {showPrint && reco ? (
          <p className="mx-auto mt-6 max-w-3xl text-center text-[13.5px] text-muted">
            Exemple, première commande : {OFFER_NAME} {euros(digitalPriceCents)} + {reco.quantity} étiquettes livrées {euros(reco.priceCents)} ={" "}
            <b className="font-semibold text-ink">{euros(digitalPriceCents + reco.priceCents)} au total</b>. Les commandes suivantes : {euros(reco.priceCents)} seulement.
          </p>
        ) : null}

        <div className="mt-10 grid gap-3 text-[13.5px] sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Wallet, title: "Paiement unique", text: "Aucun abonnement" },
            { icon: Truck, title: "Livraison incluse", text: "Aucun frais ajouté" },
            { icon: ShieldCheck, title: "Paiement sécurisé", text: "Carte bancaire via Stripe" },
            { icon: Download, title: "Facture", text: "Téléchargeable à chaque commande" },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              <Icon className="h-4 w-4 flex-none text-brand" />
              <span><b className="font-semibold">{title}</b> <span className="text-muted">· {text}</span></span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-[12.5px] text-faint">{vatMention}. Livraison en France métropolitaine.</p>
      </div>
    </section>
  );
}
