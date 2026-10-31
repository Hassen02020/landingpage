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

## Mise en place de la base dédiée

1. Projet Supabase des landing pages : **`tdexdlukqciolslvjmhd`** (région eu-west-3), distinct d'EasyV4 et d'EasyV4-preview.
2. Dans ce nouveau projet, ouvrir **SQL Editor** et exécuter `supabase/migrations/0001_landing_leads.sql`. Le script s'arrête de lui-même s'il est lancé sur une base EasyV4 ou s'il a déjà été appliqué.
3. Saisir dans Vercel (ou `.env.local`) : `LANDING_SUPABASE_URL`, `LANDING_SUPABASE_SERVICE_ROLE_KEY` et `LANDING_ADMIN_API_KEY` (voir `.env.example`).

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
- `service_role` (clé serveur) peut lire, insérer et modifier, mais pas supprimer. Les effacements se font à la main dans l'éditeur SQL.

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
