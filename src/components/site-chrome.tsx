import Link from "next/link";
import { BrandMark } from "./brand";
import { buttonClass } from "./ui";

export function SiteHeader({ brandName, loggedIn }: { brandName: string; loggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <BrandMark name={brandName} />
        <nav className="hidden items-center gap-7 text-[14px] text-muted md:flex">
          <a href="/#fonctionnement" className="hover:text-ink">Fonctionnement</a>
          <a href="/#modeles" className="hover:text-ink">Modèles</a>
          <a href="/#tarifs" className="hover:text-ink">Tarifs</a>
          <a href="/#faq" className="hover:text-ink">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          {loggedIn ? (
            <Link href="/espace" className={buttonClass("dark", "sm")}>Mon espace</Link>
          ) : (
            <>
              <Link href="/connexion" className={buttonClass("ghost", "sm", "hidden sm:inline-flex")}>Connexion</Link>
              <Link href="/inscription" className={buttonClass("dark", "sm")}>Créer mon compte</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ brandName, contactEmail }: { brandName: string; contactEmail: string }) {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <BrandMark name={brandName} />
          <p className="mt-2 text-[13px] text-muted">QR codes permanents et étiquettes pour les professionnels du bâtiment.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-muted">
          <Link href="/mentions-legales" className="hover:text-ink">Mentions légales</Link>
          <Link href="/cgv" className="hover:text-ink">Conditions générales</Link>
          <Link href="/confidentialite" className="hover:text-ink">Confidentialité</Link>
          {contactEmail ? <a href={`mailto:${contactEmail}`} className="hover:text-ink">{contactEmail}</a> : null}
        </nav>
      </div>
    </footer>
  );
}
