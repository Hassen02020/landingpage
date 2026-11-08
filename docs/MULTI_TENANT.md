# Socle multi-entreprises — MULTI-TENANT-FOUNDATION-01

**Statut : CODE ÉCRIT + TESTÉ (PostgreSQL / PGlite). Migration 0008 APPLIQUÉE EN PRODUCTION le 07/11/2026 par le propriétaire et vérifiée (voir §9). Code de la PR #12 non fusionné, non déployé.**
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
| Contrôles avant / après l'application (lecture seule) et plan de production | `supabase/scripts/precheck-0008.sql`, `postcheck-0008.sql`, `docs/PLAN_APPLICATION_0008.md` |
| Tests : 29 sur PostgreSQL (isolation, rôles, non-régression, rollback, contrôles) + 12 unitaires | `tests/migration-0008.test.ts`, `tests/tenant.test.ts` |

## 2. Modèle

- `organizations` (slug unique, statut `active` / `suspended`) ; **Easy2Book = organisation n°1** (`00000000-0000-4000-8000-0000000e2b01`).
- `organization_members` (organisation, utilisateur, rôle `admin` / `manager` / `employee`, actif). Une organisation garde toujours un administrateur actif.
- `platform_admins` : Super Admin de la plateforme. **Aucune écriture par l'API** (ni comptes connectés, ni `service_role`) : le propriétaire de la base l'alimente par le script SQL.
- `organization_audit` : journal en ajout seul (création d'organisation, membres ajoutés / modifiés / retirés, suspension, Super Admin).
- Colonne `organization_id` (NOT NULL, clé étrangère) sur les **13 tables** de l'application. Immuable (sauf opération volontaire du propriétaire : `SET landing.org_move = 'on'`). L'historique d'un lead hérite toujours de l'organisation du lead ; un lead ne peut être confié qu'à un conseiller de la même organisation.

## 3. Qui voit quoi (RLS, comptes connectés)

| Données | Admin | Manager | Employé | Super Admin | Autre entreprise / sans organisation / anonyme |
|---|---|---|---|---|---|
| Leads et historique | tous ceux de **son** organisation | tous ceux de son organisation | **les siens + les non affectés** (jamais ceux d'un collègue) | **non** | non |
| Événements de navigation | oui | oui | non | non | non |
| Organisation, membres | la sienne | la sienne | sa propre ligne | **toutes** | non |
| Écritures (rôles, membres, organisations, Super Admin) | **aucune par l'API** | aucune | aucune | aucune | aucune |

Une organisation **suspendue** ou un membre **désactivé** perd tout accès immédiatement. Les autres tables (catalogue, codes promo, intégrations, protection,
modèles, journaux) restent réservées au serveur ; leur ouverture par organisation viendra avec les chantiers qui en ont besoin.

> **Règle confirmée par le propriétaire (07/11/2026).** Un employé voit **ses leads et les leads non encore affectés**, jamais ceux attribués à un collègue
> (sinon un nouveau lead resterait invisible tant qu'il n'y a pas de répartition automatique). Aujourd'hui un « agent » du CRM Easy2Book voit tous les leads
> (le site lit avec `service_role`, la RLS ne s'applique pas) : la nouvelle règle ne s'appliquera au CRM que lorsque l'admin lira avec le jeton de l'utilisateur
> (chantier suivant). Un employé ne peut pas affecter un lead : seuls admin et manager le peuvent.

## 4. Stratégie progressive (rien ne casse pendant la transformation)

1. 0008 ajoute `organization_id` avec **Easy2Book comme valeur par défaut TRANSITOIRE** : les lignes existantes sont rattachées sans réécriture ni déclenchement des triggers
   (historique immuable intact) ; le code actuel, qui n'envoie pas `organization_id`, continue d'écrire dans Easy2Book.
2. L'équipe actuelle (`landing_staff`) est recopiée dans `organization_members` ; tant que l'application écrit dans `landing_staff`, un trigger tient les membres à jour
   (un « manager » n'est jamais rétrogradé par cette synchronisation).
3. Le code applicatif de ce chantier (`lib/server/tenant.ts`) se **replie** sur l'équipe actuelle si la table des membres n'existe pas encore : déploiement possible avant ou après la migration.
4. Chantiers suivants : lecture de l'admin avec le jeton utilisateur, filtrage par organisation de toutes les requêtes serveur, unicités par organisation, puis migration « contract » qui supprime les valeurs par défaut.

## 5. Procédure pour le propriétaire (rien n'est exécuté sans vous)

> Le déroulé complet, avec critères de feu vert, surveillance et conditions de retour arrière : **`docs/PLAN_APPLICATION_0008.md`**.
> Contrôles en lecture seule : `supabase/scripts/precheck-0008.sql` (avant, 10 contrôles + compte propriétaire) et `supabase/scripts/postcheck-0008.sql` (après, 12 contrôles).

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
5. **Super Admin** : le second tableau de `precheck-0008.sql` indique si le compte existe, si son adresse est **confirmée** et s'il n'est pas suspendu. Si oui, exécuter `supabase/scripts/provision-super-admin.sql` (il refuse un compte non confirmé ou suspendu). Sinon, il s'arrête sans rien créer (le compte se crée par le parcours normal d'authentification, pas par ce script).

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
| Non-régression du CRM historique | **Réussie** : 313 tests unitaires, e2e inchangés (code applicatif existant non modifié) ; écritures `service_role` sans `organization_id` → Easy2Book | suite complète |
| Sauvegardes et retour arrière documentés | **Documentés et testés** (retour arrière) ; sauvegarde = procédure du propriétaire | §5 et §6 |

## 8. Limites et suite (honnêtement)

- **Appliqué nulle part en production.** Les preuves sont celles de PostgreSQL (PGlite) avec changements de rôle et de jeton ; le faux Supabase des e2e ne peut pas prouver la RLS.
- **L'application n'utilise pas encore le jeton de l'utilisateur** : elle lit toujours avec `service_role`. Le filtrage par organisation de chaque requête serveur est le chantier suivant (`lib/server/tenant.ts` en fournit les briques, testées).
- **Unicités encore globales** (à rendre « par organisation » avec le code qui les utilise) : `landing_integrations(provider)`, codes promo, SKU, slugs de catégories, e-mails d'équipe, `ref` et clé d'idempotence des leads, singleton de protection.
- **Vues de performance** (`landing_campaign_performance`, `landing_niche_performance`) : agrègent encore toutes les organisations pour le serveur (elles respectent la RLS pour un compte connecté, `security_invoker`).
- **`service_role` en lecture seule** sur les nouvelles tables : les écritures serveur (inscription d'une entreprise, invitations) seront accordées au strict nécessaire, par migration dédiée.
- Les valeurs par défaut Easy2Book des colonnes `organization_id` sont **transitoires** : à supprimer avant d'accueillir une deuxième entreprise réelle.

## 9. Application en production — journal (07/11/2026)

Exécutée **par le propriétaire** (éditeur SQL du projet des landing pages), selon `docs/PLAN_APPLICATION_0008.md`. Claude n'a exécuté aucune étape de production.

| Étape | Résultat |
|---|---|
| Sauvegarde du jour | confirmée par le propriétaire |
| `precheck-0008.sql` | **10 / 10 OK** (0006 et 0007 appliquées, 1 membre d'équipe et 1 administrateur actif, 3 leads, 4 lignes d'historique) |
| Migration `0008_multitenant_foundation.sql` | « Success. No rows returned » (transaction unique) |
| `postcheck-0008.sql` | **12 / 12 OK** : 1 organisation Easy2Book active ; 3 / 3 leads et 4 / 4 historique rattachés ; `organization_id` NOT NULL sur 13 tables ; 1 membre = 1 équipe ; RLS activée et forcée sur les 4 nouvelles tables ; 7 politiques d'isolation, anciennes supprimées ; aucune écriture possible par l'API ; accès anonyme fermé ; 1 administrateur actif |
| Test d'écriture (lead `TEST Claude` sur `/omra`) | lead créé, **rattaché à Easy2Book**, visible dans l'admin ; 4 leads au total ; aucune ligne d'historique dans une autre organisation ; message WhatsApp propre |
| Passage du lead de test en « Perdu » | accepté par l'admin (« Statut enregistré ») : écriture de l'historique fonctionnelle avec le nouveau schéma |

**Non encore fait** : rôle Super Admin (en attente du contrôle du compte `Tarhouni.Hassene@gmail.com` : existence, adresse confirmée, compte non suspendu) ; fusion de la PR #12 et déploiement du code (sans effet visible pour le CRM actuel).
La production tourne toujours avec le code `2ca4fc0` ; seul le schéma de la base a changé, de façon compatible.

## 10. Chantier 02 — cloisonnement par organisation côté serveur (TENANT-APP-SCOPING-02)

**Statut : CODE ÉCRIT + TESTÉ. Non fusionné, non déployé.** Garantie recherchée : *aucun chemin de code ne peut lire ou écrire dans une organisation par hasard* ;
dès qu'une deuxième organisation existe, tout accès sans contexte d'organisation est **refusé** (jamais de lecture au hasard).

**Où :** un seul point, `lib/server/db.ts` (aucun des ~80 appels n'est réécrit). Les 13 tables d'entreprise reçoivent `organization_id=eq.<org>` en lecture / modification,
et `organization_id` à l'insertion ; une valeur d'une autre organisation est refusée avant tout envoi.

| Mode (détecté par une sonde sur `organizations`, cache 30 s) | Comportement |
|---|---|
| **off** : table absente ou vide (avant 0008, après retour arrière) | historique inchangé |
| **single** : une organisation (**production aujourd'hui**) | tout est filtré / rattaché à Easy2Book |
| **multi** : plusieurs organisations | `runWithOrg(orgId, …)` **obligatoire** ; sans contexte → `TenantContextError` ; vues sans `organization_id`, fonctions SQL globales (`landing_redeem_promo`, purge) et **écritures** sur les unicités encore globales (intégrations, codes promo, offres, catégories, équipe, protection) refusées |

Garde-fous de la sonde : une sonde en panne ne retombe **jamais** sur « off » (dernier mode connu conservé, sinon erreur de base) ; une réponse ambiguë est traitée comme « multi » ;
la sonde n'utilise pas `no-store` (sinon les pages statiques à rafraîchissement `/omra` et `/c/[slug]` passent en erreur 500 — défaut trouvé et corrigé pendant le chantier).

**Preuves :**
- `tests/tenant-db.test.ts` (16) : les 3 modes, les 13 tables, insertions (objet, lot, upsert), refus des organisations croisées, contextes simultanés sans mélange, sonde (cache, pannes, ambiguïté, pas de `no-store`) ; **3 sabotages détectés** (filtre retiré, multi sans contexte accepté, sonde en panne → off).
- E2E : le faux Supabase sait jouer la base après 0008 (`FAKE_TENANT=1`) : le parcours admin complet (132 contrôles) passe avec **557 requêtes vers des tables d'entreprise toutes filtrées par organisation**, chaque insertion envoyée par le site portant `organization_id` (et non le seul défaut de la base) ; mode « off » : 128 contrôles ; parcours réseaux → lead : 25 / 25 dans les deux modes.
- Les scripts d'e2e vident le cache de données de Next avant chaque lancement (un test en mode « une organisation » laissait une réponse de sonde périmée au test suivant).

**Effet du déploiement :** la production est déjà en mode « single » : déployer ce code **ajoute le filtre `organization_id` à toutes les requêtes du site**. À vérifier après déploiement (voir §11).

**Limites (chantiers suivants) :**
1. **Le mode multi n'est pas encore exploitable** : aucun point d'entrée (pages admin, actions, routes publiques) n'établit un contexte d'organisation à partir du compte connecté ou du domaine ; en multi, tout est donc refusé (sûr, mais inutilisable). C'est la condition préalable de l'inscription des entreprises.
2. **Lecture de l'admin avec le jeton de l'utilisateur (RLS)** : non faite. La règle « un employé voit ses leads et les non affectés » n'est donc **toujours pas appliquée au CRM** (elle l'est en base, pour les accès par jeton).
3. Unicités par organisation, vues de performance par organisation, fonctions SQL par organisation, suppression des valeurs par défaut Easy2Book.
4. La sonde s'appuie sur le cache de données de Next (30 s) : après un retour arrière de 0008, jusqu'à 30 s de requêtes en erreur sont possibles sur un déploiement en cours.
5. Les e2e ne tournent pas dans la CI (typecheck, tests unitaires et build seulement).

## 11. Vérifications après déploiement du chantier 02 (propriétaire)
1. `/admin` : Leads (les 4 leads), Pipeline, Clients, Segments, Statistiques → Entonnoir, une fiche lead s'ouvrent normalement.
2. Un lead de test sur `/omra` apparaît en « Nouveau » ; le passer en « Perdu » (écriture de l'historique).
3. Pages publiques `/omra`, `/summer-vibes`, `/voyages-organises`, `/c/omra-2027` : 200.
4. Vercel : aucune nouvelle erreur d'exécution. En cas de problème : redéployer le commit précédent (`94a0159`) ; aucune migration à annuler.

## 12. Chantier 03 — contexte d'organisation aux points d'entrée (TENANT-ENTRYPOINTS-03)

**Statut : CODE ÉCRIT + TESTÉ. Non fusionné, non déployé.** Le mode multi-entreprises devient **exploitable en lecture et en écriture sur les leads** :
chaque entreprise se connecte à son espace, ne voit que ses données, et le site public reste celui d'Easy2Book.

**Conception (pourquoi pas de `enterWith`)** : `AsyncLocalStorage.enterWith` peut fuir d'une requête à l'autre sur une connexion persistante ; on n'emploie donc que `run`.
- **Admin (pages, actions, routes avec cookie)** : en mode multi sans contexte explicite, `db.ts` demande l'organisation du **compte connecté** (`lib/server/session-org.ts`) :
  cookie de session → jeton vérifié auprès de Supabase → `organization_members` → organisation **active** (suspendue = refus ; plusieurs organisations actives = refus, pas de choix arbitraire). Mémorisation 30 s par jeton.
  La fiche d'équipe est lue **dans** l'organisation du compte, y compris à la connexion (avant même l'existence du cookie).
- **Public (formulaire, suivi, pixels, scripts à clé d'API, pages `/omra` et `/c/[slug]`)** : `withPublicOrg` pose un contexte **explicite** « site Easy2Book » (slug `easy2book`), qui passe **avant** la session :
  un compte connecté chez une autre entreprise qui visite le site public n'y crée pas de lead dans sa propre organisation.
- **Sans compte et sans contexte : refus.** Les anciens points d'entrée oubliés échouent au lieu de lire au hasard.
- Les recherches d'organisation (sonde, site public) utilisent le cache de données de Next (30 s), jamais `no-store` (pages statiques à rafraîchissement).

**Preuves :**
- Unitaires : `tests/tenant-entry.test.ts` (11) et `tests/tenant.test.ts` (14) : organisation du compte, jeton invalide, compte sans organisation, organisation suspendue, membre désactivé, plusieurs organisations, mémorisation, contexte public prioritaire, schéma d'avant 0008 ; **3 sabotages détectés** (session avant contexte public ; suspendue qui garde l'accès ; fiche d'équipe lue hors organisation).
- **E2E « deux entreprises » (`tests/e2e/multi-tenant.e2e.mjs`, 43 contrôles, navigateur réel)** : Easy2Book et « Bob SARL » dans la même base, chacune avec son administrateur. Chaque administrateur ne voit que ses leads, clients, pipeline, segments, statistiques, équipe, export CSV ;
  l'ouverture directe d'un lead de l'autre entreprise renvoie **404** ; la clé d'API ne modifie pas un lead de l'autre entreprise (404) ; un lead créé par le site public depuis une session « Bob » appartient à **Easy2Book** ;
  leads manuels et changements de statut de Bob restent chez Bob (historique compris) ; **106 requêtes d'entreprise toutes filtrées**, chaque insertion portant `organization_id`. **2 sabotages de l'isolation détectés** (9 et 6 échecs).
- Non-régression : 342 tests unitaires ; e2e admin (single 132, off 128), réseaux (25 / 25 dans les deux modes), WhatsApp, collecte, Omra, consentement.

**Limites (chantiers suivants) :**
1. **Unicités encore globales** : en mode multi, les **écritures** dans `landing_staff`, `landing_integrations`, `landing_promo_codes`, `landing_offers`, `landing_categories`, `landing_protection` sont refusées
   (gestion d'équipe, intégrations, codes promo, catalogue, protection : **inutilisables pour une 2ᵉ entreprise** tant que les unicités ne sont pas par organisation).
2. **Vues agrégées et fonctions SQL globales refusées en mode multi** : statistiques « Niches », performance par campagne, **utilisation d'un code promo** (`landing_redeem_promo`) — un lead soumis avec un code promo n'est pas exploitable en mode multi.
3. **Un seul site public** (celui d'Easy2Book) : pas de domaine ni de site par entreprise (Site Builder) ; la clé d'API de script est celle de la plateforme (Easy2Book).
4. **Pas de sélecteur d'organisation** : un compte rattaché à plusieurs organisations actives est refusé. Pas d'écrans d'administration de la plateforme (création / suspension d'organisation, Super Admin) : c'est l'étape « inscription ».
5. **Lecture de l'admin par jeton utilisateur (RLS)** : toujours non faite ; la règle « un employé voit ses leads et les non affectés » n'est donc pas appliquée par l'application (elle l'est en base pour les accès par jeton).
6. Coût : chaque requête admin résout l'organisation (2 requêtes de plus, plus la vérification du jeton) ; sans mémorisation pour l'instant côté connexion.
7. Les e2e (faux Supabase) ne tournent pas dans la CI.

## 13. Vérifications après déploiement du chantier 03 (propriétaire)
La production est en mode « single » : le code ajoute, à chaque requête admin, la résolution de l'organisation du compte (organisation_members), et, sur les routes publiques, une recherche d'organisation mise en cache 30 s.
1. `/admin` : Leads (4 leads), Pipeline, Clients, Segments, Entonnoir, une fiche lead, **Équipe**, Modèles, Intégrations s'ouvrent normalement.
2. Un lead de test sur `/omra` apparaît en « Nouveau » ; le passer en « Perdu ».
3. Pages publiques `/omra`, `/summer-vibes`, `/voyages-organises`, `/c/omra-2027` : 200 ; aucune nouvelle erreur Vercel.
4. Retour arrière : redéployer le commit précédent (`cb7b6c0`) ; aucune migration à annuler.

