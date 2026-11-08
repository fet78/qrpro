"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, Check, CheckCircle2, Lock, Package, Printer, ShieldCheck, Sparkles, Truck, Download, QrCode, FileText } from "lucide-react";
import { clsx } from "clsx";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { Card, buttonClass } from "@/components/ui";
import { LabelSvg } from "@/components/label-preview";
import { euros, eurosExact } from "@/lib/format";
import { OFFER_FEATURES, OFFER_NAME, quote, recommendedTier, savingPct, unitCents, type Tier } from "@/lib/pricing";
import { placeOrder } from "./actions";

type Bill = { billName: string; billLine1: string; billLine2: string; billPostal: string; billCity: string; billSiret: string };
type Ship = { shipName: string; shipLine1: string; shipLine2: string; shipPostal: string; shipCity: string; shipPhone: string };

function Field({ id, label, defaultValue, hint, className, ...rest }: { id: string; label: string; defaultValue: string; hint?: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      <input className="input" id={id} name={id} defaultValue={defaultValue} {...rest} />
      {hint ? <p className="hint">{hint}</p> : null}
      <FieldError name={id} />
    </div>
  );
}

function Step({ n, title, children, aside }: { n: number; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[16px] font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[13px] font-semibold text-white">{n}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Checkout({
  canPay, activated, activatedOn, digitalPriceCents, tiers, printPaused, preselectTierId, validated, previewSvg, formatLabel, bill, ship,
}: {
  canPay: boolean;
  activated: boolean;
  activatedOn: string | null;
  digitalPriceCents: number;
  tiers: Tier[];
  printPaused: boolean;
  preselectTierId: string | null;
  validated: boolean;
  previewSvg: string;
  formatLabel: string;
  bill: Bill;
  ship: Ship;
}) {
  const reco = recommendedTier(tiers);
  // Compte actif : il ne reste que l'impression à commander (le palier conseillé est présélectionné).
  const [tierId, setTierId] = useState<string>(preselectTierId ?? (activated ? (reco?.id ?? "") : ""));
  const [shipSame, setShipSame] = useState(!ship.shipLine1 || (ship.shipLine1 === bill.billLine1 && ship.shipPostal === bill.billPostal));
  const tier = tiers.find((t) => t.id === tierId) ?? null;
  const { lines, totalCents } = quote({ activated, digitalPriceCents, tier, formatLabel });
  const nothingToBuy = lines.length === 0;
  const blockedByDesign = !!tier && !validated;

  return (
    <ActionForm action={placeOrder} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_370px]">
      <input type="hidden" name="tierId" value={tierId} />
      <div className="space-y-9">
        {/* 1. L'offre */}
        <Step n={1} title={OFFER_NAME}>
          {activated ? (
            <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 flex-none text-success" />
                <div>
                  <div className="text-[15px] font-semibold">Votre offre est active{activatedOn ? ` depuis le ${activatedOn}` : ""}</div>
                  <p className="text-[13.5px] text-muted">Rien à repayer : votre page est en ligne et vos fichiers d&apos;impression sont illimités.</p>
                </div>
              </div>
              <Link href="/espace/codes" className={buttonClass("secondary", "sm")}><Download className="h-3.5 w-3.5" /> Mes fichiers</Link>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border-2 border-brand bg-surface shadow-ring">
              <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:p-6">
                <div>
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-brand"><QrCode className="h-4 w-4" /> Numérique · inclus dans votre commande</div>
                  <ul className="mt-3 space-y-1.5 text-[14px]">
                    {OFFER_FEATURES.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 flex-none text-success" />{f}</li>)}
                  </ul>
                </div>
                <div className="sm:text-right">
                  <div className="text-[36px] font-semibold leading-none tracking-[-0.03em]">{euros(digitalPriceCents)}</div>
                  <div className="mt-1.5 text-[13px] font-medium text-muted">une seule fois</div>
                  <div className="text-[12.5px] text-faint">sans abonnement</div>
                </div>
              </div>
            </div>
          )}
        </Step>

        {/* 2. Impression */}
        <Step n={2} title="Étiquettes imprimées et livrées" aside={<span className="text-[12.5px] text-muted">{activated ? "À commander quand vous voulez" : "Facultatif"}</span>}>
          {printPaused || tiers.length === 0 ? (
            <Card className="p-5 text-[14px] text-muted">L&apos;impression par nos soins est momentanément suspendue. Vous pouvez imprimer vos étiquettes vous-même avec l&apos;offre QR Pro.</Card>
          ) : (
            <>
              <p className="mb-3 text-[13.5px] leading-relaxed text-muted">
                Nous imprimons votre étiquette sur vinyle autocollant, la découpons, la contrôlons et vous l&apos;envoyons. <b className="font-semibold text-ink">Prix tout compris, livraison suivie incluse.</b>
              </p>
              <div role="radiogroup" aria-label="Quantité d'étiquettes imprimées" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {!activated ? (
                  <button type="button" role="radio" aria-checked={tierId === ""} onClick={() => setTierId("")} className={clsx("flex flex-col rounded-2xl border p-4 text-left transition", tierId === "" ? "border-brand bg-brand-soft/50 shadow-ring" : "border-line bg-surface hover:border-faint")}>
                    <span className="flex items-center justify-between"><span className="text-[14.5px] font-semibold">Je les imprime moi-même</span><Radio on={tierId === ""} /></span>
                    <span className="mt-1 text-[13px] text-muted">Planches A4 à télécharger, sans limite</span>
                    <span className="mt-auto pt-3 text-[20px] font-semibold">0 €</span>
                  </button>
                ) : null}
                {tiers.map((t) => {
                  const on = t.id === tierId;
                  const save = savingPct(t, tiers);
                  return (
                    <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => setTierId(t.id)} data-quantity={t.quantity} className={clsx("relative flex flex-col rounded-2xl border p-4 text-left transition", on ? "border-brand bg-brand-soft/50 shadow-ring" : "border-line bg-surface hover:border-faint")}>
                      {t.id === reco?.id ? <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white"><Sparkles className="h-3 w-3" /> Conseillé</span> : null}
                      <span className="flex items-center justify-between"><span className="text-[14.5px] font-semibold">{t.quantity} étiquettes</span><Radio on={on} /></span>
                      <span className="mt-1 text-[13px] text-muted">{eurosExact(unitCents(t))} l&apos;étiquette{save ? <b className="ml-1 font-semibold text-success">−{save} %</b> : null}</span>
                      <span className="mt-auto flex items-baseline gap-1.5 pt-3"><span className="text-[22px] font-semibold tracking-tight">{euros(t.priceCents)}</span><span className="text-[12px] text-muted">livraison incluse</span></span>
                    </button>
                  );
                })}
              </div>
              <FieldError name="tierId" />
              {blockedByDesign ? (
                <Card className="mt-4 flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 h-5 w-5 flex-none text-warn" />
                    <div>
                      <div className="text-[14px] font-semibold">Validez d&apos;abord votre étiquette</div>
                      <p className="text-[13px] text-muted">Nous imprimons exactement le design que vous avez validé.</p>
                    </div>
                  </div>
                  <Link href="/espace/etiquette" className={buttonClass("primary", "sm")}>Configurer mon étiquette</Link>
                </Card>
              ) : null}
            </>
          )}
        </Step>

        {/* 3. Coordonnées */}
        <Step n={3} title="Vos coordonnées">
          <Card className="p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted"><FileText className="h-4 w-4" /> Facturation</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="billName" label="Nom ou raison sociale" defaultValue={bill.billName} autoComplete="organization" className="sm:col-span-2" />
              <Field id="billLine1" label="Adresse" defaultValue={bill.billLine1} autoComplete="address-line1" className="sm:col-span-2" />
              <Field id="billLine2" label="Complément (facultatif)" defaultValue={bill.billLine2} autoComplete="address-line2" className="sm:col-span-2" />
              <Field id="billPostal" label="Code postal" defaultValue={bill.billPostal} inputMode="numeric" maxLength={5} autoComplete="postal-code" />
              <Field id="billCity" label="Ville" defaultValue={bill.billCity} autoComplete="address-level2" />
              <Field id="billSiret" label="SIRET (facultatif)" defaultValue={bill.billSiret} inputMode="numeric" hint="Affiché sur votre facture." className="sm:col-span-2" />
            </div>
            {tier ? (
              <div className="mt-6 border-t border-line pt-5">
                <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted"><Truck className="h-4 w-4" /> Livraison</div>
                <label className="mb-4 flex items-center gap-2.5 text-[14px]">
                  <input type="checkbox" name="shipSame" checked={shipSame} onChange={(e) => setShipSame(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
                  Livrer à l&apos;adresse de facturation
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  {!shipSame ? (
                    <>
                      <Field id="shipName" label="Destinataire" defaultValue={ship.shipName} autoComplete="name" className="sm:col-span-2" />
                      <Field id="shipLine1" label="Adresse" defaultValue={ship.shipLine1} className="sm:col-span-2" />
                      <Field id="shipLine2" label="Complément (facultatif)" defaultValue={ship.shipLine2} className="sm:col-span-2" />
                      <Field id="shipPostal" label="Code postal" defaultValue={ship.shipPostal} inputMode="numeric" maxLength={5} />
                      <Field id="shipCity" label="Ville" defaultValue={ship.shipCity} />
                    </>
                  ) : null}
                  <Field id="shipPhone" label="Téléphone (pour le transporteur)" defaultValue={ship.shipPhone} type="tel" autoComplete="tel" className="sm:col-span-2" />
                </div>
              </div>
            ) : null}
          </Card>
        </Step>
      </div>

      {/* Récapitulatif */}
      <aside>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card lg:sticky lg:top-8">
          <div className="bg-[repeating-linear-gradient(45deg,#F3F4F6_0_10px,#F8F9FB_10px_20px)] p-5">
            <LabelSvg svg={previewSvg} className="mx-auto max-w-[190px]" />
            <p className="mt-2 text-center text-[12px] text-muted">Votre étiquette · {formatLabel}{validated ? "" : " · non validée"}</p>
          </div>
          <div className="p-5">
            <div className="text-[13px] font-medium uppercase tracking-[0.06em] text-muted">Récapitulatif</div>
            {nothingToBuy ? (
              <p className="mt-3 text-[14px] text-muted">Choisissez une quantité d&apos;étiquettes imprimées.</p>
            ) : (
              <dl className="mt-3 space-y-3 text-[14px]">
                {lines.map((l) => (
                  <div key={l.label} className="flex justify-between gap-3">
                    <dt><span className="block font-medium">{l.label}</span>{l.detail ? <span className="block text-[12px] leading-snug text-muted">{l.detail}</span> : null}</dt>
                    <dd className="tabular-nums">{eurosExact(l.totalCents)}</dd>
                  </div>
                ))}
                {tier ? <div className="flex justify-between gap-3 text-[13.5px]"><dt className="text-muted">Livraison suivie</dt><dd className="font-medium text-success">Incluse</dd></div> : null}
                <div className="flex items-baseline justify-between border-t border-line pt-3"><dt className="font-semibold">Total à payer</dt><dd className="text-[26px] font-semibold tracking-tight tabular-nums" data-testid="order-total">{eurosExact(totalCents)}</dd></div>
              </dl>
            )}
            <SubmitButton className="mt-4 h-12 w-full rounded-xl" size="lg" disabled={!canPay || nothingToBuy || blockedByDesign} pendingLabel="Redirection vers le paiement…">
              {nothingToBuy ? "Rien à payer" : `Payer ${eurosExact(totalCents)}`}
            </SubmitButton>
            <ul className="mt-4 space-y-1.5 text-[12.5px] text-muted">
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-none text-success" /> Aucun frais ajouté au paiement</li>
              <li className="flex gap-2"><BadgeCheck className="mt-0.5 h-3.5 w-3.5 flex-none text-success" /> Facture disponible dans « Mes commandes »</li>
              {tier ? (
                <>
                  <li className="flex gap-2"><Printer className="mt-0.5 h-3.5 w-3.5 flex-none text-success" /> Contrôle de votre fichier avant impression</li>
                  <li className="flex gap-2"><Package className="mt-0.5 h-3.5 w-3.5 flex-none text-success" /> Numéro de suivi envoyé par email à l&apos;expédition</li>
                </>
              ) : (
                <li className="flex gap-2"><Download className="mt-0.5 h-3.5 w-3.5 flex-none text-success" /> Fichiers disponibles dès le paiement</li>
              )}
            </ul>
          </div>
        </div>
      </aside>
    </ActionForm>
  );
}

function Radio({ on }: { on: boolean }) {
  return <span className={clsx("grid h-5 w-5 flex-none place-items-center rounded-full border", on ? "border-brand bg-brand text-white" : "border-line")}>{on ? <Check className="h-3 w-3" /> : null}</span>;
}
