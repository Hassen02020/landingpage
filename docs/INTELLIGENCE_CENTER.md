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
