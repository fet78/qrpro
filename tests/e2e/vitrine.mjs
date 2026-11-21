/**
 * Vitrine publique de bout en bout (serveur de développement lancé, port 3500) :
 * personnalisation dans « Ma page », photos, style, avis Google, WhatsApp, page publique dans chaque style,
 * formulaire avec photo, rappel d'agenda, fiche contact, statistiques.
 *
 *   node tests/e2e/vitrine.mjs
 */
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3500";
const stamp = Date.now().toString(36);
const PRO = { company: `Vitrine Test ${stamp}`, email: `v-${stamp}@qrpro.test`, password: "Test-Vitrine-2026!" };
const PHOTO = path.resolve("tests/fixtures/photo-test.jpg");
const DOC = path.resolve("tests/fixtures/doc-test.pdf");
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

/** Navigation robuste : attend la fin du chargement en cours et réessaie si elle est interrompue. */
async function go(page, url) {
  await page.bringToFront();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  try {
    return await page.goto(url);
  } catch {
    await page.waitForTimeout(1000);
    return page.goto(url);
  }
}

let step = 0;
const ok = (msg) => console.log(`  ✓ ${++step}. ${msg}`);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
ctx.setDefaultTimeout(90000);
const anon = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: IPHONE });
anon.setDefaultTimeout(90000);

try {
  const a = await ctx.newPage();
  await go(a, `${BASE}/inscription`);
  await a.fill("#company", PRO.company);
  await a.fill("#email", PRO.email);
  await a.fill("#password", PRO.password);
  await a.check('input[name="accept"]');
  await a.click('button[type="submit"]');
  await a.waitForURL(/bienvenue/);
  // Offre QR Pro activée (paiement simulé) : la page devient publique.
  await go(a, `${BASE}/espace/commander`);
  await a.fill("#billName", PRO.company);
  await a.fill("#billLine1", "1 place du Test");
  await a.fill("#billPostal", "69003");
  await a.fill("#billCity", "Lyon");
  await a.check('[data-testid="accept-cgv"]');
  await a.click('button:has-text("Payer")');
  await a.waitForURL(/simulation=1/, { waitUntil: "commit" });
  await a.click('button:has-text("Simuler le paiement")');
  await a.waitForURL(/paiement=ok/, { waitUntil: "commit" });
  await a.waitForLoadState("networkidle");
  ok("Compte créé et offre QR Pro activée (paiement simulé)");

  // ---------------------------------------------------------- Personnalisation
  await go(a, `${BASE}/espace/page`);
  await a.fill("#trade", "Plombier chauffagiste");
  await a.fill("#phone", "0611223344");
  await a.fill("#description", "Installation et dépannage de chaudières.");
  await a.click('button:has-text("Mon mobile")');
  await a.fill("#googleReviewUrl", "https://g.page/r/exemple-test/review");
  await a.fill("#tagline", "Le chauffage en toute sérénité");
  await a.fill('input[aria-label="Nouveau point fort"]', "Devis gratuit");
  await a.keyboard.press("Enter");
  await a.click('button[aria-label="Ajouter un service"]');
  await a.fill('input[aria-label="Service 1"]', "Entretien chaudière");
  await a.fill('input[aria-label="Prix du service 1"]', "à partir de 120 €");
  await a.click('button:has-text("Nuit")');
  // Photo de réalisation (envoyée et enregistrée immédiatement)
  const [chooser] = await Promise.all([a.waitForEvent("filechooser"), a.click('button:has-text("Ajouter des photos")')]);
  await chooser.setFiles(PHOTO);
  await a.waitForSelector('input[aria-label="Légende de la photo 1"]');
  await a.fill('input[aria-label="Légende de la photo 1"]', "Pompe à chaleur posée à Lyon");
  await a.click("#tagline"); // déclenche l'enregistrement de la légende
  await a.click('button:has-text("Enregistrer ma page")');
  await a.waitForSelector("text=Page enregistrée");
  const slug = (await a.textContent("main")).match(/\/p\/([a-z0-9-]+) est définitive/)[1];
  ok(`« Ma page » : style Nuit, WhatsApp, avis Google, point fort, service avec prix, photo (slug ${slug})`);

  // Validation : lien d'avis non https refusé
  await a.fill("#googleReviewUrl", "http://pas-https.example");
  await a.click('button:has-text("Enregistrer ma page")');
  await a.waitForSelector("text=L'adresse doit commencer par https://");
  await a.fill("#googleReviewUrl", "https://g.page/r/exemple-test/review");
  await a.click('button:has-text("Enregistrer ma page")');
  await a.waitForSelector("text=Page enregistrée");
  ok("Validation : lien d'avis non sécurisé refusé, puis accepté");

  // ---------------------------------------------------------- Page publique
  const p = await anon.newPage();
  await go(p, `${BASE}/p/${slug}`);
  const body = await p.textContent("body");
  for (const txt of ["Le chauffage en toute sérénité", "Devis gratuit", "à partir de 120 €", "Laisser un avis", "WhatsApp", "Réalisations"]) assert.ok(body.includes(txt), `absent : ${txt}`);
  assert.equal(await p.getAttribute('a:has-text("WhatsApp")', "href"), "https://wa.me/33611223344?text=" + encodeURIComponent(`Bonjour ${PRO.company}, `));
  assert.equal(await p.getAttribute('section a:has-text("Laisser un avis")', "href"), "https://g.page/r/exemple-test/review");
  for (const href of ["#demande", "#devis", "#urgence", "#message"]) assert.equal(await p.locator(`a[href="${href}"]`).count() >= 1, true, `bouton ${href} attendu`);
  const photoUrl = await p.getAttribute('#realisations img', "src");
  const photoRes = await p.request.get(`${BASE}${photoUrl}`);
  assert.equal(photoRes.headers()["content-type"], "image/jpeg");
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 0, `débordement ${overflow}px`);
  ok(`Page publique (style Nuit) : accroche, point fort, prix, avis, WhatsApp international, galerie, aucun débordement`);

  // Galerie plein écran
  await p.click("#realisations button");
  await p.waitForSelector('[role="dialog"] >> text=Pompe à chaleur posée à Lyon');
  await p.click('button[aria-label="Fermer"]');
  ok("Galerie : visionneuse plein écran avec légende");

  // Fiche contact
  const vcf = await (await p.request.get(`${BASE}/api/vcard/${slug}`)).text();
  assert.match(vcf, /BEGIN:VCARD/);
  assert.match(vcf, new RegExp(`FN:${PRO.company}`));
  assert.match(vcf, /TEL;TYPE=WORK,VOICE:0611223344/);
  ok("Fiche contact .vcf (nom, téléphone, lien de la page)");

  // Formulaire de demande : type, problème, urgence, adresse, disponibilités, photo + PDF
  await p.bringToFront();
  await p.click('a[href="#devis"]');
  await p.waitForSelector('[data-kind="devis"][aria-checked="true"]');
  await p.click('[data-kind="intervention"]');
  await p.click('button:has-text("Chaudière en panne")');
  await p.click('button:has-text("Aujourd\'hui")');
  await p.fill('textarea[name="message"]', "Plus d'eau chaude, code erreur F28.");
  await p.fill('input[name="address"]', "12 rue des Lilas");
  await p.fill('input[name="postalCode"]', "69003");
  await p.fill('input[name="city"]', "Lyon");
  await p.click('button:has-text("Matin")');
  await p.fill('input[name="availabilityNote"]', "après 17 h");
  const [pc] = await Promise.all([p.waitForEvent("filechooser"), p.click('button:has-text("Photo")')]);
  await pc.setFiles(PHOTO);
  await p.waitForSelector('img[alt="Photo 1"]');
  // Document trop lourd (> 2 Mo) : refusé avant l'envoi, avec un message clair.
  await p.setInputFiles('[data-testid="request-pdf-input"]', { name: "devis-lourd.pdf", mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2.6 * 1024 * 1024, 32)]) });
  await p.waitForSelector("text=/devis-lourd\\.pdf.*2 Mo maximum par document/");
  await p.setInputFiles('[data-testid="request-pdf-input"]', DOC);
  await p.waitForSelector("text=doc-test.pdf");
  await p.fill('input[name="name"]', "Client Vitrine");
  await p.fill('input[name="phone"]', "0700000000");
  await p.click('button:has-text("SMS")');
  await p.click('button:has-text("Envoyer ma demande")');
  await p.waitForSelector("text=Demande envoyée");
  assert.match(await p.textContent("#demande-section"), /Référence [A-Z0-9]{6}/);
  ok("Formulaire : bouton Devis → Intervention, problème, urgence, adresse, disponibilités, PDF trop lourd refusé avec message, photo + PDF, recontact SMS → envoyé");

  // Statistiques (clic sur appel, via sendBeacon)
  await go(p, `${BASE}/p/${slug}`);
  await p.evaluate(() => document.querySelector('a[href^="tel:"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
  await p.waitForTimeout(1500);

  // ---------------------------------------------------------- Côté pro
  await go(a, `${BASE}/espace/demandes`);
  const list = await a.textContent("main");
  assert.match(list, /Urgent/);
  assert.match(list, /Chaudière en panne/);
  assert.match(list, /69003 Lyon/);
  const reqHref = await a.getAttribute("a[data-request]", "href");
  await go(a, `${BASE}${reqHref}`);
  const det = await a.textContent("main");
  for (const x of ["Client Vitrine", "Plus d'eau chaude, code erreur F28.", "12 rue des Lilas, 69003 Lyon", "Matin — après 17 h", "SMS", "doc-test.pdf", "Notifications envoyées", "Email"]) assert.ok(det.includes(x), `fiche : « ${x} » attendu`);
  const reqPhoto = await a.getAttribute('main img[alt^="Photo 1"]', "src");
  assert.equal((await a.request.get(`${BASE}${reqPhoto}`)).status(), 200);
  assert.equal((await p.request.get(`${BASE}${reqPhoto}`)).status(), 401, "pièce jointe invisible pour un visiteur");
  const pdfHref = await a.getAttribute('a:has-text("doc-test.pdf")', "href");
  const pdfRes = await a.request.get(`${BASE}${pdfHref}`);
  assert.equal(pdfRes.headers()["content-type"], "application/pdf");
  // Suivi : planifier un rendez-vous
  await a.click('button[role="radio"]:has-text("Planifiée")');
  await a.fill("#when", "2027-03-15T09:30");
  await a.fill("#note", "Prévoir sonde F28");
  await a.click('button:has-text("Enregistrer")');
  await a.waitForSelector("text=Demande mise à jour");
  await go(a, `${BASE}/espace/demandes?vue=planifiees`);
  assert.match(await a.textContent("main"), /RDV 15 mars 2027/);
  ok("Demande reçue : fiche complète, pièces jointes réservées au pro, rendez-vous planifié");

  await go(a, `${BASE}/espace`);
  const dash = await a.textContent("main");
  assert.match(dash, /Activité de votre page/);
  const visits = Number((await a.locator('text=Visites de la page').locator("xpath=..").textContent()).replace(/\D/g, ""));
  const calls = Number((await a.locator('text=Appels lancés').locator("xpath=..").textContent()).replace(/\D/g, ""));
  const requests = Number((await a.locator('text=Demandes envoyées').locator("xpath=..").textContent()).replace(/\D/g, ""));
  assert.ok(visits >= 2 && visits < 50 && calls >= 1 && requests === 1, `statistiques : ${visits} visites, ${calls} appels, ${requests} demandes`);
  ok(`Statistiques : ${visits} visites, ${calls} appel(s), ${requests} demande(s)`);

  // Étiquette validée → le QR principal mène à la page, sans bloc « installation » (commun à toutes les étiquettes)
  await go(a, `${BASE}/espace/etiquette`);
  await a.locator('[role="dialog"][aria-label="Bibliothèque de modèles"] button:has-text("Continuer mon design")').click({ timeout: 60000 });
  await a.locator('header button:has-text("Prêt à imprimer")').waitFor();
  await a.click('button:has-text("Valider le design")');
  await a.waitForSelector("text=Design validé");
  await go(a, `${BASE}/espace/codes`);
  const code = (await a.textContent("main")).match(/Code ([2-9A-Z]{7})/)[1];
  await go(p, `${BASE}/q/${code}`);
  assert.ok(p.url().endsWith(`/p/${slug}/${code}`));
  assert.doesNotMatch(await p.textContent("body"), /Votre installation/);
  ok("QR principal : /q/CODE mène à la page, sans fiche d'installation");

  // Tous les styles s'affichent sans erreur ni débordement
  for (const style of ["moderne", "immersif", "epure", "chaleureux"]) {
    await go(a, `${BASE}/espace/page`);
    await a.click(`button:has-text("${{ moderne: "Moderne", immersif: "Immersif", epure: "Épuré", chaleureux: "Chaleureux" }[style]}")`);
    await a.click('button:has-text("Enregistrer ma page")');
    await a.waitForSelector("text=Page enregistrée");
    const r = await go(p, `${BASE}/p/${slug}`);
    assert.equal(r.status(), 200);
    assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `${style} déborde`);
  }
  ok("Les 5 styles s'affichent sur téléphone sans débordement");

  console.log(`\nVitrine vérifiée (${step} étapes).`);
} catch (e) {
  console.error(`\n✗ Échec après l'étape ${step} :`, e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
