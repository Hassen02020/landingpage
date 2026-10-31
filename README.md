# Easy2Book — Landing pages campagnes (Meta, TikTok, WhatsApp)

Landing pages des campagnes publicitaires Easy2Book. Elles captent les leads, les relient à la publicité d'origine et les envoient au CRM.

| Page | Contenu |
|---|---|
| `/` | Hub : les 3 offres en bref + formulaire de devis |
| `/voyages-organises` | Voyages organisés (Turquie, Malaisie & Bali, Égypte, Maroc…) |
| `/omra` | Omra 2026 (page en arabe) |
| `/summer-vibes` | Promos hôtels Tunisie (catégories = niches testées) |

Réseaux : [Facebook](https://www.facebook.com/Easy2Bookplateforme) · [Instagram](https://www.instagram.com/easy2book.2025/) · [TikTok](https://www.tiktok.com/@easy2book)

## Parcours d'un lead

```
Pub Meta / TikTok ──► landing page (UTM + fbclid/ttclid mémorisés, code visiteur E2B-XXXXXX)
                         │
       ┌─────────────────┴──────────────────┐
  clic WhatsApp                        formulaire
  (message + "Réf: E2B-…")             POST /api/leads
       │                                    │
  /api/track ─► Meta CAPI "Contact"    Supabase "leads" + Meta CAPI "Lead"
             ─► TikTok "Contact"       + TikTok "SubmitForm" + webhook CRM
             ─► Supabase "events"      ► redirection WhatsApp pré-remplie
                                            │
                          le conseiller confirme la réservation dans le CRM
                                            │
                     POST /api/leads/status {status:"reserve", booking_value}
                          ─► Meta "Purchase" / TikTok "CompletePayment"
```

* **Code de référence** `E2B-XXXXXX` : ajouté automatiquement à chaque message WhatsApp. En le recherchant dans Supabase ou le CRM, le conseiller retrouve la campagne, l'annonce et l'offre qui ont amené le client.
* **Déduplication** : le pixel navigateur et l'API serveur envoient le même `event_id`.
* **Validation des réservations** : dès qu'un lead passe au statut `reserve`, la conversion est renvoyée à Meta et TikTok avec son montant. Les campagnes peuvent alors s'optimiser sur les vraies ventes.

## Configuration

1. Copier `.env.example` vers `.env.local` en local, ou saisir les variables dans Vercel > Settings > Environment Variables.
2. Exécuter `supabase/leads-table.sql` dans Supabase > SQL Editor. Le script peut être relancé sans risque.
3. Chaque intégration s'active dès que ses variables sont renseignées. Sans elles, le site fonctionne quand même : les leads partent sur WhatsApp et l'absence de configuration est signalée dans les logs.

## URL à mettre dans les publicités

Meta (Ads Manager > Annonce > Paramètres d'URL) :

```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}
```

Pour Instagram, mettre `utm_source=instagram`.

TikTok (Annonce > URL de destination) :

```
https://landingpage-easy2book.vercel.app/omra?utm_source=tiktok&utm_medium=paid&utm_campaign=__CAMPAIGN_NAME__&utm_content=__CID_NAME__&campaign_id=__CAMPAIGN_ID__&ad_id=__CID__
```

Le `fbclid` et le `ttclid` sont ajoutés automatiquement par les régies et sont mémorisés.

Liens partagés sur WhatsApp, en story ou en bio : ajouter `?utm_source=whatsapp&utm_campaign=<nom>` (ou `instagram_bio`, `tiktok_bio`…).

## API pour le CRM

Toutes les routes ci-dessous exigent l'en-tête `x-api-key: <CRM_API_KEY>`.

```bash
# Export des leads (json ou csv), filtres : since, product, status, channel, utm_campaign, niche, limit
curl -H "x-api-key: $CRM_API_KEY" "https://landingpage-easy2book.vercel.app/api/leads?format=csv&since=2026-11-01"

# Valider une réservation (envoie la conversion à Meta + TikTok)
curl -X POST -H "x-api-key: $CRM_API_KEY" -H "content-type: application/json" \
  -d '{"ref":"E2B-7K3QFM","status":"reserve","booking_value":4800}' \
  https://landingpage-easy2book.vercel.app/api/leads/status
```

Statuts : `nouveau` → `contacte` → `qualifie` → `reserve` | `perdu`.

Le webhook `CRM_WEBHOOK_URL` reçoit `{ type: "lead.created" | "lead.updated", data: {...} }`.

## Analyse des niches

Deux vues sont disponibles dans Supabase :

* `campaign_performance` : leads, réservations, taux de conversion et chiffre d'affaires par canal, campagne et produit.
* `niche_performance` : clics WhatsApp, leads et réservations par niche (catégories d'hôtels, destinations, fouj Omra…).

## Développement

```bash
npm install
npm run dev
```
