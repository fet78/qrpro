import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * Un seul client (un seul pool) par processus, y compris entre les routes de Next.
 *
 * Hébergement serverless (Netlify, Vercel) : chaque instance de fonction a son propre pool, et le
 * gestionnaire de connexions de la base (Prisma Postgres « pooled », PgBouncer…) les mutualise.
 * On garde donc très peu de connexions par instance, on ferme vite celles qui ne servent plus
 * (une fonction peut être gelée puis réveillée), et une connexion coupée par le réseau est
 * journalisée au lieu de faire tomber le processus.
 */
const g = globalThis as unknown as { prisma?: PrismaClient };

/** Détection des plateformes serverless (variables posées par Netlify, Vercel, AWS Lambda). */
export function isServerless(): boolean {
  return !!(process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function create(): PrismaClient {
  const e = env();
  const serverless = isServerless();
  const adapter = new PrismaPg(
    {
      connectionString: e.DATABASE_URL,
      // DATABASE_POOL_MAX l'emporte ; sinon 1 connexion par instance en serverless, 5 sur un serveur classique.
      max: e.DATABASE_POOL_MAX ?? (serverless ? 1 : 5),
      // Connexion inutilisée fermée rapidement en serverless (le gestionnaire de la base garde les siennes).
      idleTimeoutMillis: serverless ? 10_000 : 30_000,
      // Base injoignable : échec clair au bout de 10 s plutôt qu'une page qui ne répond jamais.
      connectionTimeoutMillis: 10_000,
      // Le processus peut s'arrêter même si une connexion reste ouverte (scripts, fin de fonction).
      allowExitOnIdle: true,
    },
    {
      onPoolError: (err) => console.error("[db] connexion inactive fermée par le serveur :", err.message),
      onConnectionError: (err) => console.error("[db] erreur de connexion :", err.message),
    },
  );
  return new PrismaClient({
    adapter,
    log: e.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Avec une seule connexion par instance, une transaction peut devoir attendre qu'une requête voisine
    // (même page, même fonction) libère la connexion : 10 s comme pour la connexion, au lieu de 2 s par défaut.
    transactionOptions: { maxWait: 10_000 },
  });
}

export const db: PrismaClient = (g.prisma ??= create());
