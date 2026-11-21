import Link from "next/link";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { confirmEmailToken } from "@/server/auth/email-verification";
import { buttonClass } from "@/components/ui";

export const metadata = { title: "Confirmation de l'email", robots: { index: false } };

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await confirmEmailToken(token);
  const ok = result === "ok";
  return (
    <div className="card p-6 text-center sm:p-8" data-testid={`verify-${result}`}>
      {ok ? <CheckCircle2 className="mx-auto h-10 w-10 text-success" /> : <AlertCircle className="mx-auto h-10 w-10 text-danger" />}
      <h1 className="mt-4 text-[22px] font-semibold tracking-tight">{ok ? "Adresse confirmée" : "Lien plus valable"}</h1>
      <p className="mt-2 text-[14px] text-muted">
        {ok
          ? "Merci, votre adresse email est confirmée. Vous recevrez vos factures et vos notifications à cette adresse."
          : result === "expired"
            ? "Ce lien a expiré. Connectez-vous : votre espace propose de renvoyer un nouveau lien."
            : "Ce lien n'est pas valable ou a déjà servi. Connectez-vous : votre espace indique si l'adresse reste à confirmer."}
      </p>
      <Link href="/espace" className={buttonClass("primary", "lg", "mt-6 w-full")}>Aller à mon espace</Link>
    </div>
  );
}
