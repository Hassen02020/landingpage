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

## Lot 4 — Rentabilité par région, ensemble de publicités, annonce et tranche d'âge déclarée
- Nouvelles vues de `/admin/rentabilite/analyse` : **Ensemble de publicités** (`utm_term`, à défaut `adset_id`), **Annonce**, **Région**, **Tranche d'âge (déclarée)** ; les vues Réseau, Campagne, Produit et Niche sont inchangées.
- La dépense d'une campagne est **répartie au prorata des leads** dans ces vues : elle est marquée « estimée » (≈), jamais présentée comme réelle. Les totaux restent exacts.
- **Échantillon** : chaque ligne sous 5 réservations confirmées affiche « échantillon insuffisant : X lead(s), Y réservation(s) confirmée(s) sur 5 minimum ». Aucune ligne n'est « gagnante » sans ce minimum.
- Lecture de repli selon les colonnes présentes (tranche d'âge avant sa migration, région avant 0006) ; les leads de test sont exclus (`selectRealLeads`).
- Correctif : `selectRealLeads` ne conclut « colonne `is_test` absente » que si le message de la base nomme `is_test` ; une autre colonne manquante (ex. tranche d'âge) ne désactive jamais l'exclusion des tests.
- Jeu de données des tests **fictif et déclaré comme tel** ; aucune conclusion commerciale n'est tirée de ces vues tant qu'il n'y a pas de réservations réelles.
