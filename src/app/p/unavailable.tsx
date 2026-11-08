export function Unavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-center">
      <div>
        <h1 className="text-[20px] font-semibold">Page momentanément indisponible</h1>
        <p className="mt-2 text-[14px] text-muted">Cette page professionnelle n&apos;est pas accessible pour le moment.</p>
      </div>
    </div>
  );
}

/** Page d'un compte qui n'a pas encore activé l'offre QR Pro (les visiteurs ne voient rien de son contenu). */
export function NotYetOnline() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-center">
      <div>
        <h1 className="text-[20px] font-semibold">Page bientôt en ligne</h1>
        <p className="mt-2 max-w-sm text-[14px] text-muted">Ce professionnel prépare sa page. Revenez dans quelques jours, ou contactez-le directement.</p>
      </div>
    </div>
  );
}

/** Bandeau du propriétaire tant que l'offre n'est pas active : il voit sa page, ses visiteurs non. */
export function PrivatePreviewBanner() {
  return (
    <div className="sticky top-0 z-10 bg-amber-500 px-4 py-2.5 text-ink">
      <a href="/espace/commander" className="mx-auto flex max-w-[520px] items-center justify-between gap-3 text-[13.5px]">
        <span><b>Aperçu privé</b> : seul vous voyez cette page. Elle sera publique dès l&apos;activation de l&apos;offre QR Pro.</span>
        <span className="flex-none font-semibold underline underline-offset-2">Activer</span>
      </a>
    </div>
  );
}
