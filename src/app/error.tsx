"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonClass } from "@/components/ui";

/**
 * Erreur inattendue dans une page : message clair au lieu de la page technique de Next.js.
 * Le détail reste dans les journaux du serveur ; le visiteur voit seulement une référence.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="text-[13px] font-semibold uppercase tracking-[0.1em] text-brand">Erreur</div>
      <h1 className="mt-3 text-[26px] font-semibold tracking-tight">Un problème est survenu</h1>
      <p className="mt-2 max-w-sm text-[15px] text-muted">La page n&apos;a pas pu s&apos;afficher. Réessayez dans un instant ; si le problème continue, contactez-nous.</p>
      {error.digest ? <p className="mt-2 text-[12.5px] text-faint">Référence : {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className={buttonClass("primary")}>Réessayer</button>
        <Link href="/" className={buttonClass("secondary")}>Retour à l&apos;accueil</Link>
      </div>
    </div>
  );
}
