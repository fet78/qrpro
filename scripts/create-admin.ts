/**
 * Crée (ou promeut) le compte administrateur.
 *   npm run admin:create -- vous@domaine.fr "MotDePasseLong"
 * Le mot de passe doit faire au moins 12 caractères. À lancer une fois après le premier déploiement.
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 12) {
    console.error('Usage : npm run admin:create -- email@domaine.fr "mot de passe de 12 caractères minimum"');
    process.exit(1);
  }
  const normalized = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const user = await db.user.upsert({
    where: { email: normalized },
    create: { email: normalized, passwordHash, role: "ADMIN" },
    update: { role: "ADMIN", passwordHash, disabledAt: null },
  });
  console.log(`Administrateur prêt : ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
