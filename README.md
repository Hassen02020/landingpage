# Easy2Book — Landing pages campagnes (Meta, TikTok, WhatsApp)

Landing pages des campagnes publicitaires Easy2Book. Elles accueillent le trafic des publicités, relient chaque visiteur à la publicité d'origine et transmettent les demandes au **CRM EasyV4**. Ce projet ne stocke **aucun lead**.

| Page | Contenu | `product` | `productType` EasyV4 |
|---|---|---|---|
| `/` | Hub : les 3 offres en bref + formulaire de devis | choisi par le visiteur | — |
| `/voyages-organises` | Voyages organisés (Turquie, Malaisie & Bali, Égypte, Maroc…) | `voyage` | `package` |
| `/omra` | Omra 2026 (page en arabe) | `omra` | `omra` |
| `/summer-vibes` | Promos hôtels Tunisie (catégories = niches testées) | `hotel` | `hotel` |
| — | Autre demande | `autre` | `general` |

Réseaux : [Facebook](https://www.facebook.com/Easy2Bookplateforme) · [Instagram](https://www.instagram.com/easy2book.2025/) · [TikTok](https://www.tiktok.com/@easy2book)

## Parcours d'un lead

```
Pub Meta / TikTok ──► landing page
                       │  bandeau de consentement (opt-in)
                       │   ├─ refus / pas de choix : aucun pixel, aucun envoi à Meta/TikTok,
                       │   │   attribution gardée pour la session seulement
                       │   └─ acceptation : Meta Pixel + TikTok Pixel chargés,
                       │       UTM / fbclid / ttclid mémorisés, code visiteur E2B-XXXXXX
                       │
       ┌───────────────┴───────────────────┐
  clic WhatsApp                        formulaire  ─► POST /api/leads
  message + « Réf: E2B-… »                │  contrôles : origine, débit, champ piège,
       │                                  │  téléphone, accord de recontact, doublons
  (si consentement)                       ├─► CRM EasyV4 (contrat submitLead)
  POST /api/track                         ├─► (si consentement) Meta CAPI « Lead »
   ├─► Meta CAPI « Contact »              │     + TikTok « SubmitForm », même event_id
   └─► TikTok « Contact »                 └─► redirection WhatsApp pré-remplie
       même event_id que le pixel
```

La validation des réservations (statuts, conversions « Purchase ») relève d'EasyV4. Ce projet n'expose aucune API de statut ni d'export.

## Consentement

| Donnée / action | Sans consentement | Avec « Accepter » |
|---|---|---|
| Scripts Meta Pixel / TikTok Pixel | non chargés | chargés |
| Événements navigateur → Meta / TikTok | aucun | envoyés (`eventID` / `event_id`) |
| `/api/track` → Meta CAPI / TikTok Events API | aucun appel (le serveur revérifie `consent`) | relayés |
| Événement « Lead » serveur (téléphone haché) | non envoyé (`trackingConsent: false`) | envoyé |
| Cookies `_fbc`, `e2b_vid` | non posés | posés (`_fbc` depuis `fbclid`) |
| Attribution UTM | `sessionStorage` (fin de session) | `localStorage` |
| Référence `E2B-…` dans WhatsApp | oui (donnée interne, non transmise à un tiers) | oui |
| Lead transmis au CRM EasyV4 | oui, si la case « être recontacté » est cochée | oui |
| `marketingConsent` transmis à EasyV4 | `true` seulement si la case facultative « offres et promotions » est cochée (jamais par défaut) | idem |

Un refus après acceptation supprime les cookies `_fbc`, `_fbp`, `_ttp`, `e2b_vid` et l'attribution stockée.

## Déduplication navigateur / serveur

* **Meta** : `fbq('track', nom, données, { eventID })` côté navigateur et `event_id` identique dans l'API Conversions (`lib/tracking.ts`, `lib/server/meta.ts`).
* **TikTok** : `ttq.track(nom, données, { event_id })` et `event_id` identique dans l'Events API, avec le même nom d'événement (`Lead` → `SubmitForm`, `Contact` → `Contact`).
* **Lead** : l'`event_id` est créé par le formulaire. Il est envoyé au pixel (sans relais `/api/track`) et à `/api/leads`, qui le réutilise pour Meta et TikTok et le transmet à EasyV4 en en-tête `Idempotency-Key`.
* `/api/track` ne relaie qu'une fois un même `event_id`.

Ces règles sont vérifiées par les tests `tests/tracking-client.test.ts`, `tests/leads-route.test.ts` et `tests/track-route.test.ts`.

## Sécurité

* **Secrets** : `META_ACCESS_TOKEN`, `TIKTOK_ACCESS_TOKEN` et `EASYV4_LEAD_INTAKE_TOKEN` sont lus côté serveur uniquement et ne sont jamais préfixés `NEXT_PUBLIC_`. Le jeton Meta est envoyé dans le corps de la requête, pas dans l'URL. Les erreurs du CRM sont journalisées sans données personnelles.
* **Origine** : `/api/leads` et `/api/track` refusent (403) un en-tête `Origin` étranger au site (`NEXT_PUBLIC_SITE_URL`, `ALLOWED_ORIGINS`).
* **Validation** : longueurs bornées, téléphone tunisien (8 chiffres) ou international avec indicatif, `event_id` au format `[A-Za-z0-9-]{8,64}`, liste fermée d'événements relayés, données personnalisées filtrées (clés `a-z_`, valeurs simples).
* **Anti-abus** : champ piège invisible, limite de débit par IP (5 leads / 10 min, 120 événements / min).
* **Anti-doublons** : même `event_id`, ou même téléphone pour le même produit dans les 10 minutes → réponse `duplicate: true`, rien n'est retransmis.
* **Limites connues** : les compteurs (débit, doublons) sont en mémoire, donc propres à chaque instance serverless. Ils arrêtent les doubles clics et les abus simples, pas une attaque distribuée. La protection définitive contre les doublons doit être assurée par EasyV4 via l'`Idempotency-Key`.

## Prérequis côté EasyV4 (bloquant pour la transmission des leads)

EasyV4 ne reçoit aujourd'hui les leads du site que par l'action serveur `app/actions/submit-lead.ts`. Celle-ci n'est appelable que depuis l'application EasyV4 elle-même. Il faut donc un endpoint HTTP dans EasyV4 (par exemple `POST /api/public/leads`) qui :

1. vérifie `Authorization: Bearer <EASYV4_LEAD_INTAKE_TOKEN>` (comparaison à temps constant) ;
2. valide le corps avec le même schéma zod que `submitLead` ;
3. appelle `captureWebsiteLeadCore` dans `withTenantContext`, avec l'agence par défaut et l'origine `{ actorRef: "landing_easy2book", source: "website_form" }` ;
4. utilise l'en-tête `Idempotency-Key` pour ignorer un double envoi.

Corps envoyé par ce projet (`lib/server/crm.ts`) :

```json
{
  "firstName": "Ahmed", "lastName": "Ben Ali", "phone": "+21698140514",
  "message": "Voyageurs : 2 adulte(s), 1 enfant(s)\nRéf landing : E2B-7K3QFM",
  "productType": "package", "productLabel": "Istanbul Été 2026",
  "sourcePage": "landing-easy2book/voyages-organises", "destination": "Hammamet",
  "intention": "standard", "campaignRef": "voyages_ete", "marketingConsent": false
}
```

Tant que cet endpoint n'existe pas, laisser `EASYV4_LEAD_INTAKE_URL` vide. `/api/leads` répond alors `forwarded: false` et le prospect est redirigé vers WhatsApp avec sa demande.

**Données non transmises au CRM** (le schéma EasyV4 n'a pas de colonne pour elles) : `utm_source`, `utm_medium`, `utm_content`, `ad_id`, `fbclid` et `ttclid`. Seuls `campaignRef` (= `utm_campaign`) et la référence `E2B-…` (dans `message`) arrivent dans EasyV4.

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
* **Politique de confidentialité** : ce site n'a pas encore de page dédiée. Le bandeau de consentement n'y renvoie donc pas.

## Développement et tests

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # TypeScript
npm test             # tests unitaires et d'API (Vitest)
npm run build
```

Test navigateur du consentement (Playwright, contre un serveur lancé) :

```bash
npm run build && PORT=3456 npm start
```

```bash
NODE_PATH=$(npm root -g) node tests/e2e/consent.e2e.mjs http://localhost:3456
```
