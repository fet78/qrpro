import { requireAdmin } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { env, appUrl, paymentSimulated } from "@/lib/env";
import { PageHeader, Card, CardHeader, Badge } from "@/components/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { saveSettings } from "../actions";
import { pushStatus, emailStatus } from "@/server/notify/providers";
import { emailUsage } from "@/server/email-quota";

export const metadata = { title: "Réglages" };

function Status({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start justify-between gap-4 px-6 py-3.5">
      <div>
        <div className="text-[14px] font-medium">{label}</div>
        <div className="text-[13px] text-muted">{detail}</div>
      </div>
      {ok ? <Badge tone="success">Configuré</Badge> : <Badge tone="warn">Non configuré</Badge>}
    </li>
  );
}

export default async function AdminSettings() {
  await requireAdmin();
  const [s, usage] = await Promise.all([getSettings(), emailUsage()]);
  const e = env();
  return (
    <>
      <PageHeader title="Réglages" description="Marque, informations légales et état des services connectés." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Marque et commerce" />
          <ActionForm action={saveSettings} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <div><label className="label" htmlFor="brandName">Nom de la marque</label><input className="input" id="brandName" name="brandName" defaultValue={s.brandName} /><FieldError name="brandName" /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="tagline">Accroche</label><input className="input" id="tagline" name="tagline" defaultValue={s.tagline} /></div>
            <div><label className="label" htmlFor="contactEmail">Email de contact</label><input className="input" id="contactEmail" name="contactEmail" type="email" defaultValue={s.contactEmail} /><FieldError name="contactEmail" /></div>
            <div><label className="label" htmlFor="contactPhone">Téléphone de contact</label><input className="input" id="contactPhone" name="contactPhone" defaultValue={s.contactPhone} /></div>
            <div><label className="label" htmlFor="legalName">Raison sociale / nom</label><input className="input" id="legalName" name="legalName" defaultValue={s.legalName} /></div>
            <div><label className="label" htmlFor="siret">SIRET</label><input className="input" id="siret" name="siret" defaultValue={s.siret} /><FieldError name="siret" /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="legalAddress">Adresse du siège</label><input className="input" id="legalAddress" name="legalAddress" defaultValue={s.legalAddress} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="vatMention">Mention TVA</label><input className="input" id="vatMention" name="vatMention" defaultValue={s.vatMention} /><p className="hint">Ex. : « TVA non applicable, art. 293 B du CGI » (micro-entreprise) ou « Prix TTC, TVA 20 % incluse ».</p></div>
            <div className="sm:col-span-2"><SubmitButton>Enregistrer</SubmitButton></div>
          </ActionForm>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Services connectés" description="Lu depuis les variables d'environnement du serveur." />
          <ul className="divide-y divide-line">
            <Status ok={!!e.STRIPE_SECRET_KEY} label="Stripe (paiements)" detail={e.STRIPE_SECRET_KEY ? (e.STRIPE_SECRET_KEY.startsWith("sk_test") ? "Mode test" : "Mode réel") : paymentSimulated() ? "Paiement simulé (développement uniquement)" : "Les commandes sont bloquées"} />
            <Status ok={!!e.STRIPE_WEBHOOK_SECRET} label="Webhook Stripe" detail={`${appUrl()}/api/stripe/webhook`} />
            <Status ok={!!(e.RESEND_API_KEY && e.EMAIL_FROM)} label="Resend (emails)" detail={e.EMAIL_FROM ?? "Aucun email n'est envoyé"} />
            <Status ok={!!e.ADMIN_NOTIFY_EMAIL} label="Alertes administrateur" detail={e.ADMIN_NOTIFY_EMAIL ?? "ADMIN_NOTIFY_EMAIL non défini"} />
          </ul>
          <CardHeader title="Notifications des demandes (0 € / mois)" description="Canaux gratuits uniquement : aucun SMS ni WhatsApp, aucun service facturé au message." />
          <ul className="divide-y divide-line">
            <Status ok={pushStatus().ready} label="Notifications web (Web Push)" detail={pushStatus().detail} />
            <Status ok={emailStatus().ready} label="Emails des demandes (Resend gratuit)" detail={`${usage.today}/${usage.day} aujourd'hui · ${usage.month}/${usage.monthLimit} ce mois${usage.notificationsBlocked ? " · notifications email en pause (limite gratuite)" : ""}`} />
            <Status ok={!!e.CRON_SECRET} label="Reprise automatique des envois" detail={e.CRON_SECRET ? `GET ${appUrl()}/api/cron/notifications toutes les 10 min` : "CRON_SECRET non défini : les échecs temporaires ne sont repris qu'à la prochaine demande"} />
          </ul>
        </Card>
      </div>
    </>
  );
}
