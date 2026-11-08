import Link from "next/link";
import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { PageHeader, Card, CardHeader, Badge } from "@/components/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { TICKET_STATUS } from "@/components/thread";
import { dateFr, phoneFr } from "@/lib/format";
import { createTicket } from "../actions";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const user = await requirePro();
  const [tickets, s] = await Promise.all([
    db.supportTicket.findMany({ where: { businessId: user.businessId }, orderBy: { updatedAt: "desc" } }),
    getSettings(),
  ]);
  return (
    <>
      <PageHeader title="Support" description="Une question, un problème d'impression, une étiquette abîmée ? Écrivez-nous." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Nouvelle demande" />
          <ActionForm action={createTicket} className="space-y-4 p-5 sm:p-6">
            <div>
              <label className="label" htmlFor="subject">Objet</label>
              <input className="input" id="subject" name="subject" maxLength={120} required />
              <FieldError name="subject" />
            </div>
            <div>
              <label className="label" htmlFor="body">Message</label>
              <textarea className="input min-h-[140px]" id="body" name="body" maxLength={4000} required />
              <FieldError name="body" />
            </div>
            <SubmitButton>Envoyer</SubmitButton>
          </ActionForm>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Mes demandes" />
            {tickets.length ? (
              <ul className="divide-y divide-line">
                {tickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/espace/support/${t.id}`} className="block px-5 py-3 hover:bg-canvas">
                      <div className="truncate text-[14px] font-medium">{t.subject}</div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[12.5px] text-muted">
                        <span>{dateFr(t.updatedAt)}</span>
                        <Badge tone={TICKET_STATUS[t.status].tone}>{TICKET_STATUS[t.status].label}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-5 text-[14px] text-muted">Aucune demande.</p>
            )}
          </Card>
          {s.contactEmail || s.contactPhone ? (
            <Card className="p-5 text-[14px]">
              <div className="mb-1 font-medium">Nous contacter directement</div>
              {s.contactEmail ? <a className="link block" href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a> : null}
              {s.contactPhone ? <div className="text-muted">{phoneFr(s.contactPhone)}</div> : null}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
