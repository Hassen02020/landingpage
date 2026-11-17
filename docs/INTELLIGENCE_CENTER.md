# Intelligence Center — Phase 1 (menu + qualité des données)

Décisions du propriétaire (16/11/2026) : cadre « Easy2Book Intelligence OS » (5 moteurs, moteur de décision). **Phase 1 = ossature + gouvernance minimale, sans recommandation automatique.**

## Principes
- On affiche ce que les données permettent de dire, rien de plus : un petit échantillon est signalé (« Données insuffisantes : 2 réservation(s), 5 minimum pour comparer »), jamais masqué.
- Observé, estimé et prévu sont distincts. La Phase 1 n'affiche que de l'**observé**.
- Aucun âge ni sexe déduit d'un nom ou d'une photo. Aucune donnée externe mélangée aux réservations.
- Droits inchangés : vue d'ensemble et qualité des données = `reports.view` (responsables) ; chiffres financiers = `ads.view`. Aucun contenu de lead n'est affiché (comptages seulement).

## Contenu
| Élément | Fichier |
|---|---|
| Menu (définition pure, testée) : groupe « Analyse » renommé « Intelligence », + « Vue d'ensemble » et « Qualité des données » | `lib/admin-nav.ts` |
| Logique pure : `sampleState`, `qualityReport`, `overviewAlerts` | `lib/intelligence.ts` |
| Chargement lecture seule, avec repli selon les colonnes présentes | `lib/server/intelligence.ts` |
| Pages | `app/admin/(crm)/intelligence/page.tsx`, `.../qualite/page.tsx` |
| Composant « données insuffisantes » | `app/admin/(crm)/_components/DataGuard.tsx` |

## Contrôles de qualité (PR A, sans migration)
Leads sans région · Leads Meta sans campagne · Noms de campagne hors convention · Sans consentement de suivi · Non traités depuis plus de 24 h · Réservations sans commission importée (droit `ads.view` seulement ; sinon « non disponible », jamais 0).
Contrôles dépendant de la migration de gouvernance (PR B) : leads de test (exclus), pertes sans motif, réservations sans produit acheté — déclarés **indisponibles** tant que la migration n'est pas appliquée.

## Tests
`tests/intelligence.test.ts`, `tests/intelligence-loader.test.ts` ; menu e2e mis à jour (`tests/e2e/admin-flow.e2e.mjs`).

## PR B — gouvernance des données (migration 0026 ÉCRITE, NON APPLIQUÉE)
| Colonne (`landing_leads`) | Rôle |
|---|---|
| `is_test` booléen, défaut faux | lead de test : exclu des statistiques, entonnoir, rentabilité, WhatsApp, tableau de bord, clients/segments et export ; reste visible (badge « TEST ») dans la liste et la fiche |
| `lost_reason` (9 valeurs) | motif de perte, facultatif ; effacé si le lead quitte « perdu » |
| `purchased_product` (omra / voyage / hotel / autre) | produit réellement acheté, choisi à la réservation (pré-rempli avec le produit demandé) |

- **Droits :** marquer / démarquer un test = `reports.view` (responsables). Motif et produit acheté : tout conseiller qui peut changer le statut du lead.
- **Compatible avant la migration :** `selectRealLeads` (lib/server/lead-scope.ts) lit sans filtre tant que la colonne manque et retente le filtre toutes les minutes ; l'écriture du statut retombe sur l'ancien patch ; la page Qualité des données déclare les contrôles indisponibles.
- **Garde-fou de test :** `tests/data-governance.test.ts` échoue si un nouveau fichier serveur lit `landing_leads` sans passer par `selectRealLeads` (liste d'exceptions justifiée).
- **Fichiers :** `supabase/migrations/0026_data_governance.sql`, `supabase/rollback/0026_rollback.sql` (refusé si des données existent), `supabase/scripts/postcheck-0026.sql` (4 contrôles), `tests/migration-0026.test.ts` (PostgreSQL de test).
- **À faire par le propriétaire, après ses GO distincts :** appliquer la migration (condition de sécurité + contrôle postcheck), puis déployer. Marquer le lead de test existant `d3518f63-b61f-4c47-a4fd-958dab2888bf` = une seule écriture, soumise à un GO séparé.

## Lot 5 — Évènement « lead qualifié » vers Meta
- **Définition (validée par le propriétaire) :** la **première** fois qu'un lead atteint « qualifié » **ou plus loin** (devis, négociation, réservé, gagné), une seule fois par lead ; jamais rejoué si le lead revient en arrière puis est requalifié, ni s'il est perdu puis rouvert.
- **Évènement** : `QualifiedLead` (personnalisé), envoyé côté serveur par `changeStatus`, avec `event_id = qualified-<id du lead>`, **sans valeur monétaire**, téléphone et prénom hachés, **seulement si le visiteur a accepté le suivi**. TikTok non concerné.
- **Jamais depuis le navigateur** : absent de `ALLOWED_EVENTS` (test).
- **En cas de doute** (lecture de l'historique impossible) : rien n'est envoyé. Meta non configuré : statut enregistré, pas de fausse mention « envoyé ».
- Une réservation directe envoie `QualifiedLead` puis `Purchase` (deux évènements distincts).
- **Test sur le pixel :** utiliser `META_TEST_EVENT_CODE` (Meta → Gestionnaire d'évènements → Tester les évènements) avant le premier envoi réel. Aucun évènement artificiel n'a été envoyé pendant le développement.
- Une fois l'évènement reçu par Meta, il apparaît comme évènement personnalisé et peut servir d'objectif d'optimisation (à choisir dans Ads Manager, décision du propriétaire).
