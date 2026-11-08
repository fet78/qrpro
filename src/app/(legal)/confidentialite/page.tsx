import { getSettings } from "@/server/settings";
import { Fill, DraftNotice } from "../fill";

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
      <h2>Cookies</h2>
      <p>Un seul cookie, strictement nécessaire : la session des professionnels connectés. Aucun cookie publicitaire ou de mesure d&apos;audience.</p>
      <h2>Sous-traitants</h2>
      <p>Hébergement (Vercel), base de données (prestataire PostgreSQL choisi par l&apos;éditeur, à préciser), paiement (Stripe), envoi d&apos;emails (Resend).</p>
      <h2>Vos droits</h2>
      <p>Accès, rectification, suppression, opposition : depuis votre espace (la suppression du compte est disponible dans « Compte ») ou par email à <Fill value={s.contactEmail} label="Email de contact" />. Réclamation possible auprès de la CNIL.</p>
    </>
  );
}
