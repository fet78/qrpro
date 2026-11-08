import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/auth/session";
import { PageHeader, Card, Badge, Button } from "@/components/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { Thread, TICKET_STATUS } from "@/components/thread";
import { adminReply, reopenTicket } from "../../actions";

export const metadata = { title: "Demande de support" };

export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const t = await db.supportTicket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } }, business: { select: { id: true, name: true, user: { select: { email: true } } } } } });
  if (!t) notFound();
  return (
    <>
      <Link href="/admin/support" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Support</Link>
      <PageHeader
        title={t.subject}
        description={<><Link href={`/admin/clients/${t.business.id}`} className="link">{t.business.name}</Link> · {t.business.user.email}</>}
        action={<Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>}
      />
      <div className="max-w-3xl space-y-6">
        <Thread messages={t.messages} viewer="admin" />
        {t.status === "FERME" ? (
          <form action={reopenTicket}><input type="hidden" name="id" value={t.id} /><Button variant="secondary">Rouvrir la demande</Button></form>
        ) : (
          <Card className="p-5">
            <ActionForm action={adminReply} resetOnSuccess className="space-y-3">
              <input type="hidden" name="id" value={t.id} />
              <textarea className="input min-h-[110px]" name="body" placeholder="Réponse (envoyée aussi par email au client)" maxLength={4000} aria-label="Réponse" />
              <FieldError name="body" />
              <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="close" className="h-4 w-4 accent-[rgb(var(--brand))]" /> Clôturer la demande</label>
              <SubmitButton>Envoyer</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
