import { db } from "@/server/db";
import { requirePro } from "@/server/auth/session";
import { PageHeader, Card, CardHeader } from "@/components/ui";
import { ActionForm, FieldError, SubmitButton } from "@/components/form";
import { saveShipping, changeEmail, changePassword, deleteAccount } from "../actions";

export const metadata = { title: "Compte" };

export default async function AccountPage() {
  const user = await requirePro();
  const b = await db.business.findUniqueOrThrow({ where: { id: user.businessId }, select: { shipName: true, shipLine1: true, shipLine2: true, shipPostal: true, shipCity: true, shipPhone: true } });
  return (
    <>
      <PageHeader title="Compte" description="Identifiants, adresse de livraison et données personnelles." />
      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader title="Adresse de livraison" description="Utilisée par défaut pour les étiquettes imprimées." />
          <ActionForm action={saveShipping} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <div className="sm:col-span-2"><label className="label" htmlFor="shipName">Destinataire</label><input className="input" id="shipName" name="shipName" defaultValue={b.shipName} /><FieldError name="shipName" /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="shipLine1">Adresse</label><input className="input" id="shipLine1" name="shipLine1" defaultValue={b.shipLine1} /><FieldError name="shipLine1" /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="shipLine2">Complément</label><input className="input" id="shipLine2" name="shipLine2" defaultValue={b.shipLine2} /></div>
            <div><label className="label" htmlFor="shipPostal">Code postal</label><input className="input" id="shipPostal" name="shipPostal" defaultValue={b.shipPostal} inputMode="numeric" maxLength={5} /><FieldError name="shipPostal" /></div>
            <div><label className="label" htmlFor="shipCity">Ville</label><input className="input" id="shipCity" name="shipCity" defaultValue={b.shipCity} /><FieldError name="shipCity" /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="shipPhone">Téléphone</label><input className="input" id="shipPhone" name="shipPhone" type="tel" defaultValue={b.shipPhone} /><FieldError name="shipPhone" /></div>
            <div className="sm:col-span-2"><SubmitButton>Enregistrer l&apos;adresse</SubmitButton></div>
          </ActionForm>
        </Card>

        <Card>
          <CardHeader title="Email de connexion" description={`Actuel : ${user.email}`} />
          <ActionForm action={changeEmail} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <div><label className="label" htmlFor="email">Nouvel email</label><input className="input" id="email" name="email" type="email" autoComplete="email" /><FieldError name="email" /></div>
            <div><label className="label" htmlFor="pw-email">Mot de passe actuel</label><input className="input" id="pw-email" name="password" type="password" autoComplete="current-password" /><FieldError name="password" /></div>
            <div className="sm:col-span-2"><SubmitButton variant="secondary">Modifier l&apos;email</SubmitButton></div>
          </ActionForm>
        </Card>

        <Card>
          <CardHeader title="Mot de passe" />
          <ActionForm action={changePassword} resetOnSuccess className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <div><label className="label" htmlFor="current">Mot de passe actuel</label><input className="input" id="current" name="current" type="password" autoComplete="current-password" /><FieldError name="current" /></div>
            <div><label className="label" htmlFor="next">Nouveau mot de passe</label><input className="input" id="next" name="next" type="password" autoComplete="new-password" minLength={10} /><p className="hint">10 caractères minimum.</p><FieldError name="next" /></div>
            <div className="sm:col-span-2"><SubmitButton variant="secondary">Changer le mot de passe</SubmitButton></div>
          </ActionForm>
        </Card>

        <Card className="border-danger/20">
          <CardHeader title="Supprimer mon compte" description="Votre page, vos étiquettes et vos données sont supprimées définitivement. Les QR codes déjà collés n'afficheront plus rien. Les factures sont conservées (obligation légale)." />
          <ActionForm action={deleteAccount} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <div><label className="label" htmlFor="confirm">Tapez SUPPRIMER</label><input className="input" id="confirm" name="confirm" autoComplete="off" /><FieldError name="confirm" /></div>
            <div><label className="label" htmlFor="pw-del">Mot de passe</label><input className="input" id="pw-del" name="password" type="password" autoComplete="current-password" /><FieldError name="password" /></div>
            <div className="sm:col-span-2"><SubmitButton variant="danger">Supprimer définitivement</SubmitButton></div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
