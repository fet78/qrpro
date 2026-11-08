import { euros } from "@/lib/format";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { signup } from "../actions";

export const metadata = { title: "Créer mon compte" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/espace");
  const s = await getSettings();
  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-[22px] font-semibold tracking-tight">Créer mon compte</h1>
      <p className="mt-1 text-[14px] text-muted">Votre page professionnelle est prête en 2 minutes.</p>
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-success-soft px-3 py-2 text-[13.5px] leading-snug text-success">
        <Check className="mt-0.5 h-4 w-4 flex-none" /> Gratuit et sans carte bancaire : créez votre page et votre étiquette, puis activez l&apos;offre QR Pro ({euros(s.digitalPriceCents)}, paiement unique) quand vous êtes prêt.
      </div>
      <ActionForm action={signup} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="company">Nom de l&apos;entreprise</label>
          <input className="input" id="company" name="company" autoComplete="organization" placeholder="Chauffage Dupont" required />
          <FieldError name="company" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email professionnel</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          <FieldError name="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Mot de passe</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          <p className="hint">10 caractères minimum.</p>
          <FieldError name="password" />
        </div>
        <label className="flex items-start gap-2.5 text-[13.5px] text-muted">
          <input type="checkbox" name="accept" className="mt-0.5 h-4 w-4 rounded border-line accent-[rgb(var(--brand))]" />
          <span>
            J&apos;accepte les <Link href="/cgv" className="link" target="_blank">conditions générales</Link> et la{" "}
            <Link href="/confidentialite" className="link" target="_blank">politique de confidentialité</Link>.
          </span>
        </label>
        <FieldError name="accept" />
        <SubmitButton className="w-full" size="lg" pendingLabel="Création…">Créer mon compte</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-[14px] text-muted">
        Déjà inscrit ? <Link href="/connexion" className="link">Se connecter</Link>
      </p>
    </div>
  );
}
