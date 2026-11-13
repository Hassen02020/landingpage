# Créateur de Landing Pages — MVP (branche locale `feat/createur-landing-pages`, non poussée)

**Parcours** : choisir un modèle → renseigner les informations → page générée → personnaliser → formulaire → aperçu réel → publier → lien publicitaire. Entrée du menu : **Catalogue → Créateur de Landing Pages** (`/admin/createur`).

## Ce que le MVP réutilise (aucune migration, aucune nouvelle table)
| Besoin | Réutilisé |
|---|---|
| Une page = une catégorie (publiée sur `/p/<adresse>`) + ses offres | `landing_categories`, `landing_offers` via `saveCategory`, `saveOffer`, `archiveOffer`, `uploadImage` |
| Brouillon | une catégorie **masquée** (`visible = false`) |
| Formulaire et collecte | `LeadCaptureForm` → `/api/leads` (consentements, anti-spam, attribution) |
| Lien publicitaire | `/admin/liens` : `buildLink`, `LINK_SOURCES`, `CopyButton` |
| Isolation entre organisations | contexte d'organisation existant ; **créateur réservé à la plateforme** (voir ci-dessous) |

## Fonctions livrées
1. **10 modèles** : Omra, Omra Ramadan, Voyage organisé, Turquie, Hôtel, Séjour, Promotion spéciale, Circuit touristique, Vacances d'été, Autre produit (`lib/page-builder/themes.ts`). Chaque modèle fixe produit, langue par défaut, champs affichés et champs **obligatoires**.
2. **Informations** : nom, accroche, présentation ; jusqu'à 10 offres (destination, date, nuits, prix, prix barré, places, étiquette, prestations, programme, photo). Rien n'est pré-rempli ni inventé.
3. **Page publique par famille** (`app/p/[slug]/LandingView.tsx`, route `/p/<adresse>`) : Omra (vert), Voyage (bleu), Hôtel (turquoise), Offre (violet), chacune avec **sa structure de sections** ; une section n'apparaît que si des données réelles existent (points forts, prestations, programme, galerie, FAQ de processus). Français et arabe (RTL).
4. **Formulaire** : le système existant, adapté à la famille (voyageurs), avec consentements séparés.
5. **Aperçu réel** : la vraie page dans un cadre mobile ou ordinateur (`/admin/createur-rendu/<id>`), boutons et formulaire inertes ; **vérifications** bloquantes / conseillées (`lib/page-builder/readiness.ts`).
6. **Publication contrôlée côté serveur** : refusée si la page est incomplète ; adresse publique stable affichée ; masquage possible.
7. **Protection de l'adresse** (`lib/catalog-slug.ts`) : verrouillée si la page est publiée, si l'adresse est réservée (`omra-2027`), si des visiteurs ou prospects y sont déjà passés, ou si la vérification est impossible. Le contenu reste modifiable.
8. **Bloc « Lien publicitaire »** : état de la page (`lib/page-status.ts`), **vérification HTTP réelle** (`lib/server/link-check.ts`), réseaux Facebook, Instagram, TikTok, WhatsApp et **Google Ads statique**, nom de campagne proposé, convention de nommage, bouton Copier, bouton Tester. Aucun lien « prêt » si la page est masquée, sans offre valide, expirée ou ne répond pas.

## Réservé à Easy2Book (décision du propriétaire)
Les pages `/p/<adresse>` (comme `/c/<adresse>`) ne sont servies que pour Easy2Book. Le créateur refuse donc, **côté serveur**, toute autre entreprise (message clair) : il ne produit jamais un lien qui envoie un visiteur vers la page ou le CRM d'une autre entreprise. **Aucune ouverture aux autres entreprises avant correction et certification multi-tenant** (défauts : `docs/CREATEUR_CHANTIERS_1_2.md`).

## Non terminé — nécessite une décision (migration)
Sans migration, la base ne peut pas enregistrer : le **thème choisi** (la famille visuelle est déduite du produit), les **couleurs**, l'**ordre / l'activation des sections**, la **galerie libre**, la **FAQ et les conditions personnalisées**, la liste « non inclus », les **champs de formulaire par page**, le **numéro WhatsApp par page**, la langue **anglaise** (contrainte `lang IN ('fr','ar')`) et un drapeau « déjà publiée un jour » (verrou d'adresse absolu).
**Alternative sans migration (implémentée)** : famille déduite du produit, modèles = préréglages de création, sections pilotées par les données, FAQ générique de processus, verrou d'adresse fondé sur la visibilité et l'usage.
**Migration proposée (NON créée, NON appliquée)** — additive et sans effet sur l'existant :
```sql
-- texte de proposition uniquement
ALTER TABLE public.landing_categories
  ADD COLUMN page_design JSONB CHECK (page_design IS NULL OR (jsonb_typeof(page_design) = 'object' AND octet_length(page_design::text) <= 20000)),
  ADD COLUMN first_published_at TIMESTAMPTZ;
-- + extension de la contrainte lang à 'en' ; + déclencheur interdisant de changer l'adresse si first_published_at n'est pas nul
```
Précaution : le code ne doit lire ces colonnes qu'après application (sinon erreur sur toutes les pages `/c/…`).

## Pages `/c/…` existantes : AUCUN changement de rendu
Décision du propriétaire : aucune modification des pages `/c/…` avant l'inventaire de production (`docs/INVENTAIRE_PAGES_C.md`, **à exécuter par vous, lecture seule — non exécuté**). Les pages du Créateur sont donc servies sur une route distincte, `/p/<adresse>` ; `/c/<adresse>` garde son rendu historique (`CategoryView.tsx` identique à `main`, empreinte vérifiée par `tests/c-pages-unchanged.test.ts`). Une même catégorie reste lisible sur `/c/<adresse>` (aspect historique) et `/p/<adresse>` (aspect par famille) ; les deux sont exclues des moteurs de recherche. `/omra`, `/c/omra-2027` et `/p/omra-2027` (→ `/omra`) : une seule adresse officielle.

## Décisions du propriétaire intégrées
Pas de migration · offres expirées : affichage public inchangé · créateur réservé à Easy2Book · nommage : avertissement sans casser les tirets bas (aucun lien modifié) · entreprise inconnue ou suspendue : 404 neutre · pages `/c/…` : inventaire avant toute modification · Google Ads statique, ni `gclid` ni rentabilité.

## Tests
`tests/page-builder.test.ts`, `page-builder-server.test.ts`, `category-view.test.ts`, `link-check.test.ts`, `links-inventory.test.ts` ; e2e : `tests/e2e/creator.e2e.mjs` (via `run-creator.sh`), `multi-links.e2e.mjs`, `fallback*.e2e.mjs`. Les essais utilisent un faux Supabase : **ils ne prouvent rien sur la production** ; la vérification HTTP y vise le serveur local (`LANDING_LINK_CHECK_ORIGIN`, variable facultative, non requise en production).
