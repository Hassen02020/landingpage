# Easy2Book — Landing pages campagnes (Meta, TikTok, WhatsApp)

Landing pages des campagnes publicitaires Easy2Book. Elles accueillent le trafic des publicités, relient chaque visiteur à la publicité d'origine et enregistrent les demandes dans une **base Supabase dédiée**.

> **Projet entièrement séparé du CRM EasyV4.** Ce dépôt ne lit ni n'écrit rien dans EasyV4 ou EasyV4-preview :
> - le code refuse de se connecter à ces deux projets (`lib/server/db.ts`) ;
> - la migration SQL s'arrête si elle détecte une base EasyV4.

| Page | Contenu | `product` |
|---|---|---|
| `/` | Hub : les 3 offres en bref + formulaire de devis | choisi par le visiteur |
| `/voyages-organises` | Voyages organisés (Turquie, Malaisie & Bali, Égypte, Maroc…) | `voyage` |
| `/omra` | Omra 2026 (page en arabe) | `omra` |
| `/summer-vibes` | Promos hôtels Tunisie (catégories = niches testées) | `hotel` |

Réseaux : [Facebook](https://www.facebook.com/Easy2Bookplateforme) · [Instagram](https://www.instagram.com/easy2book.2025/) · [TikTok](https://www.tiktok.com/@easy2book)

## Parcours d'un lead

```
Pub Meta / TikTok ──► landing page
                       │  bandeau de consentement (opt-in)
                       │   ├─ refus / pas de choix : aucun pixel, aucun envoi à Meta/TikTok,
                       │   │   attribution gardée pour la session seulement
                       │   └─ acceptation : Meta Pixel + TikTok Pixel chargés,
                       │       UTM / fbclid / ttclid mémorisés, code visiteur E2B-XXXXXX
       ┌───────────────┴────────────────────┐
  clic WhatsApp                         formulaire ─► POST /api/leads
  message + « Réf: E2B-… »                 │  contrôles : origine, débit, champ piège,
       │ (si consentement)                 │  téléphone, accord de recontact, doublons
  POST /api/track                          ├─► Supabase landing : table landing_leads
   ├─► Meta CAPI / TikTok (même event_id)  ├─► (si consentement) Meta « Lead » + TikTok
   └─► Supabase landing : landing_events   │     « SubmitForm », même event_id
                                           └─► redirection WhatsApp pré-remplie
Le conseiller confirme la réservation ─► POST /api/leads/status (clé admin)
   statut « reserve » + montant ─► (si consentement) Meta « Purchase » / TikTok « CompletePayment »
```

## Mini-CRM : espace équipe `/admin`

| Page | Rôle |
|---|---|
| `/admin/login` | Connexion (e-mail + mot de passe Supabase Auth du projet landing) |
| `/admin` | Liste des leads : recherche (nom, téléphone, `E2B-…`), filtres statut / produit / canal, pagination |
| `/admin?followUp=due` | Relances à faire |
| `/admin/leads/[id]` | Fiche : demande, attribution, consentements, statut (montant obligatoire pour « réservé »), relance, responsable, notes, historique, bouton WhatsApp, retrait du consentement marketing |
| `/admin/leads/new` | Saisie manuelle d'un prospect arrivé par WhatsApp ou téléphone |
| `/admin/stats` | Performance par campagne et par niche |
| `/admin/export` | Export CSV (**administrateurs uniquement**, rôle `admin`) |

**Accès** : un compte doit exister dans Supabase Auth **et** figurer, actif, dans `landing_staff`. Les deux contrôles sont faits côté serveur à chaque page et à chaque action. La base les impose aussi (politiques RLS via `landing_is_staff()`). Un compte connecté n'a qu'un accès en **lecture** par l'API Supabase : toute modification passe par le serveur du site, qui écrit l'historique. Un lead anonymisé est entièrement verrouillé. La session est gardée en cookies httpOnly et rafraîchie par `middleware.ts`. Les pages ne sont pas indexées et les 5 tentatives de connexion par 15 minutes sont limitées par e-mail.

**Historique** : chaque création, changement de statut, note, relance, assignation, retrait de consentement et anonymisation est inscrit dans `landing_lead_activities`, avec son auteur. Cette table est en ajout seul : un trigger interdit toute modification ou suppression, sauf la suppression en cascade d'un lead effacé.

**Captcha** : Cloudflare Turnstile sur les formulaires, actif dès que `NEXT_PUBLIC_TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY` sont définies. Le jeton est vérifié côté serveur.

**Notifications** : à chaque nouveau lead, l'équipe est prévenue par e-mail (Resend) et/ou par webhook. C'est le cas même si la base est indisponible : le message indique alors « NON ENREGISTRÉ ».

**Conservation des données** (`landing_purge_personal_data()`). La purge n'est **pas planifiée automatiquement** tant que les durées ne sont pas validées. Une fois qu'elles le sont, activez `pg_cron` (Dashboard > Database > Extensions), puis exécutez :
`SELECT cron.schedule('landing-purge-personal-data', '15 3 * * *', 'SELECT public.landing_purge_personal_data()');`

| Donnée | Durée | Action |
|---|---|---|
| IP, navigateur, cookies publicitaires, identifiants de clic, identifiant visiteur (leads et événements) | 90 jours | effacés |
| Événements de navigation (`landing_events`) | 13 mois | supprimés |
| Leads non réservés | 24 mois après la **dernière interaction** (`last_activity_at`) | anonymisés, y compris le texte des notes de leur historique |
| Leads réservés | 36 mois après la dernière interaction ou la réservation (la plus récente) | anonymisés ; le montant et la date de réservation sont conservés |

`last_activity_at` est mise à jour automatiquement à chaque activité (création, statut, note, relance, assignation). Un client réservé ou recontacté récemment n'est donc jamais anonymisé, même si sa demande est ancienne.

Ces durées sont des propositions : elles se modifient dans `0002_landing_crm.sql` avant application, ou par une migration ultérieure. Le droit à l'effacement s'exerce par `DELETE FROM landing_leads WHERE ref = '…'` dans l'éditeur SQL, ce qui supprime aussi l'historique du lead.

### Ajouter un membre de l'équipe

1. Dans Supabase > **Authentication > Users > Add user**, créez le compte avec son e-mail et un mot de passe, en cochant « Auto confirm ».
2. Dans **SQL Editor**, exécutez :
   ```sql
   INSERT INTO public.landing_staff (user_id, email, full_name, role)
   SELECT id, email, 'Prénom Nom', 'admin' FROM auth.users WHERE email = 'prenom@easy2book.tn';
   ```
3. Pour retirer un accès : `UPDATE public.landing_staff SET active = false WHERE email = '…';`

Dans **Authentication > Sign In / Providers**, désactivez « Allow new users to sign up » : seuls les comptes créés par un administrateur doivent exister.

## Écrans d'administration (rôle « admin »)

| Écran | Rôle |
|---|---|
| `/admin/stats` | **Marketing** (leads, statuts, CA par campagne / groupe d'annonces / annonce, sur une période), **Équipe** (actions, contactés, réservés, taux de conclusion par membre), **Offres**, **Niches**. |
| `/admin/calculateur` | Simulation de rentabilité : coût par lead, taux de contact et de réservation, marge par personne → profit, ROAS, coût par lead maximal. Propose les taux réels des 90 derniers jours. |
| `/admin/integrations` | Pixel Meta + jeton API Conversions, pixel TikTok + jeton Events API, code de test, activation, bouton « Tester ». Un champ vide reprend la variable Vercel. Paramètres d'URL à coller dans les publicités. |
| `/admin/protection` | Téléphones et IP bloqués (aussi depuis la fiche d'un lead), pays autorisés d'après l'IP. Un lead bloqué reçoit un refus sans détail. |
| `/admin/promos` | Codes promo (pourcentage ou montant, produit, dates, nombre maximal d'utilisations). Vérifiés à l'envoi du formulaire, comptés, affichés sur le lead et dans le message WhatsApp. |

Les jetons Meta / TikTok sont **chiffrés** (AES-256-GCM) par le serveur avant d'être enregistrés ; la base ne garde que le texte chiffré et les 4 derniers caractères. La clé est dérivée de `LANDING_SECRETS_KEY` si elle existe, sinon de `LANDING_SUPABASE_SERVICE_ROLE_KEY` : après une rotation de cette clé, ressaisir les jetons dans `/admin/integrations` (l'écran le signale). Toutes les modifications d'intégration sont journalisées (qui, quand, quels champs, jamais les valeurs).

## Mise en place de la base dédiée

1. Projet Supabase des landing pages : **`tdexdlukqciolslvjmhd`** (région eu-west-3), distinct d'EasyV4 et d'EasyV4-preview.
2. Dans ce projet, ouvrir **SQL Editor** et exécuter, dans l'ordre, `supabase/migrations/0001_landing_leads.sql` (**appliquée le 31/10/2026**), puis `supabase/migrations/0002_landing_crm.sql`. Chaque script s'arrête de lui-même sur une base EasyV4, si le précédent manque, ou s'il a déjà été appliqué.
   **Ordre de déploiement** : appliquer `0002` **avant** de déployer ce code. Le formulaire enregistre `consent_text_version`, une colonne créée par `0002`.
   Puis `supabase/migrations/0003_landing_admin.sql` (intégrations, protection, codes promo), **avant** de déployer la version qui contient ces écrans : sans elle, le site fonctionne (variables Vercel, aucune règle de protection) mais un code promo saisi est refusé.
3. Saisir dans Vercel, **en Production uniquement** pour que les déploiements de test n'écrivent jamais dans la base réelle : `LANDING_SUPABASE_URL` et `LANDING_SUPABASE_PUBLISHABLE_KEY` (créées le 31/10/2026), `LANDING_SUPABASE_SERVICE_ROLE_KEY` (secrète, à saisir par vous), et, en option, les variables de notification et de captcha (voir `.env.example`). `LANDING_ADMIN_API_KEY` est déconseillée (voir « API d'administration »).

L'application passe par l'API REST de Supabase (`https://tdexdlukqciolslvjmhd.supabase.co`) avec la clé `service_role`. La chaîne de connexion PostgreSQL (pooler, port 6543) n'est pas utilisée par le site : elle sert seulement aux outils d'administration. Ne jamais la committer avec son mot de passe.

Sans ces variables, le site fonctionne quand même : `/api/leads` répond `stored: false` et le prospect est redirigé vers WhatsApp avec sa demande.

### Contenu de la migration

| Objet | Rôle |
|---|---|
| `landing_leads` | Demandes : prospect, offre, consentements, statut commercial, attribution |
| `landing_events` | Clics WhatsApp et offres consultées (visiteurs consentants uniquement) |
| `landing_campaign_performance` | Vue : leads → réservations → chiffre d'affaires par canal, campagne et produit |
| `landing_niche_performance` | Vue : clics, leads et réservations par niche |

**Deux références distinctes** :
- `ref` est la référence du lead. Elle est générée par le serveur, unique en base (`landing_leads_ref_uq`), envoyée dans le message WhatsApp qui suit le formulaire et utilisée par `/api/leads/status`. Le navigateur ne peut jamais la fixer.
- `visitor_ref` est le code du visiteur, calculé dans le navigateur. Il n'est pas unique et sert seulement à relier un lead à ses clics WhatsApp (`landing_events.visitor_ref`). Il ne permet de modifier aucun lead.

**Contraintes (CHECK)** : format `E2B-XXXXXX` des références, téléphone normalisé, listes fermées (`product`, `status`, `event_name`), longueurs maximales, nombre de voyageurs, montant ≥ 0, statut `reserve` ⇒ `booked_at` renseigné, accord de recontact obligatoire. Les identifiants publicitaires (`visitor_id`, `fbclid`, `ttclid`, `fbp`, `fbc`, `ttp`, `ip`, `user_agent`) sont interdits si `tracking_consent = false`.

**Anti-doublons en base** : index uniques sur `idempotency_key` (= `event_id` du formulaire) et sur `(phone, product, lead_day)`, où `lead_day` est le jour à l'heure de Tunis. Un même prospect ne peut donc créer qu'une demande par produit et par jour.

**Sécurité** :
- RLS activée et forcée sur les deux tables, sans aucune politique ;
- `anon` et `authenticated` n'ont aucun droit (`REVOKE ALL`) ;
- `service_role` (clé serveur) : Supabase lui accorde par défaut **tous** les droits, y compris `DELETE` et `TRUNCATE`. `0001` seule ne les retirait pas : **c'est `0002` qui les retire**, sur toutes les tables landing, et ne rend que le nécessaire au site :
  - leads : SELECT, INSERT, UPDATE ;
  - événements et historique : SELECT, INSERT ;
  - équipe et vues : SELECT.

  Effacements, gestion de l'équipe et purge manuelle se font dans l'éditeur SQL.
- **Règles métier imposées par la base**, quel que soit le rôle (y compris `service_role` et `postgres`) :
  - un lead anonymisé ne peut plus être modifié, mais il peut être effacé ;
  - l'anonymisation est réservée à la fonction de purge ;
  - la date de réservation (`booked_at`) est définitive, ce qui empêche de compter une vente deux fois ;
  - l'historique est en ajout seul, y compris contre `TRUNCATE`.

## Consentement

| Donnée / action | Sans consentement | Avec « Accepter » |
|---|---|---|
| Scripts Meta Pixel / TikTok Pixel | non chargés | chargés |
| Événements navigateur → Meta / TikTok | aucun | envoyés (`eventID` / `event_id`) |
| `/api/track` (Meta CAPI, TikTok, `landing_events`) | aucun appel (le serveur revérifie `consent`) | relayés et journalisés |
| Événement « Lead » serveur (téléphone haché) | non envoyé | envoyé |
| Identifiants publicitaires dans `landing_leads` | non stockés (interdit en base) | stockés |
| Conversion « Purchase » à la réservation | non envoyée | envoyée |
| Cookies `_fbc`, `e2b_vid` | non posés | posés |
| Attribution UTM | `sessionStorage` (fin de session) | `localStorage` |
| Lead enregistré | oui, si la case « être recontacté » est cochée | oui |
| `marketing_consent` | `true` seulement si la case facultative « offres et promotions » est cochée (jamais par défaut) | idem |

Un refus après acceptation supprime les cookies `_fbc`, `_fbp`, `_ttp`, `e2b_vid` et l'attribution stockée.

## Déduplication navigateur / serveur

* **Meta** : `fbq('track', nom, données, { eventID })` côté navigateur, `event_id` identique côté API Conversions.
* **TikTok** : `ttq.track(nom, données, { event_id })` côté navigateur, `event_id` identique côté Events API, avec le même nom d'événement (`Lead` → `SubmitForm`).
* **Lead** : l'`event_id` est créé par le formulaire et envoyé au pixel (sans relais `/api/track`) et à `/api/leads`. Le serveur le réutilise pour Meta et TikTok et l'enregistre comme `idempotency_key`.
* **Purchase** : `event_id = purchase-<id du lead>`, stable, donc un renvoi est dédupliqué.
* `/api/track` ne relaie qu'une fois un même `event_id`.

## API d'administration

> **Recommandation** : ne définissez `LANDING_ADMIN_API_KEY` que pour un besoin précis d'automatisation. Cette clé n'est rattachée à aucune personne : l'historique indique seulement « API », et l'export qu'elle autorise n'est pas limité au rôle `admin`. L'équipe doit utiliser `/admin`. Sans cette variable, les deux routes sont désactivées.

Ces routes sont protégées par l'en-tête `x-api-key: <LANDING_ADMIN_API_KEY>`. La clé dans l'URL est refusée, tout comme une clé configurée de moins de 32 caractères.

```bash
# Export (json ou csv) — filtres : since=AAAA-MM-JJ, product, status, channel, limit (≤ 5000)
curl -H "x-api-key: $LANDING_ADMIN_API_KEY" "https://landingpage-easy2book.vercel.app/api/leads/export?format=csv&since=2026-11-01"
```

```bash
# Valider une réservation (booking_value obligatoire pour « reserve »)
curl -X POST -H "x-api-key: $LANDING_ADMIN_API_KEY" -H "content-type: application/json" \
  -d '{"ref":"E2B-7K3QFM","status":"reserve","booking_value":4800}' \
  https://landingpage-easy2book.vercel.app/api/leads/status
```

`ref` désigne la référence du **lead**, renvoyée par le formulaire, et non le code visiteur. Statuts : `nouveau` → `contacte` → `qualifie` → `reserve` | `perdu`. L'export CSV peut servir à alimenter manuellement un autre outil. Aucune synchronisation automatique avec EasyV4 n'est prévue.

## Sécurité

* **Secrets** : `LANDING_SUPABASE_SERVICE_ROLE_KEY`, `LANDING_ADMIN_API_KEY`, `META_ACCESS_TOKEN` et `TIKTOK_ACCESS_TOKEN` sont lus côté serveur uniquement. Le jeton Meta passe dans le corps de la requête, pas dans l'URL. Les erreurs journalisées ne contiennent pas de données personnelles.
* **Origine** : `/api/leads` et `/api/track` refusent (403) un en-tête `Origin` étranger au site (`NEXT_PUBLIC_SITE_URL`, `ALLOWED_ORIGINS`).
* **Validation** :
  - téléphone tunisien ou international ;
  - longueurs bornées ;
  - `event_id` au format `[A-Za-z0-9-]{8,64}` ;
  - liste fermée d'événements relayés ;
  - données personnalisées filtrées ;
  - filtres d'export validés (pas d'injection dans les requêtes Supabase) ;
  - neutralisation des formules dans le CSV ;
  - mêmes règles reprises par les contraintes SQL.
* **Anti-abus** : champ piège, limite de débit par IP (5 leads / 10 min, 120 événements / min). Ces compteurs sont en mémoire, donc propres à chaque instance. La garantie définitive contre les doublons vient des index uniques en base.

## URL à mettre dans les publicités

Meta (Ads Manager > Annonce > Paramètres d'URL) :

```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}
```

Pour Instagram, mettre `utm_source=instagram`.

TikTok (URL de destination de l'annonce) :

```
https://landingpage-easy2book.vercel.app/omra?utm_source=tiktok&utm_medium=paid&utm_campaign=__CAMPAIGN_NAME__&utm_content=__CID_NAME__&campaign_id=__CAMPAIGN_ID__&ad_id=__CID__
```

Liens en bio ou partagés sur WhatsApp : `?utm_source=instagram_bio&utm_campaign=<nom>` (ou `tiktok_bio`, `whatsapp`…).

## Points à corriger avant mise en ligne

* **Dates commerciales dépassées** (au 31/10/2026) :
  * `app/omra/page.tsx` : départs du 15/07, du 28/07 et du 20/08/2026.
  * `app/voyages-organises/page.tsx` : 19 départs du 06/07 au 15/09/2026, plus le filtre « Juillet / Août / Septembre ».
  * `app/summer-vibes/config.ts` : 12 offres « -30 à -40 % avant le 30 Juin ».
  * `app/summer-vibes/components/CountdownTimer.tsx` : compte à rebours jusqu'au 31/07/2026.
  * `app/page.tsx` : « Early booking jusqu'à -40% ».
* **Images non vérifiées** : 22 images distinctes d'images.unsplash.com (13 dans `summer-vibes/config.ts`, 9 dans `voyages-organises/page.tsx`, 2 reprises dans `app/page.tsx`). Elles n'ont pas pu être chargées depuis l'environnement de développement (réseau bloqué). Ce sont des photos génériques : elles ne représentent pas les hôtels nommés.
* **Image de partage** : `public/logo.png` mesure 3750×3750 px (1,4 Mo), alors que les balises Open Graph annoncent 1200×630.
* **Politique de confidentialité** : ce site n'a pas encore de page dédiée (à créer, avec la durée de conservation des leads).

## Développement et tests

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # TypeScript
npm test             # Vitest : API, déduplication, consentement + migration SQL sur PostgreSQL (PGlite)
npm run build
```

Test navigateur du consentement (Playwright, contre un serveur lancé) :

```bash
npm run build && PORT=3456 npm start
```

```bash
NODE_PATH=$(npm root -g) node tests/e2e/consent.e2e.mjs http://localhost:3456
```
