import Link from "next/link";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/session";
import { PageHeader, Card, Badge } from "@/components/ui";
import { dateFr } from "@/lib/format";

export const metadata = { title: "Clients" };

export default async function AdminClients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const businesses = await db.business.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { user: { email: { contains: q, mode: "insensitive" } } }, { city: { contains: q, mode: "insensitive" } }, { slug: { contains: q.toLowerCase() } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: { select: { email: true, disabledAt: true, lastLoginAt: true } }, _count: { select: { codes: true, orders: { where: { status: { not: "EN_ATTENTE_PAIEMENT" } } } } } },
  });
  return (
    <>
      <PageHeader title="Clients" description={`${businesses.length} affiché${businesses.length > 1 ? "s" : ""}`} action={<form><input name="q" defaultValue={q} placeholder="Nom, email, ville" className="input h-9 w-60 py-1.5 text-[13.5px]" /></form>} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[14px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] uppercase tracking-wider text-muted">
              <th className="px-5 py-3 font-medium">Entreprise</th>
              <th className="px-3 py-3 font-medium">Ville</th>
              <th className="px-3 py-3 font-medium">Offre</th>
              <th className="px-3 py-3 text-right font-medium">QR</th>
              <th className="px-3 py-3 text-right font-medium">Cmd</th>
              <th className="px-3 py-3 font-medium">Inscrit le</th>
              <th className="px-5 py-3 font-medium">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {businesses.map((b) => (
              <tr key={b.id} className="hover:bg-canvas">
                <td className="px-5 py-3"><Link href={`/admin/clients/${b.id}`} className="font-medium hover:text-brand">{b.name}</Link><div className="text-[12.5px] text-muted">{b.user.email}</div></td>
                <td className="px-3 py-3 text-muted">{b.city || "—"}</td>
                <td className="px-3 py-3">{b.activatedAt ? <Badge tone={b.activationSource === "offert" ? "info" : "success"}>{b.activationSource === "offert" ? "Offerte" : "Active"}</Badge> : <span className="text-[12.5px] text-faint">Essai</span>}</td>
                <td className="px-3 py-3 text-right tabular-nums">{b._count.codes}</td>
                <td className="px-3 py-3 text-right tabular-nums">{b._count.orders}</td>
                <td className="px-3 py-3 text-muted">{dateFr(b.createdAt)}</td>
                <td className="px-5 py-3">{b.user.disabledAt ? <Badge tone="danger">Désactivé</Badge> : <Badge tone="success">Actif</Badge>}</td>
              </tr>
            ))}
            {businesses.length === 0 ? <tr><td colSpan={7} className="px-5 py-8 text-center text-muted">Aucun client.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
