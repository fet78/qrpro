import { requirePro } from "@/server/auth/session";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { AppShell } from "@/components/app-shell";

export default async function ProLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePro();
  const [s, business, pending] = await Promise.all([
    getSettings(),
    db.business.findUniqueOrThrow({ where: { id: user.businessId }, select: { name: true, slug: true } }),
    db.interventionRequest.count({ where: { businessId: user.businessId, status: { in: ["nouvelle", "en_cours", "planifiee"] } } }),
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
      {children}
    </AppShell>
  );
}
