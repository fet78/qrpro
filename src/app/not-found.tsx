import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-brand">Erreur 404</div>
      <h1 className="mt-3 text-[28px] font-semibold tracking-tight">Cette page n&apos;existe pas</h1>
      <p className="mt-2 max-w-sm text-[15px] text-muted">Si vous avez scanné une étiquette, vérifiez qu&apos;elle n&apos;est pas abîmée, ou contactez directement le professionnel.</p>
      <Link href="/" className={buttonClass("secondary", "md", "mt-6")}>Retour à l&apos;accueil</Link>
    </div>
  );
}
