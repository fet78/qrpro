import { getSettings } from "@/server/settings";
import { Fill, DraftNotice } from "../fill";
import { RETENTION } from "@/lib/retention";

export const metadata = { title: "Confidentialité" };

export default async function Privacy() {
  const s = await getSettings();
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <DraftNotice />
      <h2>Responsable du traitement</h2>
      <p><Fill value={s.legalName} label="Raison sociale" /> ({s.brandName}) — <Fill value={s.contactEmail} label="Email de contact" />.</p>
      <h2>Données des professionnels (clients)</h2>
      <ul>
        <li>Compte : email, mot de passe (stocké uniquement sous forme chiffrée irréversible).</li>
        <li>Page publique : les informations que le professionnel choisit de publier.</li>
        <li>Commandes : nom, email, adresse de livraison, montant — conservées 10 ans (obligation comptable).</li>
        <li>Paiement : traité par Stripe ; nous ne recevons jamais les numéros de carte.</li>
      </ul>
      <h2>Données des personnes qui scannent une étiquette</h2>
      <ul>
        <li>Consulter une page ne nécessite aucun compte. Nous comptons le nombre de scans de chaque étiquette, sans enregistrer d&apos;adresse IP, de cookie de suivi ni d&apos;identifiant.</li>
        <li>Le formulaire « Demander une intervention » transmet nom, téléphone, email et message au professionnel concerné uniquement, qui en devient responsable.</li>
        <li>Une empreinte non réversible de l&apos;adresse IP est utilisée quelques heures pour limiter les abus (envois massifs).</li>
      </ul>
      <h2>Durées de conservation</h2>
      <p>Une purge automatique quotidienne supprime :</p>
      <ul>
        <li>les demandes d&apos;intervention, leurs pièces jointes et leurs notifications après {RETENTION.requestsMonths} mois ;</li>
        <li>les statistiques de consultation des pages après {RETENTION.pageEventsMonths} mois ;</li>
        <li>les sessions, liens de connexion et compteurs anti-abus dès leur expiration ;</li>
        <li>les comptes d&apos;essai jamais activés et sans connexion depuis {RETENTION.inactiveTrialMonths} mois, après un email d&apos;avertissement envoyé {RETENTION.warningDays} jours avant.</li>
      </ul>
      <p>Les comptes actifs sont conservés tant qu&apos;ils ne sont pas supprimés par leur titulaire. Les commandes et factures sont conservées 10 ans.</p>
      <h2>Cookies</h2>
      <p>Un seul cookie, strictement nécessaire : la session des professionnels connectés. Aucun cookie publicitaire ou de mesure d&apos;audience.</p>
      <h2>Sous-traitants</h2>
      <p>Hébergement (Netlify), base de données (Prisma Postgres), paiement (Stripe), envoi d&apos;emails (Resend). Certains de ces prestataires hébergent les données aux États-Unis, dans le cadre de garanties contractuelles (clauses types de la Commission européenne).</p>
      <h2>Vos droits</h2>
      <p>Accès, rectification, suppression, opposition : depuis votre espace (la suppression du compte est disponible dans « Compte ») ou par email à <Fill value={s.contactEmail} label="Email de contact" />. Réclamation possible auprès de la CNIL.</p>
    </>
  );
}
