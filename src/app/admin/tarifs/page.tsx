import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { PageHeader, Card, CardHeader, Notice } from "@/components/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { eurosExact } from "@/lib/format";
import { unitCents, savingPct } from "@/lib/pricing";
import { saveOffer, saveTier } from "../actions";

export const metadata = { title: "Tarifs" };

const cents = (c: number) => (c / 100).toFixed(2).replace(".", ",");

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-[13.5px]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-[rgb(var(--brand))]" /> {label}
    </label>
  );
}

export default async function AdminPricing() {
  await requireAdmin();
  const [tiers, s] = await Promise.all([db.printTier.findMany({ orderBy: { quantity: "asc" } }), getSettings()]);
  const active = tiers.filter((t) => t.active);
  const emptyTier = { id: "", quantity: 0, priceCents: 0, active: true };
  return (
    <>
      <PageHeader title="Tarifs" description="Prix TTC en euros. Ils s'appliquent immédiatement aux nouvelles commandes ; une commande passée garde toujours son prix." />
      <Notice className="mb-6">
        Deux offres seulement : l&apos;<b>offre QR Pro</b> (paiement unique) et les <b>étiquettes imprimées</b>, livraison comprise. Aucun frais n&apos;est ajouté au moment de payer. Mention affichée : « {s.vatMention} ».
      </Notice>

      <Card className="mb-6">
        <CardHeader title="Offre QR Pro (numérique)" description="Page pro en ligne, QR code permanent, configurateur et fichiers d'impression illimités. Payée une seule fois." />
        <ActionForm action={saveOffer} className="grid items-end gap-4 px-5 py-5 sm:px-6 md:grid-cols-[180px_1fr_auto]">
          <div><label className="label" htmlFor="price">Prix (€)</label><input className="input" id="price" name="price" inputMode="decimal" defaultValue={cents(s.digitalPriceCents)} /><FieldError name="price" /></div>
          <Check name="printEnabled" label="Accepter les commandes d'étiquettes imprimées" defaultChecked={s.printEnabled} />
          <SubmitButton size="sm">Enregistrer</SubmitButton>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader title="Étiquettes imprimées et livrées" description="Prix TOTAL par quantité : impression, découpe, contrôle et livraison suivie compris. L'offre QR Pro s'ajoute une seule fois pour un compte pas encore actif." />
        <div className="divide-y divide-line">
          {[...tiers, emptyTier].map((t) => (
            <ActionForm key={t.id || "new"} action={saveTier} resetOnSuccess={!t.id} className="grid items-end gap-3 px-5 py-4 sm:px-6 md:grid-cols-[140px_160px_1fr]">
              <input type="hidden" name="id" value={t.id} />
              <div><label className="label">{t.id ? "Quantité" : "Nouvelle quantité"}</label><input className="input" name="quantity" inputMode="numeric" defaultValue={t.quantity || ""} /><FieldError name="quantity" /></div>
              <div><label className="label">Prix total (€)</label><input className="input" name="price" inputMode="decimal" defaultValue={t.priceCents ? cents(t.priceCents) : ""} /><FieldError name="price" /></div>
              <div className="flex flex-wrap items-center gap-4 pb-1.5">
                <Check name="active" label="Proposée" defaultChecked={t.active} />
                {t.id ? (
                  <span className="text-[13px] text-muted">
                    {eurosExact(unitCents(t))} l&apos;étiquette{t.active && savingPct(t, active) ? ` · −${savingPct(t, active)} %` : ""}
                  </span>
                ) : null}
                <SubmitButton size="sm" variant={t.id ? "secondary" : "primary"}>{t.id ? "Enregistrer" : "Ajouter"}</SubmitButton>
              </div>
            </ActionForm>
          ))}
        </div>
        <p className="border-t border-line px-5 py-4 text-[12.5px] leading-relaxed text-muted sm:px-6">
          Repère de coût (à ajuster avec vos achats réels) : feuille A4 vinyle + encre ≈ 1 €, enveloppe ≈ 0,50 €, lettre suivie ≈ 3 €, Colissimo ≈ 8 € au-delà de 250 étiquettes, frais Stripe ≈ 1,5 % + 0,25 €.
        </p>
      </Card>
    </>
  );
}
