/**
 * Démarre la base locale « prisma dev » (si elle est arrêtée) et recopie son adresse dans .env.
 * prisma dev peut choisir un autre port à chaque démarrage : ce script évite l'erreur ECONNREFUSED.
 * Lancé automatiquement avant « npm run dev » (script predev). Ne fait rien si DATABASE_URL
 * ne pointe pas vers localhost (base distante).
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const NAME = "qrpro";
const envPath = ".env";
const env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const current = env.match(/^DATABASE_URL="?([^"\n]*)"?/m)?.[1] ?? "";
if (current && !/localhost|127\.0\.0\.1/.test(current)) process.exit(0);

const run = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const ROW = /^ ?[a-z][\w-]*\s+(running|not_running|starting)/;

/** Repère la ligne « qrpro » de `prisma dev ls` et l'adresse TCP des lignes indentées qui suivent. */
function findUrl() {
  const lines = run("npx prisma dev ls").split(/\r?\n/);
  const i = lines.findIndex((l) => l.trim().startsWith(`${NAME} `));
  if (i < 0 || /not_running/.test(lines[i]) || !/running/.test(lines[i])) return null;
  const block = [lines[i]];
  for (const l of lines.slice(i + 1)) {
    if (ROW.test(l)) break;
    block.push(l);
  }
  return block.join("\n").match(/postgres:\/\/postgres:postgres@localhost:\d+\/template1/)?.[0] ?? null;
}

let url = findUrl();
if (!url) {
  console.log(`Démarrage de la base locale « ${NAME} »…`);
  // Juste après un arrêt, prisma dev peut encore tenir son verrou quelques secondes : on réessaie.
  for (let attempt = 1; attempt <= 5 && !url; attempt++) {
    try {
      run(`npx prisma dev --name ${NAME} --detach`);
    } catch (e) {
      if (!/Lock file is already being held/.test(String(e.stderr ?? e)) || attempt === 5) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
    }
    url = findUrl();
  }
}
if (!url) {
  console.error(`Impossible de trouver l'adresse de la base « ${NAME} ». Lancez « npx prisma dev ls » pour vérifier.`);
  process.exit(1);
}
const wanted = `${url}?sslmode=disable`;
if (wanted !== current) {
  const line = `DATABASE_URL="${wanted}"`;
  writeFileSync(envPath, /^DATABASE_URL=.*$/m.test(env) ? env.replace(/^DATABASE_URL=.*$/m, line) : `${line}\n${env}`);
  console.log(`Base locale : ${wanted} (.env mis à jour)`);
} else {
  console.log(`Base locale prête : ${wanted}`);
}

// Tables et données de départ : sans effet si tout est déjà en place (migrations et seed idempotents).
const withDb = { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, DATABASE_URL: wanted } };
const migrate = execSync("npx prisma migrate deploy", withDb);
if (/applied/i.test(migrate) && !/No pending migrations/i.test(migrate)) console.log("Tables de la base mises à jour.");
execSync("npm run db:seed", withDb);
