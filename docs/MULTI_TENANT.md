# Socle multi-entreprises — MULTI-TENANT-FOUNDATION-01

**Statut : CODE ÉCRIT + TESTÉ (PostgreSQL / PGlite). Non appliqué en production. Non fusionné. Non déployé.**
Décisions du propriétaire (07/11/2026) : dépôt conservé ; sécurité hybride (RLS avec contexte utilisateur pour les entreprises,
`service_role` seulement pour des opérations serveur privilégiées et contrôlées, `organization_id` vérifié côté serveur, tests
négatifs) ; OAuth standard (hors de ce chantier) ; compte propriétaire désigné `Tarhouni.Hassene@gmail.com` (existence et rôle à vérifier
en production avant attribution).

## 1. Ce que livre ce chantier

| Élément | Fichier |
|---|---|
| Migration progressive (organisations, membres, Super Admin, audit, rattachement, RLS) | `supabase/migrations/0008_multitenant_foundation.sql` |
| Retour arrière (refuse dès qu'une 2ᵉ organisation existe) | `supabase/rollback/0008_rollback.sql` |
| Attribution du rôle Super Admin (à exécuter par le propriétaire, jamais automatique) | `supabase/scripts/provision-super-admin.sql` |
| Matrice des rôles Admin / Manager / Employé / Super Admin | `lib/permissions.ts` |
| Contexte d'organisation côté serveur (filtre, contrôle, rôle, repli transitoire) | `lib/server/tenant.ts` |
| Tests : 25 sur PostgreSQL (isolation, rôles, non-régression, rollback…) + 12 unitaires | `tests/migration-0008.test.ts`, `tests/tenant.test.ts` |

## 2. Modèle

- `organizations` (slug unique, statut `active` / `suspended`) ; **Easy2Book = organisation n°1** (`00000000-0000-4000-8000-0000000e2b01`).
- `organization_members` (organisation, utilisateur, rôle `admin` / `manager` / `employee`, actif). Une organisation garde toujours un administrateur actif.
- `platform_admins` : Super Admin de la plateforme. **Aucune écriture par l'API** (ni comptes connectés, ni `service_role`) : le propriétaire de la base l'alimente par le script SQL.
- `organization_audit` : journal en ajout seul (création d'organisation, membres ajoutés / modifiés / retirés, suspension, Super Admin).
- Colonne `organization_id` (NOT NULL, clé étrangère) sur les **13 tables** de l'application. Immuable (sauf opération volontaire du propriétaire : `SET landing.org_move = 'on'`). L'historique d'un lead hérite toujours de l'organisation du lead ; un lead ne peut être confié qu'à un conseiller de la même organisation.

## 3. Qui voit quoi (RLS, comptes connectés)

| Données | Admin | Manager | Employé | Super Admin | Autre entreprise / sans organisation / anonyme |
|---|---|---|---|---|---|
| Leads et historique | tous ceux de **son** organisation | tous ceux de son organisation | **seulement ceux qui lui sont attribués** | **non** | non |
| Événements de navigation | oui | oui | non | non | non |
| Organisation, membres | la sienne | la sienne | sa propre ligne | **toutes** | non |
| Écritures (rôles, membres, organisations, Super Admin) | **aucune par l'API** | aucune | aucune | aucune | aucune |

Une organisation **suspendue** ou un membre **désactivé** perd tout accès immédiatement. Les autres tables (catalogue, codes promo, intégrations, protection,
modèles, journaux) restent réservées au serveur ; leur ouverture par organisation viendra avec les chantiers qui en ont besoin.

> **Changement de comportement à connaître.** Aujourd'hui un « agent » du CRM Easy2Book voit tous les leads (le site lit avec `service_role`, la RLS ne
> s'applique pas). Les nouvelles politiques décrivent la cible du cahier des charges : un employé ne voit que ses leads. Elles ne s'appliqueront au CRM
> que lorsque l'admin lira avec le jeton de l'utilisateur (chantier suivant) : **décision de produit à confirmer avant ce basculement**.

## 4. Stratégie progressive (rien ne casse pendant la transformation)

1. 0008 ajoute `organization_id` avec **Easy2Book comme valeur par défaut TRANSITOIRE** : les lignes existantes sont rattachées sans réécriture ni déclenchement des triggers
   (historique immuable intact) ; le code actuel, qui n'envoie pas `organization_id`, continue d'écrire dans Easy2Book.
2. L'équipe actuelle (`landing_staff`) est recopiée dans `organization_members` ; tant que l'application écrit dans `landing_staff`, un trigger tient les membres à jour
   (un « manager » n'est jamais rétrogradé par cette synchronisation).
3. Le code applicatif de ce chantier (`lib/server/tenant.ts`) se **replie** sur l'équipe actuelle si la table des membres n'existe pas encore : déploiement possible avant ou après la migration.
4. Chantiers suivants : lecture de l'admin avec le jeton utilisateur, filtrage par organisation de toutes les requêtes serveur, unicités par organisation, puis migration « contract » qui supprime les valeurs par défaut.

## 5. Procédure pour le propriétaire (rien n'est exécuté sans vous)

1. **Sauvegarde** : Supabase → Database → Backups (sauvegarde du jour) ; en plus, export de `landing_leads` et `landing_lead_activities` si vous le souhaitez.
2. Vérifier que vous êtes dans le projet des landing pages (`tdexdlukqciolslvjmhd`), jamais EasyV4.
3. SQL Editor → coller et exécuter `0008_multitenant_foundation.sql` (le script s'arrête de lui-même si l'ordre ou la base est mauvais). Attendu : « Success. No rows returned ».
4. Vérification (lecture seule) :
```sql
select
  (select count(*) from organizations)                                          as organisations,        -- 1
  (select count(*) from landing_leads where organization_id is null)            as leads_sans_org,       -- 0 (impossible : NOT NULL)
  (select count(*) from landing_leads)                                          as leads,
  (select count(*) from landing_leads
     where organization_id = '00000000-0000-4000-8000-0000000e2b01')            as leads_easy2book,      -- = leads
  (select count(*) from organization_members)                                   as membres,              -- = équipe actuelle
  (select count(*) from landing_staff)                                          as equipe;
```
5. **Super Admin** : d'abord vérifier que le compte existe : `select id, email from auth.users where lower(email) = lower('Tarhouni.Hassene@gmail.com');`
   Si une ligne apparaît, exécuter `supabase/scripts/provision-super-admin.sql`. Sinon, le script s'arrête sans rien créer (le compte se crée par le parcours normal d'authentification, pas par ce script).

## 6. Retour arrière

`supabase/rollback/0008_rollback.sql` (après sauvegarde) remet exactement l'état 0007 : colonnes, tables, politiques d'origine. **Refusé** dès qu'une deuxième organisation existe.
Prouvé en test : aucun lead perdu, politiques d'origine rétablies, migration rejouable. Le journal d'audit est supprimé avec le reste : l'exporter avant si nécessaire.

## 7. Conditions de réussite de la phase 1 — état

| Condition | État | Preuve |
|---|---|---|
| Organisation Easy2Book créée | **Prouvé en test** (PGlite) ; production : à faire | `migration-0008.test` |
| Données historiques rattachées | **Prouvé en test** : 13 tables, aucune ligne perdue, historique intact | idem |
| Nouvelles entreprises isolées | **Prouvé en test** : lecture, accès direct, historique, événements, membres, équipe | idem + 3 sabotages détectés |
| Accès Super Admin sécurisés | **Prouvé en test** : organisations oui, leads non ; aucune auto-attribution ; script sans création de compte | idem |
| Employés limités à leurs données | **Prouvé en test** (RLS) | idem |
| Tests d'isolation entre deux entreprises | **Réussis** | idem |
| Non-régression du CRM historique | **Réussie** : 309 tests unitaires, e2e inchangés (code applicatif existant non modifié) ; écritures `service_role` sans `organization_id` → Easy2Book | suite complète |
| Sauvegardes et retour arrière documentés | **Documentés et testés** (retour arrière) ; sauvegarde = procédure du propriétaire | §5 et §6 |

## 8. Limites et suite (honnêtement)

- **Appliqué nulle part en production.** Les preuves sont celles de PostgreSQL (PGlite) avec changements de rôle et de jeton ; le faux Supabase des e2e ne peut pas prouver la RLS.
- **L'application n'utilise pas encore le jeton de l'utilisateur** : elle lit toujours avec `service_role`. Le filtrage par organisation de chaque requête serveur est le chantier suivant (`lib/server/tenant.ts` en fournit les briques, testées).
- **Unicités encore globales** (à rendre « par organisation » avec le code qui les utilise) : `landing_integrations(provider)`, codes promo, SKU, slugs de catégories, e-mails d'équipe, `ref` et clé d'idempotence des leads, singleton de protection.
- **Vues de performance** (`landing_campaign_performance`, `landing_niche_performance`) : agrègent encore toutes les organisations pour le serveur (elles respectent la RLS pour un compte connecté, `security_invoker`).
- **`service_role` en lecture seule** sur les nouvelles tables : les écritures serveur (inscription d'une entreprise, invitations) seront accordées au strict nécessaire, par migration dédiée.
- Les valeurs par défaut Easy2Book des colonnes `organization_id` sont **transitoires** : à supprimer avant d'accueillir une deuxième entreprise réelle.
