# Cartographie — Easy2Book Customer Growth OS

> Établie par lecture du code réel le 02/11/2026 (branche `claude/exciting-volta-ndkljc`, base `main` = `04de912`).
> Ce document décrit ce qui EXISTE dans le code. Une ligne n'est « certifiée » que si une preuve (test) est citée.

## Matrice module → page → API → table → permission → test

| Module (vision) | Page / écran | API / action serveur | Tables | Permission | Test / preuve |
|---|---|---|---|---|---|
| B — Landing pages | `/` (hub), `/omra`, `/voyages-organises`, `/summer-vibes`, `/c/[slug]` | lecture catalogue (ISR 60 s) | `landing_categories`, `landing_offers` | public (sans coût) | `omra-journey.e2e` 9/9, `catalog.test` |
| D — Collecte CRM | `LeadCaptureForm` (6 pages) | `POST /api/leads` | `landing_leads` | public + origine + débit + captcha + anti-doublon + protection | `leads-route.test`, `consent.e2e` 11/11 |
| A / I — Liens et attribution | `/admin/liens` (générateur, liens de bio des 3 comptes, règles de nommage) ; `/c/omra-2027` → `/omra` | `lib/links.ts`, `lib/channel.ts` (client + serveur) | `landing_leads` (`channel`, `utm_*`, `landing_page`, `form_page`) | équipe | `channel-links.test`, `social.e2e` |
| I — Tracking | bandeau de consentement, pixels après accord | `POST /api/track`, `/api/pixels`, `/api/meta-capi` (ancien alias) | `landing_events` | public (consentement requis pour tout envoi) | `track-route.test`, `meta-tiktok.test`, `consent.e2e` |
| I — Conversions serveur | — | Meta CAPI v21, TikTok Events v1.3 (`lib/server/meta.ts`, `tiktok.ts`) | — | serveur | `meta-tiktok.test` (simulés) ; **jeton Meta invalide en production (code 190)** |
| C — WhatsApp | 38 liens `wa.me` + message prérempli + `Réf: E2B-…` ; « Nouveau lead » avec message collé ; boutons « Message reçu / envoyé » ; Statistiques → WhatsApp | `handleWhatsAppClick` → `Contact` ; `lookupConversation`, `createManualLead`, `logWhatsApp` (`lib/server/whatsapp.ts`) | `landing_events`, `landing_leads` (`visitor_ref`, `source`), `landing_lead_activities` (`wa_in`, `wa_out`) | public (clics) / équipe | `whatsapp.e2e`, `whatsapp.test`, `admin-flow.e2e` ; **aucune API WhatsApp Business ni webhook (bloqué : accès propriétaire)** |
| E — Qualification / pipeline | `/admin` (liste, cartes, actions groupées), `/admin/pipeline`, `/admin/leads/[id]` | `changeStatus`, `addNote`, `setFollowUp`, `assignLead`, `bulkAction` | `landing_leads`, `landing_lead_activities` | équipe active (agent / admin) | `crm.test`, `crm-lot3.test`, `admin-flow.e2e` 67/67 |
| E — Doublons | fiche lead | `findDuplicates`, `markDuplicateAction` | `landing_leads` | équipe | `crm-lot3.test`, `admin-flow.e2e` |
| F — Customer 360 | **absent** (fiche = un lead ; doublons par téléphone seulement) | — | — | — | — |
| G — Segmentation | **absente** | — | — | — | — |
| H — Marketing | consentement marketing enregistré/retirable ; **aucun envoi, aucune audience** | `withdrawMarketing` | `landing_leads.marketing_*` | équipe | `crm.test` |
| J — Fidélité / VIP | **absent** (règles non définies par le propriétaire) | — | — | — | — |
| K — Analytics | `/admin/stats` (Marketing, Équipe, Offres, Niches), `/admin/calculateur` | `lib/server/stats.ts` | `landing_leads`, vues `landing_*_performance` | équipe | `admin-features.test`, `admin-flow.e2e` |
| Catalogue | `/admin/catalogue` (offres, catégories, médias) | `catalog-actions.ts` | `landing_offers`, `landing_categories`, Storage `landing-media` | admin | `catalog.test`, `migration-0003/4`, `admin-flow.e2e` |
| Promotions | `/admin/promos` | `landing_redeem_promo` (atomique) | `landing_promo_codes` | admin | `admin-features.test`, `migration-0003` |
| Protection | `/admin/protection` | `checkLead` dans `/api/leads` | `landing_blocklist`, `landing_protection` | admin | `admin-features.test`, `admin-flow.e2e` |
| Intégrations | `/admin/integrations` | `saveIntegration`, `testIntegration` | `landing_integrations` (jeton chiffré AES-256-GCM), `landing_integration_changes` | admin | `admin-features.test`, `admin-flow.e2e` |
| Équipe | `/admin/equipe`, `/admin/compte`, `/admin/modeles` | `team.ts`, `templates.ts` | `landing_staff`, `landing_admin_log`, `landing_message_templates` | admin (mot de passe : tout membre) | `crm-lot3.test`, `migration-0005`, `admin-flow.e2e` |
| Export | `/admin/export` (admin), `/api/leads/export` (clé API) | `lib/server/export.ts` | `landing_leads` | admin / clé | `admin-export-captcha.test` |

## Frontière EasyV4 (contrainte fondamentale)

- `lib/server/db.ts` refuse les projets `crygnaichvlxavvbifqi` et `fxjhahtqrglktrmgqkvs` ; chaque migration s'arrête si `agencies`, `crm_conversations` ou `reservations` existent. **Non modifié par cette mission.**
- Aucun appel EasyV4 dans le code. La synchronisation des réservations vérifiées (Module J) reste à concevoir comme un **contrat d'échange** (voir ROADMAP, Bloc 8).

## Base de données (landing — projet `tdexdlukqciolslvjmhd`)

| Migration | Contenu | État production |
|---|---|---|
| 0001 | leads, événements, vues | appliquée (31/10) |
| 0002 | équipe, historique, suivi, conservation, droits minimaux de `service_role` | appliquée (01/11) |
| 0003 | intégrations, protection, codes promo | appliquée (01/11) |
| 0004 | catalogue, catégories, stockage médias | appliquée (02/11) |
| 0005 | équipe gérée, modèles WhatsApp, journal admin | appliquée (02/11) |
| 0006 | e-mail, région, canal de contact, page du formulaire, voyageurs facultatifs, effacement à l'anonymisation | **à appliquer par le propriétaire** (préparée dans cette PR) |
| 0007 | pipeline à 10 statuts (à contacter, à qualifier, devis, négociation, gagné), vues et purge mises à jour | **à appliquer par le propriétaire après 0006** (préparée dans cette PR) |

Règles transverses vérifiées sous PGlite : `anon`/`authenticated` sans accès aux tables sensibles ; `service_role` sans DELETE ni TRUNCATE ; historique en ajout seul ; il reste toujours un administrateur actif.

## Environnement et tests

| Contrôle | Résultat (02/11/2026) |
|---|---|
| `tsc --noEmit` | OK |
| Vitest | 19 fichiers, **176/176**, 0 ignoré |
| Build Next 14.2.29 | OK |
| e2e consentement (navigateur réel, site local) | 11/11 |
| e2e parcours Omra | 9/9 (aussi sur la production) |
| e2e admin (faux Supabase en mémoire) | 67/67 — **simulation de la base, pas la vraie** |
| Lint | **non configuré** (`next lint` demande une configuration) |
| CI GitHub Actions | workflow ajouté dans cette PR (pas encore exécuté) |
