import Link from "next/link";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/session";
import { PageHeader, Card, Badge } from "@/components/ui";
import { dateFr } from "@/lib/format";
import { FORMATS, type FormatKey } from "@/lib/labels/formats";

export const metadata = { title: "QR codes" };

export default async function AdminCodes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const [codes, total] = await Promise.all([
    db.qrCode.findMany({
      where: q ? { OR: [{ code: { contains: q.toUpperCase() } }, { business: { name: { contains: q, mode: "insensitive" } } }] } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { business: { select: { id: true, name: true, slug: true } }, batch: { select: { format: true, printed: true } } },
    }),
    db.qrCode.count(),
  ]);
  return (
    <>
      <PageHeader title="QR codes" description={`${total} codes créés au total. Chaque code est unique et permanent.`} action={<form><input name="q" defaultValue={q} placeholder="Code ou client" className="input h-9 w-56 py-1.5 text-[13.5px]" /></form>} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[14px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] uppercase tracking-wider text-muted">
              <th className="px-5 py-3 font-medium">Code</th>
              <th className="px-3 py-3 font-medium">Client</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Créé le</th>
              <th className="px-3 py-3 text-right font-medium">Scans</th>
              <th className="px-5 py-3 font-medium">Dernier scan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {codes.map((c) => (
              <tr key={c.id} className="hover:bg-canvas">
                <td className="px-5 py-2.5"><a className="link font-mono text-[13px]" href={`/p/${c.business.slug}/${c.code}`} target="_blank">{c.code}</a></td>
                <td className="px-3 py-2.5"><Link href={`/admin/clients/${c.business.id}`} className="hover:text-brand">{c.business.name}</Link></td>
                <td className="px-3 py-2.5 text-muted">{c.main ? <Badge tone="success">QR principal</Badge> : c.batch ? <>{FORMATS[c.batch.format as FormatKey].label} <Badge tone="neutral">Numéroté (ancienne offre)</Badge></> : "—"}</td>
                <td className="px-3 py-2.5 text-muted">{dateFr(c.createdAt)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{c.scanCount}</td>
                <td className="px-5 py-2.5 text-muted">{dateFr(c.lastScanAt, true)}</td>
              </tr>
            ))}
            {codes.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">Aucun code.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
