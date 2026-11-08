import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { getCurrentUser } from "@/server/auth/session";
import { login } from "../actions";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  const { next } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "";
  if (user) redirect(safe || (user.role === "ADMIN" ? "/admin" : "/espace"));
  return (
    <div className="card p-6 sm:p-8">
      <h1 className="text-[22px] font-semibold tracking-tight">Connexion</h1>
      <p className="mt-1 text-[14px] text-muted">Accédez à votre espace professionnel.</p>
      <ActionForm action={login} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          <FieldError name="email" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Mot de passe</label>
            <Link href="/mot-de-passe-oublie" className="mb-1.5 text-[12.5px] text-muted hover:text-ink">Oublié ?</Link>
          </div>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
          <FieldError name="password" />
        </div>
        <SubmitButton className="w-full" size="lg" pendingLabel="Connexion…">Se connecter</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-[14px] text-muted">
        Pas encore de compte ? <Link href="/inscription" className="link">Créer mon compte</Link>
      </p>
    </div>
  );
}
