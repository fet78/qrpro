/**
 * Données de départ : réglages, modèles d'étiquettes, packs, tarifs d'impression, livraison.
 * Idempotent : ne remplace jamais ce que l'administrateur a déjà modifié.
 *
 * Hors production uniquement, crée aussi deux comptes de TEST (identifiants ci-dessous) :
 *   admin  : admin@qrpro.test / Admin-QRPro-2026!
 *   pro    : demo@qrpro.test  / Demo-QRPro-2026!
 * Lancer : npm run db:seed
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";
import { TEMPLATES } from "../src/lib/labels/library";
import { TEMPLATES_V3 } from "../src/lib/labels/templates-v3";


async function main() {
  await db.setting.upsert({ where: { id: "main" }, create: { id: "main" }, update: {} });

  // Modèles de la bibliothèque (src/lib/labels/library.ts) : créés une fois, ensuite gérés dans l'admin.
  // Première installation de la bibliothèque v3 : les nouveaux modèles passent devant les anciens (ordre de l'admin conservé).
  const existing = new Set((await db.template.findMany({ select: { key: true } })).map((r) => r.key));
  if (existing.size && TEMPLATES_V3.some((t) => !existing.has(t.key))) {
    await db.template.updateMany({ data: { position: { increment: TEMPLATES_V3.length } } });
  }
  for (const [i, t] of TEMPLATES.entries()) await db.template.upsert({ where: { key: t.key }, create: { key: t.key, name: t.name, description: t.description, position: i + 1 }, update: {} });

  // Étiquettes imprimées : prix TOTAL livraison comprise, dégressif (voir README, « Tarifs »).
  if ((await db.printTier.count()) === 0) {
    await db.printTier.createMany({
      data: [
        { quantity: 25, priceCents: 2500 }, // 1,00 € l'étiquette
        { quantity: 50, priceCents: 3900 }, // 0,78 €
        { quantity: 100, priceCents: 5900 }, // 0,59 €
        { quantity: 250, priceCents: 11900 }, // 0,48 €
        { quantity: 500, priceCents: 19900 }, // 0,40 €
      ],
    });
  }

  if (process.env.NODE_ENV !== "production") {
    const admin = await db.user.findUnique({ where: { email: "admin@qrpro.test" } });
    if (!admin) await db.user.create({ data: { email: "admin@qrpro.test", role: "ADMIN", emailVerifiedAt: new Date(), passwordHash: await hashPassword("Admin-QRPro-2026!") } });

    const demo = await db.user.findUnique({ where: { email: "demo@qrpro.test" } });
    if (!demo) {
      await db.user.create({
        data: {
          email: "demo@qrpro.test",
          emailVerifiedAt: new Date(),
          passwordHash: await hashPassword("Demo-QRPro-2026!"),
          business: {
            create: {
              slug: "martin-chauffage",
              name: "Martin Chauffage",
              trade: "Chauffagiste · Pompes à chaleur",
              phone: "0612345678",
              email: "contact@martin-chauffage.test",
              address: "12 rue des Artisans",
              postalCode: "69003",
              city: "Lyon",
              zone: "Lyon et 30 km autour",
              description: "Installation, entretien et dépannage de chaudières gaz, pompes à chaleur et poêles à granulés. Contrat d'entretien annuel disponible.",
              emergency: "Dépannage sous 24 h pour nos clients sous contrat.",
              services: {
                create: [
                  { title: "Entretien annuel chaudière", description: "Attestation remise sur place.", position: 0 },
                  { title: "Installation de pompe à chaleur", description: "Air/eau et air/air.", position: 1 },
                  { title: "Dépannage", description: "Gaz, fioul, granulés.", position: 2 },
                ],
              },
              tips: { create: [{ title: "Pression de la chaudière", body: "Entre 1 et 2 bars à froid. En dessous, remettez de l'eau ou appelez-nous.", position: 0 }] },
              tipsEnabled: true,
            },
          },
        },
      });
    }
  }
  console.log("Données de départ en place.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
