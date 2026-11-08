/**
 * Vérification RÉELLE de bout en bout des notifications Web Push sur ce poste :
 * un vrai navigateur (Edge) s'abonne auprès du service push de son éditeur (Microsoft WNS, Google FCM…),
 * on lui envoie une notification signée VAPID avec la librairie du serveur, et on vérifie que le
 * service worker de QR Pro l'a reçue et affichée.
 *   node tests/push/push-check.mjs            (serveur de dev lancé sur le port 3500)
 */
import { chromium } from "playwright-core";
import webpush from "web-push";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3500";
const keys = webpush.generateVAPIDKeys();
webpush.setVapidDetails("mailto:test@qrpro.test", keys.publicKey, keys.privateKey);

const headless = !process.argv.includes("--headed");
const channel = process.argv.includes("--chrome") ? "chrome" : "msedge";
const ctx = await chromium.launchPersistentContext("", { channel, headless, permissions: ["notifications"] });
await ctx.grantPermissions(["notifications"], { origin: BASE });
const page = await ctx.newPage();
await page.goto(`${BASE}/connexion`);

const sub = await page.evaluate(async (vapid) => {
  const b64 = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(vapid) });
  return s.toJSON();
}, keys.publicKey);
console.log(`  ✓ Abonnement créé auprès de ${new URL(sub.endpoint).host}`);

const res = await webpush.sendNotification(sub, JSON.stringify({ title: "Essai QR Pro", body: "Nouvelle demande — test", url: "/espace/demandes", tag: "essai-push" }), { TTL: 60, urgency: "high" });
assert.ok(res.statusCode >= 200 && res.statusCode < 300, `service push : ${res.statusCode}`);
console.log(`  ✓ Notification acceptée par le service push (HTTP ${res.statusCode})`);

let shown = [];
for (let i = 0; i < 90 && !shown.length; i++) {
  await page.waitForTimeout(500);
  shown = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => `${n.title} | ${n.body}`));
}
assert.ok(shown.some((s) => s.startsWith("Essai QR Pro")), "notification non affichée par le service worker");
console.log(`  ✓ Reçue et affichée par le service worker : « ${shown[0]} »`);
await ctx.close();
console.log("\nWeb Push fonctionne de bout en bout sur ce navigateur.");
