import { getSettings } from "@/server/settings";
import { Fill, DraftNotice } from "../fill";

export const metadata = { title: "Conditions générales" };

export default async function Terms() {
  const s = await getSettings();
  return (
    <>
      <h1>Conditions générales d&apos;utilisation et de vente</h1>
      <DraftNotice />
      <h2>1. Objet</h2>
      <p>
        {s.brandName} (<Fill value={s.legalName} label="Raison sociale" />) propose aux professionnels une page web personnalisée accessible par QR code, un configurateur d&apos;étiquettes,
        des fichiers d&apos;étiquettes à imprimer (l&apos;« offre QR Pro ») et, en option, des étiquettes imprimées et livrées. Le service s&apos;adresse à des professionnels agissant dans le cadre de leur activité.
      </p>
      <h2>2. Compte</h2>
      <p>Le client est responsable de la confidentialité de ses identifiants et du contenu publié sur sa page (exactitude des coordonnées, licéité des textes et du logo).</p>
      <h2>3. Prix et paiement</h2>
      <p>
        Les prix sont indiqués en euros TTC sur le site au moment de la commande et constituent le prix total : aucun frais n&apos;est ajouté au moment du paiement (la livraison des étiquettes imprimées est comprise).
        {" "}{s.vatMention}. Le paiement est effectué par carte via Stripe ; aucune donnée bancaire n&apos;est conservée par {s.brandName}. Une facture est émise à chaque paiement et reste téléchargeable dans l&apos;espace client.
      </p>
      <h2>4. Offre QR Pro</h2>
      <p>
        L&apos;offre QR Pro est payée une seule fois, sans abonnement ni reconduction. Elle comprend la mise en ligne de la page professionnelle, un QR code permanent qui y renvoie et le téléchargement illimité
        des fichiers d&apos;étiquettes (réimpressions comprises). La création du compte, de la page et de l&apos;étiquette est gratuite ; la page est publiée et les fichiers débloqués dès la confirmation du paiement.
        Le contenu numérique étant fourni immédiatement à la demande du client, celui-ci reconnaît que son exécution commence dès le paiement.
      </p>
      <h2>5. Étiquettes imprimées</h2>
      <p>
        Les étiquettes sont produites à la commande, à partir du design validé par le client, qui en vérifie l&apos;aperçu (textes, téléphone, logo) avant paiement. Les délais de livraison indiqués
        courent à compter de l&apos;impression. Les étiquettes étant personnalisées, elles ne sont ni reprises ni échangées, sauf défaut d&apos;impression ou dommage au transport signalé dans les 8 jours suivant la réception.
      </p>
      <h2>6. Disponibilité des pages</h2>
      <p>L&apos;adresse contenue dans le QR code est permanente. {s.brandName} met en œuvre les moyens raisonnables pour assurer l&apos;accès continu aux pages, sans garantie d&apos;absence d&apos;interruption. En cas de suppression du compte, les pages et étiquettes associées cessent d&apos;afficher les informations du client.</p>
      <h2>7. Suspension</h2>
      <p>Un compte peut être suspendu en cas d&apos;usage contraire à la loi ou aux présentes conditions (contenu trompeur, usurpation d&apos;identité, spam).</p>
      <h2>8. Contact et litiges</h2>
      <p>Toute réclamation : <Fill value={s.contactEmail} label="Email de contact" />. Droit applicable : droit français.</p>
    </>
  );
}
