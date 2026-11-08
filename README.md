# QR Pro — QR codes permanents et étiquettes pour les pros du bâtiment

Un chauffagiste (plombier, frigoriste, installateur de PAC…) crée son compte, personnalise sa page professionnelle et ses étiquettes, puis :

- **Option A — numérique** : il génère une planche A4 PDF (10, 25, 50 ou 100 étiquettes) et l'imprime lui-même. Il peut aussi exporter chaque étiquette en PNG 600 dpi ou en SVG.
- **Option B — impression** : il commande des étiquettes imprimées. L'administrateur les fait imprimer (fichier de production fourni), les expédie et met à jour le statut ; le client est prévenu par email à chaque étape.

Le client final scanne l'étiquette et ouvre la page du professionnel (appel en un geste, demande d'intervention, enregistrement du contact, informations de l'installation), sans application ni compte.

## Choix techniques

| Besoin | Choix | Raison |
|---|---|---|
| Application | **Next.js 16** (React 19, TypeScript, App Router) | Une seule base de code pour la landing, l'espace pro, l'admin, les pages publiques **rendues côté serveur** (rapides au scan) et l'API (PDF, Stripe). Déploiement natif sur Vercel. |
| Style | **Tailwind CSS 3** | Tailwind 4 et Turbopack utilisent des binaires natifs bloqués par Smart App Control sur ce poste. |
| Base de données | **PostgreSQL** via **Prisma 7** | Schéma typé, migrations versionnées. En production : la base Postgres de **Supabase** (ou Neon). |
| Authentification | Sessions maison | Mot de passe haché en **scrypt**, jeton de session aléatoire dont seule l'empreinte HMAC est stockée, cookie `HttpOnly`/`SameSite=Lax`/`__Host-`, limitation des tentatives en base, réinitialisation par lien à usage unique (1 h). |
| QR codes | **qrcode** (norme ISO 18004) + **jsQR** | Correction d'erreur Q (25 %), zone blanche de 4 modules, toujours noir sur blanc. **Chaque export est relu par un décodeur indépendant** avant d'être livré. |
| Éditeur d'étiquettes | Moteur maison + **fontkit** + **Lucide** | Document à calques en millimètres. Le texte est converti en contours vectoriels : l'aperçu, le PNG, le SVG et le PDF sont strictement identiques, sans dépendre des polices de l'imprimeur. 7 polices libres (SIL OFL) dans `public/fonts`. |
| PDF | **pdf-lib** | PDF 100 % vectoriel : dimensions exactes en mm, QR net à toute échelle, police Helvetica standard. |
| Paiement | **Stripe Checkout** | Page de paiement hébergée par Stripe, webhook signé et idempotent, vérification du montant. |
| Emails | **Resend** (API HTTP) | Confirmation de commande, statuts, demandes d'intervention, réinitialisation, support. |

**Pourquoi pas Supabase Auth et la RLS Supabase ?** Le navigateur ne parle jamais à la base : toutes les lectures et écritures passent par le serveur Next.js, qui résout l'entreprise **depuis la session**, jamais depuis un identifiant envoyé par le navigateur (`requirePro()` / `requireAdmin()`, appelés dans chaque page **et** chaque action). Supabase sert donc uniquement d'hébergeur PostgreSQL, et son API REST est **fermée** par `prisma/supabase-lockdown.sql` (RLS activée sur toutes les tables, sans politique). On ne désactive aucune protection de Supabase : on les renforce.

### Les QR codes

- Chaque professionnel a **un QR code permanent** (code de 7 caractères, sans 0/O/1/I/L), créé à l'activation de l'offre et imprimé sur toutes ses étiquettes. Le QR contient l'adresse courte `https://votre-domaine.fr/q/<code>`, qui redirige vers la page `https://votre-domaine.fr/p/<slug>/<code>`. Adresse courte = QR moins dense = QR plus petit à lisibilité égale (16 mm minimum au lieu de 20).
- Le QR ne contient **que cette URL**. Le pro modifie son téléphone, son logo ou son adresse : les étiquettes déjà posées affichent tout de suite les nouvelles informations.
- Le **slug** (`chauffage-dupont`) est unique en base (un suffixe `-2`, `-3`… est ajouté si besoin). Il est modifiable jusqu'à la première étiquette, puis **définitif**.
- Un code scanné avec un mauvais slug redirige vers l'URL exacte.
- Les étiquettes numérotées de l'ancienne offre (un code par étiquette) restent actives : le pro peut toujours y renseigner l'installation (appareil, dates d'entretien), affichée à qui la scanne s'il coche « Afficher ».
- **Lisibilité garantie** : les modèles intègrent le QR sans jamais le toucher. Les tests vérifient chaque modèle dans chacun de ses formats : modules ≥ 0,42 mm, QR relu par un décodeur indépendant, aucun texte sous le QR ou hors de la marge de découpe, contraste des couleurs.


### L'éditeur d'étiquettes (`/espace/etiquette`)

- **Bibliothèque de 36 modèles** dans 10 catégories (métier, moderne, minimaliste, premium, industriel, illustré, photo, professionnel, élégant, créatif), affichée en **galerie plein écran** dès la première visite : recherche (« chaudière », « sombre », « photo »…), filtres (catégorie, format, ambiance claire/sombre, avec photo / illustration / logo), **aperçus en situation** (façade de chaudière, tôle, mur, groupe extérieur), fenêtre d'aperçu pour essayer d'autres couleurs, polices et formats avant de choisir. On peut aussi partir d'une **page blanche** ou revenir à son design.
- Les 18 modèles récents (`src/lib/labels/templates-v3.ts`) **intègrent le QR au design** : il garde la taille minimale fiable et laisse la place aux illustrations métier (chaudière, radiateur, pompe à chaleur, goutte, flamme…), aux formes organiques, motifs, badges et **photos du pro** (avec une variante illustrée s'il n'en a pas). Formats : 40×40, 50×50, 60×40, 70×50, 90×60 (le 40×40 propose les modèles qui y restent lisibles).
- **Édition libre, comme Canva** :
  - déplacer, redimensionner avec des poignées, guides magnétiques (bords, centre, marges, autres éléments) ;
  - calques : ordre, masquer, verrouiller ;
  - dupliquer, annuler / rétablir (Ctrl+Z / Ctrl+Y), déplacement au clavier ;
  - double-clic sur un texte pour l'éditer directement sur l'étiquette ;
  - barre d'actions flottante sur l'élément sélectionné (modifier, dupliquer, devant/derrière, verrouiller, supprimer).
- **Éléments** : textes (7 polices, gras, majuscules, interlettrage, alignements, une seule ligne), 14 formes, 46 icônes métier, logo, et une **bibliothèque graphique** dessinée pour l'impression : 14 illustrations métier, 10 formes organiques, 5 badges, 4 ornements, 8 motifs (points, trame, rayures, grille, ondes…), tous recolorables.
- **Images** : import de photos ou PNG transparents (redimensionnés dans le navigateur), réutilisation des photos de « Ma page », recadrage automatique, coins arrondis jusqu'au rond. Une photo utilisée par le design ou par un lot déjà généré ne peut pas être supprimée.
- **Idées** : variantes du design en cours (harmonies × polices) en un clic.
- **Données dynamiques** : `{nom}`, `{telephone}`, `{metier}`… se remplissent depuis « Ma page ». Une valeur de repli est possible : `{metier|Entretien}`.
- **Marque** : 12 harmonies de couleurs, une harmonie générée à partir des couleurs du logo, 7 associations de polices. Les couleurs passent par des rôles (principale, secondaire, accent, texte, fond) : changer d'harmonie restyle tout le design.
- **Assistant d'impression** :
  - vérifie en continu que le QR se relit et que ses modules mesurent au moins 0,42 mm ;
  - signale les textes trop petits (moins de 5 pt), trop peu contrastés, hors de la marge de découpe, qui se chevauchent ou que le QR masque ;
  - corrige chaque point en un clic (« Tout corriger »).
- **Garanties sur le QR**, imposées par le code et revérifiées côté serveur à l'enregistrement et à chaque PDF : il reste noir sur blanc avec sa marge blanche, au premier plan, carré, d'au moins 16 mm (modules ≥ 0,42 mm), entièrement dans l'étiquette.
- **Changement de format** : un modèle non retouché est recomposé pour le nouveau format, un design retouché est mis à l'échelle.
- Vue taille réelle, mise en situation, et un brouillon local en cas de fermeture de l'onglet.
- **Design figé dans chaque commande imprimée** : le fichier de production garde une copie du design validé. Les anciens designs (v1) sont convertis automatiquement.

### La vitrine publique (`/p/<slug>`)

- **5 styles de page** aux mises en page différentes : Moderne, Immersif (photo de couverture), Épuré (éditorial), Nuit (sombre premium), Chaleureux.
- **Personnalisation complète dans « Ma page »**, avec aperçu mobile en direct :
  - couleur, police des titres, accroche ;
  - ordre et affichage des 13 sections, choix et ordre des boutons, bouton principal ;
  - photos de réalisations avec couverture, services avec prix, points forts ;
  - certifications et assurances (masquées automatiquement après leur date de validité), moyens de paiement, réseaux sociaux.
- **Actions** : appeler, WhatsApp (lien international `wa.me`), SMS (mobile uniquement), email, itinéraire, fiche contact `.vcf` avec le logo, partage natif, avis Google (lien Google Business Profile), barre d'appel fixe.
- **Statut des horaires en direct**, heure de Paris : « Ouvert · ferme dans 40 min », « Fermé · ouvre lundi à 8 h ».
- **Demande d'intervention** : type de besoin, délai (dont « urgent »), préférence de recontact, jusqu'à 3 photos (JPEG revérifié côté serveur, visible du seul pro).
- **Rappel d'entretien `.ics`** pour une étiquette dont l'installation est renseignée : journée du prochain entretien, alerte 7 jours avant.
- **Statistiques anonymes sur 30 jours** dans le tableau de bord : visites, appels, demandes, WhatsApp, itinéraires, contacts, partages, avis. Ni cookie, ni IP, et les visites du pro ne comptent pas.
- **Règle d'affichage** : une section ou un bouton n'apparaît que si l'information est renseignée.

Tests : `npm run test:vitrine` lance un parcours de 11 étapes sur la vitrine.

### Demandes des clients et notifications

**Côté client** (page publique) : boutons **Appeler, Intervention, Devis, Urgence, Message**. Chacun ouvre le même formulaire sur le bon type :
- choix du problème en un geste (liste modifiable par le pro dans « Ma page »), description, délai (aujourd'hui / 48 h / pas pressé) ;
- adresse **complétée automatiquement** (Base Adresse Nationale, service public gratuit, sans clé) ;
- disponibilités à cocher + précision libre ;
- jusqu'à 5 photos (prises avec le téléphone, réduites dans le navigateur) ou PDF ;
- mode de recontact (appel, SMS, WhatsApp, email).
« Urgence » met en avant le bouton d'appel et marque la demande comme urgente. Le pro choisit quels types proposer, si l'adresse est obligatoire, s'il demande les disponibilités et les pièces jointes. Chaque envoi porte une clé unique : un double clic ne crée jamais deux demandes.

**Côté pro** :
- « Demandes reçues » : filtres À traiter / Planifiées / Terminées, recherche, urgences et non-lues en tête.
- Fiche demande : gros boutons Appeler / SMS / WhatsApp / Email / Itinéraire, pièces jointes, statut (nouvelle → en cours → planifiée avec rendez-vous → terminée/annulée), note interne, journal des notifications, suppression définitive (RGPD).
- L'espace s'installe sur l'écran d'accueil du téléphone (application web) et s'ouvre directement sur les demandes.

**Notifications — 0 € par mois** (`/espace/notifications`) : deux canaux gratuits, aucun SMS ni WhatsApp (aucun service facturé au message dans le code).

| Canal | Coût | Rôle | Compatibilité |
|---|---|---|---|
| **Notification web (Web Push)** | Gratuit, illimité (protocole des navigateurs, clés VAPID) | **Canal principal** : alerte en quelques secondes ; un appui ouvre la demande. | Ordinateur : Chrome, Edge, Firefox, Safari macOS 13+ (navigateur lancé, même en arrière-plan). Android : Chrome, Edge, Firefox, Samsung Internet, téléphone en veille compris. iPhone/iPad : iOS 16.4+ **après ajout à l'écran d'accueil depuis Safari** (limite d'Apple, pas de push dans Safari « onglet »). |
| **Email** (Resend, offre gratuite) | Gratuit dans la limite de 100 / jour et 3 000 / mois | **Complément** : « seulement si le push n'arrive pas » (par défaut) ou « à chaque demande ». Détail complet + pièces jointes. | Toute messagerie. |

- Chaque appareil s'active séparément (téléphone, PC du bureau…), avec un bouton d'essai réel.
- Limites connues de Web Push :
  - le mode « Ne pas déranger » ou l'économie d'énergie peut retarder l'alerte ;
  - sur ordinateur, le navigateur doit être lancé ;
  - la notification reste en attente 24 h chez le service push si l'appareil est éteint ;
  - les autorisations retirées sont détectées : l'appareil est retiré et l'email de secours prend le relais.
- **Vérifié réellement** sur ce poste (`node tests/push/push-check.mjs`, ajouter `--chrome` pour Chrome) : un vrai navigateur s'abonne au service push de son éditeur, reçoit une notification signée VAPID et le service worker l'affiche.
  - Testé : Edge → Microsoft WNS, Chrome → Google FCM (le même service qu'Android).
  - Non testés sur appareil physique : Android et iPhone. Ils utilisent les mêmes standards (FCM pour Android, APNs via Safari pour iOS 16.4+).

**Garanties** :
1. La demande, ses pièces jointes et ses lignes de notification sont écrites **dans la même transaction** : rien n'est perdu ; la demande reste toujours dans « Demandes reçues ».
2. Une ligne par demande et par canal (contrainte unique) et une réservation atomique avant l'envoi : **jamais de doublon**.
3. Les échecs temporaires sont **réessayés** jusqu'à 3 fois dans l'heure par `GET /api/cron/notifications`, appelé **toutes les 10 min** (`CRON_SECRET`, cron-job.org gratuit). L'envoi normal est immédiat et ne dépend pas de cet appel.
4. Si le push n'est pas remis (aucun appareil, appareil désabonné, échec définitif) → **email de secours**.
5. **Limite gratuite d'emails** : compteur en base (`EmailUsage`) consulté AVANT chaque appel à Resend, pour tous les emails (notifications, commandes, mots de passe).
   - Les notifications s'arrêtent à 90 / jour et 2 900 / mois, ce qui laisse une marge pour les emails de compte.
   - Rien ne part au-delà de 100 / jour et 3 000 / mois.
   - Si Resend signale lui-même la limite, la journée est bloquée.
   - L'envoi est marqué « Non envoyé » avec la raison. Le pro voit un bandeau « emails en pause » ; push et espace continuent.
   - Reprise automatique le lendemain ou le mois suivant. Aucun dépassement, aucun paiement.
6. **Pièces jointes** jamais publiques :
   - le pro connecté y accède directement ;
   - les emails contiennent des liens signés (HMAC), propres à chaque fichier et valables 7 jours ;
   - les notifications ne contiennent qu'un lien qui exige la connexion.

**Configuration** : `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (une seule fois : `npx web-push generate-vapid-keys`, ne plus les changer ensuite), `RESEND_API_KEY` + `EMAIL_FROM` (compte gratuit, domaine vérifié), facultatif `CRON_SECRET`.

### Offre, tarifs et facturation

**Deux offres, rien d'autre** — prix en base, modifiables dans **Administration → Tarifs** :

1. **Offre QR Pro — 39 €, payée une seule fois, sans abonnement.** Page pro en ligne, **un QR code permanent** (le même sur toutes les étiquettes), configurateur, fichiers d'impression (PDF A4, PNG 600 dpi, SVG) **illimités** : réimprimer ne coûte rien.
2. **Étiquettes imprimées et livrées — prix total, livraison suivie comprise**, dégressif :

| Quantité | Prix livré | Par étiquette |
|---|---|---|
| 25 | 25 € | 1,00 € |
| 50 | 39 € | 0,78 € |
| **100 (conseillé)** | **59 €** | 0,59 € |
| 250 | 119 € | 0,48 € |
| 500 | 199 € | 0,40 € |

L'offre QR Pro est ajoutée **une seule fois** à la première commande d'un compte non activé (ex. : 39 € + 59 € = 98 € pour démarrer avec 100 étiquettes ; ensuite 59 € seulement).

**Parcours d'achat** (`/espace/commander`) : une seule page, trois étapes (offre · quantité imprimée facultative · coordonnées), un récapitulatif qui affiche exactement ce qui sera payé, un seul bouton de paiement. Aucun frais n'est ajouté ensuite (la livraison est dans le prix).

**Essai gratuit** : création du compte, de la page et de l'étiquette sans carte bancaire. Avant paiement, la page n'est visible que par son propriétaire (bandeau « Aperçu privé ») ; les visiteurs voient « Page bientôt en ligne », et les fichiers sont verrouillés. Cela empêche de contourner l'offre en pointant un QR gratuit vers la page. L'administrateur peut **offrir l'activation** (client test, geste commercial, paiement hors ligne) depuis la fiche client.

**Facturation** : au paiement, chaque commande reçoit un **numéro de facture chronologique** (`FA-2026-0001`, séquence continue en base, attribuée dans la même transaction que le paiement). La facture PDF (vendeur, SIRET, client, lignes, total, mention TVA, date de règlement) est téléchargeable par le client et l'admin. Stripe ne génère plus sa propre facture (une seule numérotation). Complétez raison sociale, adresse et SIRET dans **Réglages**.

**Suivi** : statuts `Commande reçue → En impression → Expédiée (transporteur + n° de suivi) → Livrée`, email au client à chaque étape, fichier de production PDF dans l'admin. Le tableau de bord admin suit le taux d'activation (comptes actifs / comptes créés).

Raisonnement des prix (coûts indicatifs à confronter à vos achats) : 100 étiquettes 50×50 ≈ 7 feuilles A4 vinyle (≈ 7 € avec l'encre) + enveloppe (0,50 €) + lettre suivie (≈ 3 €) + Stripe (≈ 1,15 €) ≈ 12 € de coût pour 59 € encaissés. Le petit palier (25) reste rentable malgré l'envoi ; au-delà de 250, prévoir Colissimo (≈ 8 €). Les anciennes commandes (packs de crédits) restent consultables ; les comptes qui avaient déjà payé ou posé des étiquettes ont été activés automatiquement par la migration.

## Démarrer en local

```bash
npm install
npx prisma dev --name qrpro --detach
```

`npx prisma dev ls` affiche le port de la base ; renseignez `.env` (voir `.env.example`) avec `DATABASE_URL="postgres://postgres:postgres@localhost:<port>/template1?sslmode=disable"` et `DATABASE_POOL_MAX="1"`, puis :

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Ouvrir http://localhost:3500.

**Au quotidien**, `npm run dev` suffit : il démarre d'abord la base locale si elle est arrêtée et recopie son adresse dans `.env` (`scripts/db-start.mjs`), car `prisma dev` peut changer de port à chaque démarrage. Les données sont conservées. Dans Windows PowerShell 5, tapez les commandes une par une : `&&` n'y fonctionne pas. Le seed crée deux **comptes de test** (développement uniquement) : `admin@qrpro.test` / `Admin-QRPro-2026!` et `demo@qrpro.test` / `Demo-QRPro-2026!`.

**Sans clé Stripe et hors production**, le paiement est **simulé** (bouton « Simuler le paiement (développement) »). En production sans clé Stripe, les commandes sont bloquées avec un message clair. **Sans clé Resend**, les emails ne sont pas envoyés : ils s'affichent dans la console du serveur.

## Tests

```bash
npm run test
```

Lance les tests unitaires (673) : chaque modèle dans chacun de ses formats, avec et sans logo, avec et sans photo, avec des noms réalistes et des textes très longs, plus les règles imposées au QR, l'assistant de correction, l'adaptation de format et le PDF A4.

```bash
npm run test:e2e
```

Lance le parcours complet dans Edge, serveur de développement démarré : 19 étapes, dont le cloisonnement entre deux pros, l'administration et l'affichage mobile.

```bash
npm run test:print
```

Rastérise la dernière planche à 300 puis 150 dpi (Python + PyMuPDF) et relit chaque QR, comme après une impression.

## Mise en production (Vercel + Supabase)

1. **Domaine** : choisissez-le avant tout. `APP_URL` est imprimé dans chaque QR et **ne doit plus changer**. Les étiquettes générées en local contiennent `localhost` et ne servent qu'aux tests.
2. **Supabase** : créez un projet (région UE, Paris ou Francfort). Récupérez les deux URL de connexion : « Transaction pooler » pour `DATABASE_URL`, « Session pooler » pour les migrations.
3. **Migrations**, depuis votre poste, avec l'URL Session pooler dans `DATABASE_URL` :

   ```bash
   npm run db:deploy
   ```

   ```bash
   npm run db:seed
   ```

   Ensuite, exécutez `prisma/supabase-lockdown.sql` dans le SQL Editor de Supabase. En production, le seed ne crée **aucun** compte de test.
4. **Administrateur** :

   ```bash
   npm run admin:create -- vous@domaine.fr "un-mot-de-passe-long"
   ```

5. **Vercel** : importez le dépôt GitHub et renseignez les variables de `.env.example` (`DATABASE_URL` = Transaction pooler, `DATABASE_POOL_MAX=3`, `APP_URL`, `AUTH_SECRET`, Stripe, Resend). Le build lance `prisma generate` automatiquement.
6. **Stripe** : créez un endpoint webhook `https://votre-domaine.fr/api/stripe/webhook` avec les événements `checkout.session.completed`, `checkout.session.async_payment_succeeded` et `checkout.session.expired`. Copiez son secret dans `STRIPE_WEBHOOK_SECRET`. Testez avec les cartes de test Stripe avant de passer aux clés `sk_live_`.
7. **Resend** : vérifiez votre domaine (DNS), puis renseignez `RESEND_API_KEY` et `EMAIL_FROM`.
8. **Réglages** (dans l'admin) : raison sociale, SIRET, adresse, email de contact, mention TVA. Les pages légales signalent en orange ce qui manque. **Faites relire les CGV** : ce sont des modèles.

L'admin, page **Réglages → Services connectés**, indique ce qui est réellement configuré.

### Sauvegardes et reprise

- Supabase fait une sauvegarde quotidienne automatique (7 jours sur l'offre Pro, avec restauration à un instant donné en option). L'offre gratuite ne garantit pas les sauvegardes : prévoyez l'offre Pro avant de vendre.
- En complément, faites un export régulier depuis votre poste :

  ```bash
  pg_dump "URL_SESSION_POOLER" --no-owner -Fc -f sauvegarde-qrpro.dump
  ```

- Restauration : `pg_restore --no-owner -d "URL" sauvegarde-qrpro.dump`. Les étiquettes imprimées ne dépendent que des codes en base (table `QrCode`) et du domaine : tant que les deux sont restaurés, elles refonctionnent.

## Évolutions prévues par l'architecture (non développées)

- **Imprimeur connecté** : `fulfillOrder()` (`src/server/orders.ts`) crée le lot et passe la commande en « Reçue ». C'est le point d'appel naturel d'une API d'imprimeur. Le PDF de production est déjà produit par `/api/batches/<id>/pdf`.
- **Domaines personnalisés** : les URL sont construites à un seul endroit (`publicUrl()`, `src/lib/labels/content.ts`) et les pages publiques sont résolues par code. Un champ de domaine par entreprise et une résolution par en-tête `Host` suffiront.

## Structure

```
prisma/              schéma, migrations, seed, verrouillage Supabase
src/lib/labels/      moteur d'étiquettes (formats, QR, textes, modèles, SVG, PDF, vérification)
src/server/          base, sessions, anti-abus, emails, commandes/Stripe, réglages
src/app/(auth)       inscription, connexion, mot de passe
src/app/espace       espace professionnel
src/app/admin        administration
src/app/p            pages publiques scannées
src/app/api          PDF, SVG, logo, vCard, webhook Stripe
tests/               e2e (Playwright) et contrôle d'impression
```
