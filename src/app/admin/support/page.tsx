import Link from "next/link";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/session";
import { PageHeader, Card, Badge } from "@/components/ui";
import { TICKET_STATUS } from "@/components/thread";
import { dateFr } from "@/lib/format";

export const metadata = { title: "Support" };

export default async function AdminSupport() {
  await requireAdmin();
  const tickets = await db.supportTicket.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 200,
    include: { business: { select: { name: true } }, _count: { select: { messages: true } } },
  });
  return (
    <>
      <PageHeader title="Support" description="Demandes envoyées par les clients depuis leur espace." />
      <Card>
        <ul className="divide-y divide-line">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/support/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 hover:bg-canvas">
                <div className="min-w-0">
                  <div className="truncate text-[14.5px] font-medium">{t.subject}</div>
                  <div className="text-[13px] text-muted">{t.business.name} · {dateFr(t.updatedAt, true)} · {t._count.messages} message{t._count.messages > 1 ? "s" : ""}</div>
                </div>
                <Badge tone={TICKET_STATUS[t.status].tone}>{t.status === "OUVERT" ? "À traiter" : TICKET_STATUS[t.status].label}</Badge>
              </Link>
            </li>
          ))}
          {tickets.length === 0 ? <li className="px-6 py-8 text-center text-[14px] text-muted">Aucune demande.</li> : null}
        </ul>
      </Card>
    </>
  );
}
