import { getSettings } from "@/server/settings";
import { getCurrentUser } from "@/server/auth/session";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const [s, user] = await Promise.all([getSettings(), getCurrentUser()]);
  return (
    <div className="bg-canvas">
      <SiteHeader brandName={s.brandName} loggedIn={!!user} />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <article className="space-y-4 text-[15px] leading-relaxed text-ink/90 [&_h1]:mb-6 [&_h1]:text-[32px] [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-10 [&_h2]:text-[19px] [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </article>
      </main>
      <SiteFooter brandName={s.brandName} contactEmail={s.contactEmail} />
    </div>
  );
}
