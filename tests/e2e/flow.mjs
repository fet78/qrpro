/**
 * Parcours complet de bout en bout, dans un vrai navigateur (Edge via playwright-core),
 * contre le serveur de développement (npm run dev, port 3500) en mode « paiement simulé ».
 *
 *   node tests/e2e/flow.mjs
 *
 * Couvre : inscription, essai gratuit (page privée), configurateur, offre QR Pro + facture, fichiers illimités,
 * scan anonyme + demande d'intervention, commande d'étiquettes imprimées, administration,
 * cloisonnement entre deux professionnels, désactivation de compte, affichage mobile.
 */
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3500";
const stamp = Date.now().toString(36);
const PRO_A = { company: `Plomberie Test ${stamp}`, email: `a-${stamp}@qrpro.test`, password: "Test-Pro-A-2026!" };
const PRO_B = { company: `Chauffage Autre ${stamp}`, email: `b-${stamp}@qrpro.test`, password: "Test-Pro-B-2026!" };
const ADMIN = { email: "admin@qrpro.test", password: "Admin-QRPro-2026!" }; // compte de test créé par prisma/seed.ts

let step = 0;
const ok = (msg) => console.log(`  ✓ ${++step}. ${msg}`);

const browser = await chromium.launch({ channel: "msedge", headless: true });
/** Le serveur de développement compile chaque route à la première visite : délais généreux. */
async function newCtx(opts = {}) {
  const ctx = await browser.newContext(opts);
  ctx.setDefaultTimeout(90000);
  ctx.setDefaultNavigationTimeout(90000);
  return ctx;
}

async function signup(ctx, pro) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/inscription`);
  await page.fill("#company", pro.company);
  await page.fill("#email", pro.email);
  await page.fill("#password", pro.password);
  await page.check('input[name="accept"]');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/espace\?bienvenue=1/, { timeout: 90000 });
  return page;
}

async function login(ctx, who) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/connexion`);
  await page.fill("#email", who.email);
  await page.fill("#password", who.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 90000 });
  return page;
}

try {
  // ------------------------------------------------------------------ Pro A
  const ctxA = await newCtx();
  const a = await signup(ctxA, PRO_A);
  assert.match(await a.textContent("main"), /Votre compte est prêt/);
  ok("Inscription du pro A → tableau de bord");

  // Ma page
  await a.goto(`${BASE}/espace/page`);
  await a.fill("#trade", "Plombier chauffagiste");
  await a.fill("#phone", "0611223344");
  await a.fill("#zone", "Nantes et alentours");
  await a.fill("#description", "Installation et entretien de chaudières.");
  await a.click('button[aria-label="Ajouter un service"]');
  await a.fill('input[aria-label="Service 1"]', "Entretien chaudière");
  await a.click('button:has-text("Enregistrer ma page")');
  await a.waitForSelector("text=Page enregistrée");
  const slug = await a.inputValue("#slug");
  assert.ok(slug, "slug introuvable");
  ok(`Page enregistrée (slug ${slug})`);

  // Validation de champ côté serveur
  await a.fill("#postalCode", "12");
  await a.click('button:has-text("Enregistrer ma page")');
  await a.waitForSelector("text=Code postal à 5 chiffres");
  await a.fill("#postalCode", "44000");
  await a.click('button:has-text("Enregistrer ma page")');
  await a.waitForSelector("text=Page enregistrée");
  ok("Validation des formulaires (code postal refusé puis accepté)");

  // Essai gratuit : la page n'est visible que par son propriétaire tant que l'offre n'est pas active.
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const anon = await newCtx({ userAgent: IPHONE });
  const pub = await anon.newPage();
  await pub.goto(`${BASE}/p/${slug}`);
  assert.match(await pub.textContent("body"), /Page bientôt en ligne/);
  assert.doesNotMatch(await pub.textContent("body"), /06 11 22 33 44/);
  await a.goto(`${BASE}/p/${slug}`);
  assert.match(await a.textContent("body"), /Aperçu privé/);
  assert.match(await a.textContent("body"), /06 11 22 33 44/);
  ok("Essai gratuit : page en aperçu privé pour le pro, « bientôt en ligne » pour les visiteurs");

  // Éditeur d'étiquettes (page ramenée au premier plan : un onglet en arrière-plan suspend ses animations)
  await a.bringToFront();
  await a.goto(`${BASE}/espace/etiquette`);
  // Premier passage : la bibliothèque de modèles s'ouvre d'elle-même (recherche, aperçu en situation, format).
  const lib = a.locator('[role="dialog"][aria-label="Bibliothèque de modèles"]');
  await lib.waitFor({ timeout: 60000 });
  await lib.locator('input[aria-label="Rechercher un modèle"]').fill("chaudière");
  await lib.locator('[data-template="braise"] button[aria-label^="Aperçu"]').click();
  await a.locator('button:has-text("60×40")').last().click();
  await a.click('button:has-text("Utiliser et personnaliser")');
  await a.waitForSelector("text=Modèle « Braise » appliqué");
  await a.locator('header button:has-text("Prêt à imprimer")').waitFor();
  // Illustration ajoutée, dupliquée depuis la barre flottante, puis tout annulé (Ctrl+Z).
  await a.click('nav button[data-tab="graphics"]');
  await a.click('button[data-graphic="radiateur"]');
  await a.click('[role="toolbar"] button[aria-label="Dupliquer"]');
  await a.keyboard.press("Control+z");
  await a.keyboard.press("Control+z");
  await a.locator('header button:has-text("Prêt à imprimer")').waitFor();
  await a.click('button:has-text("Valider le design")');
  await a.waitForSelector("text=Design validé");
  ok("Éditeur : bibliothèque (recherche, aperçu), modèle Braise 60×40, illustration ajoutée/dupliquée puis annulée, design validé");

  // Fichiers verrouillés avant activation
  await a.goto(`${BASE}/espace/codes`);
  assert.match(await a.textContent("main"), /Fichiers verrouillés/);
  assert.equal((await a.request.get(`${BASE}/api/sheet?pages=1`)).status(), 402);
  ok("Avant paiement : fichiers d'impression verrouillés (page et API)");

  // Offre QR Pro seule (paiement simulé) : un seul prix, facture
  await a.bringToFront();
  await a.goto(`${BASE}/espace/commander`);
  await a.waitForLoadState("networkidle");
  assert.equal((await a.textContent('[data-testid="order-total"]')).replace(/\s/g, ""), "39,00€");
  await a.fill("#billName", PRO_A.company);
  await a.fill("#billLine1", "3 rue du Test");
  await a.fill("#billPostal", "44000");
  await a.fill("#billCity", "Nantes");
  await a.check('[data-testid="accept-cgv"]');
  await a.click('button:has-text("Payer 39,00")');
  await a.waitForURL(/\/espace\/commandes\/[a-z0-9]+\?simulation=1/, { timeout: 90000, waitUntil: "commit" });
  await a.click('button:has-text("Simuler le paiement")');
  await a.waitForURL(/paiement=ok/, { waitUntil: "commit" });
  await a.waitForLoadState("networkidle");
  const actText = await a.textContent("main");
  assert.match(actText, /Terminée/);
  assert.match(actText, /offre QR Pro est active/);
  const invoiceHref = await a.getAttribute('a:has-text("Facture FA-")', "href");
  const invoice = await a.request.get(`${BASE}${invoiceHref}`);
  assert.equal(invoice.status(), 200);
  assert.equal(invoice.headers()["content-type"], "application/pdf");
  assert.match(invoice.headers()["content-disposition"], /facture-FA-\d{4}-\d{4}\.pdf/);
  ok("Offre QR Pro payée (39 €, paiement simulé) → active, facture PDF numérotée");

  // Page publique en ligne
  await pub.goto(`${BASE}/p/${slug}`);
  const pubText = await pub.textContent("body");
  assert.match(pubText, /06 11 22 33 44/);
  assert.match(pubText, /Entretien chaudière/);
  assert.match(pubText, /Nantes et alentours/);
  ok("Page publique en ligne dès le paiement");

  // Fichiers illimités : planches A4, toujours le même QR code
  await a.goto(`${BASE}/espace/codes`);
  const filesText = await a.textContent("main");
  const code = filesText.match(/Code ([2-9A-Z]{7})/)?.[1];
  assert.ok(code, "QR code principal introuvable");
  const codeId = (await a.getAttribute('a:has-text("SVG vectoriel")', "href")).split("/")[3];
  for (const pages of [1, 2, 1]) {
    const pdf = await a.request.get(`${BASE}/api/sheet?pages=${pages}`);
    assert.equal(pdf.status(), 200);
    assert.ok((await pdf.body()).subarray(0, 5).toString() === "%PDF-");
  }
  const svg = await a.request.get(`${BASE}/api/codes/${codeId}/svg`);
  assert.equal(svg.status(), 200);
  assert.match(await svg.text(), /<svg[^>]+width="60mm" height="40mm"/);
  ok(`Planches A4 téléchargées 3 fois sans rien payer, QR unique ${code}, SVG 60×40 mm`);

  // Export PNG avec contrôle de décodage dans le navigateur
  const [download] = await Promise.all([a.waitForEvent("download", { timeout: 90000 }), a.click('button:has-text("PNG 600 dpi")')]);
  assert.match(download.suggestedFilename(), /^etiquette-[2-9A-Z]{7}\.png$/);
  ok("Export PNG 600 dpi : QR relu dans l'image avant téléchargement");

  // Scan anonyme (adresse courte du QR) + demande d'intervention
  await pub.goto(`${BASE}/q/${code}`);
  assert.ok(pub.url().endsWith(`/p/${slug}/${code}`), "l'adresse courte doit mener à la page");
  await pub.fill('input[name="name"]', "Client Test");
  await pub.fill('input[name="phone"]', "0700000000");
  await pub.fill('textarea[name="message"]', "Ma chaudière fait du bruit.");
  await pub.click('button:has-text("Envoyer ma demande")');
  await pub.waitForSelector("text=Demande envoyée");
  ok("Scan anonyme via /q/CODE → page du pro, demande envoyée");

  await a.goto(`${BASE}/espace/demandes`);
  assert.match(await a.textContent("main"), /Ma chaudière fait du bruit/);
  await a.goto(`${BASE}/espace/codes`);
  assert.match(await a.textContent("main"), /[1-9]\d* scans?\b/); // au moins 1 (en dev, la 1re compilation peut recharger la page)
  ok("Demande reçue côté pro, scan comptabilisé");

  // Notifications gratuites : activation du push dans l'interface, essai réel, email en complément, journal
  await ctxA.grantPermissions(["notifications"], { origin: BASE });
  await a.goto(`${BASE}/espace/notifications`);
  await a.waitForLoadState("networkidle");
  assert.equal(await a.locator('[data-channel="sms"], [data-channel="whatsapp"], #sms-to, #wa-to').count(), 0, "aucun canal payant proposé");
  assert.deepEqual(await a.locator("[data-channel]").evaluateAll((els) => els.map((e) => e.getAttribute("data-channel"))), ["push", "email"]);
  const pushReady = (await a.textContent('[data-channel="push"]')).includes("Gratuit · illimité");
  if (pushReady) {
    // Les navigateurs refusent le push en navigation privée : profil normal (temporaire) pour cette étape.
    const pctx = await chromium.launchPersistentContext("", { channel: "msedge", headless: true, permissions: ["notifications"] });
    pctx.setDefaultTimeout(90000);
    const pp = await login(pctx, PRO_A);
    await pp.goto(`${BASE}/espace/notifications`);
    await pp.waitForLoadState("networkidle");
    await pp.click('[data-testid="enable-push"]');
    await pp.waitForSelector("text=Activé sur cet appareil", { timeout: 60000 });
    await pp.click('button:has-text("Envoyer une notification d\'essai")');
    await pp.waitForSelector('[data-channel="push"] >> text=/Envoyé|Échec/', { timeout: 60000 });
    assert.match(await pp.textContent('[data-channel="push"]'), /Envoyé/, "la notification d'essai doit partir");
    // … et le service worker l'a réellement reçue et affichée.
    let shown = [];
    for (let i = 0; i < 90 && !shown.length; i++) {
      await pp.waitForTimeout(500);
      shown = await pp.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => n.title));
    }
    assert.ok(shown.some((t) => /Essai/.test(t)), "notification d'essai non affichée par le service worker");
    await pctx.close();
    await a.goto(`${BASE}/espace/notifications`);
    await a.waitForLoadState("networkidle");
  }
  await a.click('[data-channel="email"] button[role="radio"]:has-text("À chaque demande")');
  await a.click('[data-testid="save-prefs"]');
  await a.waitForSelector("text=Préférences enregistrées");
  await a.goto(`${BASE}/espace/demandes`);
  await a.click("a[data-request]");
  await a.waitForURL(/\/espace\/demandes\/[a-z0-9]+$/);
  assert.match(await a.textContent("main"), /Notifications envoyées/);
  assert.ok((await pub.request.get(`${BASE}/api/cron/notifications`)).status() >= 401, "la reprise des envois est protégée");
  ok(`Notifications gratuites : ${pushReady ? "push activé dans l'interface et notification d'essai envoyée, " : "push non configuré (clés VAPID absentes), "}email « à chaque demande » enregistré, aucun canal payant`);

  // Mauvais slug → redirection vers l'URL exacte
  await pub.goto(`${BASE}/p/mauvais-slug/${code}`);
  assert.ok(pub.url().endsWith(`/p/${slug}/${code}`));
  ok("Code avec un mauvais slug → redirection vers l'URL canonique");

  // Étiquettes imprimées : compte déjà actif → seules les étiquettes sont facturées, livraison comprise
  await a.bringToFront();
  await a.goto(`${BASE}/espace/commander?quantite=100`);
  await a.waitForLoadState("networkidle");
  assert.match(await a.textContent("main"), /Votre offre est active/);
  assert.equal((await a.textContent('[data-testid="order-total"]')).replace(/\s/g, ""), "59,00€");
  await a.fill("#shipPhone", "0611223344");
  await a.check('[data-testid="accept-cgv"]');
  await a.click('button:has-text("Payer 59,00")');
  await a.waitForURL(/simulation=1/, { timeout: 90000, waitUntil: "commit" });
  const printOrderUrl = a.url().split("?")[0];
  await a.click('button:has-text("Simuler le paiement")');
  await a.waitForURL(/paiement=ok/, { waitUntil: "commit" });
  await a.waitForLoadState("networkidle");
  const printText = await a.textContent("main");
  assert.match(printText, /Commande reçue/);
  assert.match(printText, /Livraison suivie/);
  assert.match(printText, /Facture FA-/);
  const printOrderId = printOrderUrl.split("/").pop();
  const batchId = (await a.getAttribute('a:has-text("PDF de la commande")', "href")).split("/")[3];
  ok("100 étiquettes imprimées : 59 € livraison comprise, l'offre n'est pas refacturée, facture émise");

  // ------------------------------------------------------------------ Pro B : cloisonnement
  const ctxB = await newCtx();
  const b = await signup(ctxB, PRO_B);
  for (const url of [`/api/batches/${batchId}/pdf`, `/api/codes/${codeId}/svg`, `/api/orders/${printOrderId}/invoice`]) {
    const r = await b.request.get(`${BASE}${url}`);
    assert.equal(r.status(), 404, `${url} devrait être inaccessible au pro B`);
  }
  assert.equal((await b.request.get(`${BASE}/api/sheet?pages=1`)).status(), 402, "le pro B (non activé) n'a pas de fichiers");
  const foreignOrder = await b.goto(`${BASE}/espace/commandes/${printOrderId}`);
  assert.equal(foreignOrder.status(), 404);
  await b.goto(`${BASE}/admin`);
  assert.ok(b.url().endsWith("/espace"), "un pro ne doit pas accéder à l'administration");
  const anonPdf = await anon.request.get(`${BASE}/api/batches/${batchId}/pdf`);
  assert.equal(anonPdf.status(), 401);
  ok("Cloisonnement : le pro B et un visiteur n'accèdent à rien du pro A ni à l'admin");

  // ------------------------------------------------------------------ Administration
  const ctxAdmin = await newCtx();
  const adm = await login(ctxAdmin, ADMIN);
  assert.ok(adm.url().endsWith("/admin"));
  await adm.goto(`${BASE}/admin/commandes/${printOrderId}`);
  const prod = await adm.request.get(`${BASE}${await adm.getAttribute('a:has-text("Fichier d\'impression")', "href")}`);
  assert.equal(prod.status(), 200);
  await adm.selectOption("#status", "EXPEDIEE");
  await adm.click('button:has-text("Mettre à jour")');
  await adm.waitForSelector("text=Indiquez le numéro de suivi");
  await adm.fill("#carrier", "La Poste");
  await adm.fill("#trackingNumber", "6A12345678901");
  await adm.click('button:has-text("Mettre à jour")');
  await adm.waitForSelector("text=Statut mis à jour");
  await a.goto(printOrderUrl);
  const shipped = await a.textContent("main");
  assert.match(shipped, /Expédiée/);
  assert.match(shipped, /6A12345678901/);
  ok("Admin : PDF de production, passage à « Expédiée » avec suivi, visible par le client");

  // Prix de l'offre modifiable
  await adm.goto(`${BASE}/admin/tarifs`);
  await adm.fill("#price", "45");
  await adm.locator('button:has-text("Enregistrer")').first().click();
  await adm.waitForSelector("text=Offre enregistrée");
  await anon.newPage().then(async (p) => {
    await p.goto(`${BASE}/#tarifs`);
    assert.match(await p.textContent("#tarifs"), /45\s€/);
    await p.close();
  });
  await adm.fill("#price", "39");
  await adm.locator('button:has-text("Enregistrer")').first().click();
  await adm.waitForSelector("text=Offre enregistrée");
  ok("Admin : prix de l'offre modifié → landing à jour (puis remis à 39 €)");

  // Désactivation du pro B
  await adm.bringToFront();
  await adm.goto(`${BASE}/admin/clients?q=${encodeURIComponent(PRO_B.email)}`);
  const clientHref = await adm.getAttribute(`a:has-text("${PRO_B.company}")`, "href");
  await adm.waitForLoadState("networkidle");
  await adm.goto(`${BASE}${clientHref}`).catch(() => adm.goto(`${BASE}${clientHref}`));
  await adm.click('button:has-text("Désactiver le compte")');
  await adm.waitForSelector("text=Réactiver le compte");
  await b.goto(`${BASE}/espace`);
  assert.ok(b.url().includes("/connexion"), "la session du pro B doit être révoquée");
  const bLogin = await ctxB.newPage();
  await bLogin.goto(`${BASE}/connexion`);
  await bLogin.fill("#email", PRO_B.email);
  await bLogin.fill("#password", PRO_B.password);
  await bLogin.click('button[type="submit"]');
  await bLogin.waitForSelector("text=Ce compte est désactivé");
  ok("Admin : compte B désactivé → session révoquée, connexion refusée");

  // ------------------------------------------------------------------ Mobile
  const mobile = await newCtx({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const m = await mobile.newPage();
  for (const url of [`/p/${slug}/${code}`, "/", "/inscription"]) {
    await m.goto(`${BASE}${url}`);
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `${url} déborde horizontalement de ${overflow}px sur mobile`);
  }
  const mA = await mobile.newPage();
  await mA.goto(`${BASE}/connexion`);
  await mA.fill("#email", PRO_A.email);
  await mA.fill("#password", PRO_A.password);
  await mA.click('button[type="submit"]');
  await mA.waitForURL(/\/espace/);
  for (const url of ["/espace", "/espace/page", "/espace/etiquette", "/espace/codes", "/espace/commander"]) {
    await mA.goto(`${BASE}${url}`);
    const overflow = await mA.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `${url} déborde horizontalement de ${overflow}px sur mobile`);
  }
  await m.goto(`${BASE}/p/${slug}/${code}`);
  await m.screenshot({ path: "tests/output/mobile-public.png", fullPage: true });
  ok("Mobile 375 px : aucune page ne déborde (public, landing, espace pro)");

  console.log(`\nParcours complet réussi (${step} étapes).`);
} catch (e) {
  console.error(`\n✗ Échec après l'étape ${step} :`, e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
