import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { PageHeader, Card, Badge } from "@/components/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { Thread, TICKET_STATUS } from "@/components/thread";
import { replyTicket } from "../../actions";

export const metadata = { title: "Demande de support" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePro();
  const { id } = await params;
  const t = await db.supportTicket.findFirst({ where: { id, businessId: user.businessId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!t) notFound();
  return (
    <>
      <Link href="/espace/support" className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> Support</Link>
      <PageHeader title={t.subject} action={<Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>} />
      <div className="max-w-3xl space-y-6">
        <Thread messages={t.messages} viewer="pro" />
        <Card className="p-5">
          <ActionForm action={replyTicket} resetOnSuccess className="space-y-3">
            <input type="hidden" name="id" value={t.id} />
            <textarea className="input min-h-[100px]" name="body" placeholder="Votre message" maxLength={4000} aria-label="Votre message" />
            <FieldError name="body" />
            <SubmitButton>Répondre</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
