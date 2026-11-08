import Link from "next/link";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { forgotPassword } from "../actions";

export const metadata = { title: "Mot de passe oublié" };

export default function ForgotPage() {
  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-[22px] font-semibold tracking-tight">Mot de passe oublié</h1>
      <p className="mt-1 text-[14px] text-muted">Recevez un lien pour en choisir un nouveau.</p>
      <ActionForm action={forgotPassword} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email du compte</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          <FieldError name="email" />
        </div>
        <SubmitButton className="w-full" size="lg">Envoyer le lien</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-[14px] text-muted">
        <Link href="/connexion" className="link">Retour à la connexion</Link>
      </p>
    </div>
  );
}
