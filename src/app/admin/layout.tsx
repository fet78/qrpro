import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [s, toProcess, openTickets] = await Promise.all([
    getSettings(),
    db.order.count({ where: { kind: "PRINT", status: { in: ["RECUE", "EN_ATTENTE_VALIDATION", "EN_IMPRESSION"] } } }),
    db.supportTicket.count({ where: { status: "OUVERT" } }),
  ]);
  return (
    <AppShell brandName={s.brandName} area="admin" title="Administration" subtitle={user.email} badges={{ "/admin/commandes": toProcess, "/admin/support": openTickets }}>
      {children}
    </AppShell>
  );
}
