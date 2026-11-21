import { requirePro } from "@/server/auth/session";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { AppShell } from "@/components/app-shell";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { devVerificationLinksVisible } from "@/server/auth/email-verification";

export default async function ProLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePro();
  const [s, business, pending, account] = await Promise.all([
    getSettings(),
    db.business.findUniqueOrThrow({ where: { id: user.businessId }, select: { name: true, slug: true } }),
    db.interventionRequest.count({ where: { businessId: user.businessId, status: { in: ["nouvelle", "en_cours", "planifiee"] } } }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailVerifiedAt: true } }),
  ]);
  return (
    <AppShell
      brandName={s.brandName}
      area="pro"
      title={business.name}
      subtitle={user.email}
      badges={{ "/espace/demandes": pending }}
      footer={{ label: "Voir ma page publique", href: `/p/${business.slug}` }}
    >
      {account.emailVerifiedAt ? null : <EmailVerificationBanner email={user.email} devConfirm={devVerificationLinksVisible()} />}
      {children}
    </AppShell>
  );
}
