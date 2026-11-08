import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { resetPassword } from "../../actions";

export const metadata = { title: "Nouveau mot de passe" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-[22px] font-semibold tracking-tight">Nouveau mot de passe</h1>
      <p className="mt-1 text-[14px] text-muted">Vos autres appareils seront déconnectés.</p>
      <ActionForm action={resetPassword} className="mt-6 space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className="label" htmlFor="password">Nouveau mot de passe</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          <p className="hint">10 caractères minimum.</p>
          <FieldError name="password" />
        </div>
        <SubmitButton className="w-full" size="lg">Enregistrer</SubmitButton>
      </ActionForm>
    </div>
  );
}
