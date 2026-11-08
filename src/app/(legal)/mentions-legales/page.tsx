import { getSettings } from "@/server/settings";
import { appUrl } from "@/lib/env";
import { Fill, DraftNotice } from "../fill";

export const metadata = { title: "Mentions légales" };

export default async function LegalNotice() {
  const s = await getSettings();
  return (
    <>
      <h1>Mentions légales</h1>
      <DraftNotice />
      <h2>Éditeur du site</h2>
      <p>
        {s.brandName} — <Fill value={s.legalName} label="Raison sociale" /><br />
        Siège : <Fill value={s.legalAddress} label="Adresse" /><br />
        SIRET : <Fill value={s.siret} label="SIRET" /><br />
        Contact : <Fill value={s.contactEmail} label="Email de contact" />
      </p>
      <p>Directeur de la publication : le représentant légal de l&apos;éditeur.</p>
      <h2>Hébergement</h2>
      <p>Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com. Base de données hébergée par le prestataire indiqué dans la politique de confidentialité.</p>
      <h2>Site</h2>
      <p>Adresse : {appUrl()}. Les pages professionnelles publiées sous /p/ sont rédigées par les professionnels eux-mêmes, qui en sont responsables.</p>
    </>
  );
}
