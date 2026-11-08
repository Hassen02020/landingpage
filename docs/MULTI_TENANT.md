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
| Leads et historique | tous ceux de **son** organisation | tous ceux de son organisation | **tous ceux de son organisation** (règle du 08/11/2026, migration 0009) | **non** | **jamais** |
| Événements de navigation | oui | oui | non | non | non |
| Organisation, membres | la sienne | la sienne | sa propre ligne | **toutes** | non |
| Écritures (rôles, membres, organisations, Super Admin) | **aucune par l'API** | aucune | aucune | aucune | aucune |

Une organisation **suspendue** ou un membre **désactivé** perd tout accès immédiatement. Les autres tables (catalogue, codes promo, intégrations, protection,
modèles, journaux) restent réservées au serveur ; leur ouverture par organisation viendra avec les chantiers qui en ont besoin.

> **RÈGLE DU PROPRIÉTAIRE (08/11/2026, remplace celle du 07/11).** **Tous les employés voient tous les leads de LEUR entreprise ; aucun employé ne voit les leads d'une autre entreprise.**
> Elle est inscrite en base par la **migration 0009** (leads et historique) : la 0008 appliquée en production limitait l'employé à ses leads et aux non affectés, mais seulement pour les accès par jeton,
> que l'application n'utilise pas encore. Le CRM actuel (lecture par le serveur, filtrée par organisation) montre **déjà** tous les leads d'Easy2Book à ses employés.
> L'employé reste en **lecture seule par l'API**, ne voit pas les événements de navigation (admin et manager seulement) et ne peut pas affecter un lead (admin et manager). Preuves : `tests/migration-0009.test.ts` et `tests/e2e/multi-tenant.e2e.mjs`.

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
2. **Lecture de l'admin avec le jeton de l'utilisateur (RLS)** : non faite. La règle des employés (tous les leads de leur entreprise) est appliquée par le serveur (filtre d'organisation) et, pour les accès par jeton, par la migration 0009.
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
5. **Lecture de l'admin par jeton utilisateur (RLS)** : toujours non faite ; la règle des employés est appliquée par le filtre d'organisation du serveur ; la RLS ne s'y substitue pas encore (défense en profondeur seulement).
6. Coût : chaque requête admin résout l'organisation (2 requêtes de plus, plus la vérification du jeton) ; sans mémorisation pour l'instant côté connexion.
7. Les e2e (faux Supabase) ne tournent pas dans la CI.

## 13. Vérifications après déploiement du chantier 03 (propriétaire)
La production est en mode « single » : le code ajoute, à chaque requête admin, la résolution de l'organisation du compte (organisation_members), et, sur les routes publiques, une recherche d'organisation mise en cache 30 s.
1. `/admin` : Leads (4 leads), Pipeline, Clients, Segments, Entonnoir, une fiche lead, **Équipe**, Modèles, Intégrations s'ouvrent normalement.
2. Un lead de test sur `/omra` apparaît en « Nouveau » ; le passer en « Perdu ».
3. Pages publiques `/omra`, `/summer-vibes`, `/voyages-organises`, `/c/omra-2027` : 200 ; aucune nouvelle erreur Vercel.
4. Retour arrière : redéployer le commit précédent (`cb7b6c0`) ; aucune migration à annuler.

## 14. Migration 0009 — règle des employés (08/11/2026) : `0009_employees_see_org_leads.sql`

**Statut : CODE ÉCRIT + TESTÉ (PostgreSQL). NON appliquée en production** (action du propriétaire, après décision de fusion de la PR). Sans effet visible sur le CRM actuel : le site lit avec le serveur, pas avec le jeton de l'utilisateur.
Elle aligne la base sur la règle du propriétaire : employés, admin, manager d'une organisation voient **tous** les leads et l'historique de **leur** organisation, **jamais** ceux d'une autre. Deux politiques seulement sont remplacées (leads, historique) ; aucune donnée, aucun droit n'est modifié.

**Preuves** (`tests/migration-0009.test.ts`, 10 tests, rôles et jetons réels) : avant 0009 l'employé voit moins que son entreprise (état de la production) ; après, chaque employé voit tous les leads de son entreprise (les siens, ceux d'un collègue, les non affectés) et **aucun** lead de l'autre ;
historique idem ; admin et manager inchangés ; sans organisation / membre désactivé / organisation suspendue / anonyme : rien ; lecture seule ; événements de navigation toujours réservés aux admin et manager ; retour arrière rejouable sans toucher une donnée ; **3 sabotages détectés** (politique ouverte à tout compte, historique non corrigé, événements ouverts aux employés).
E2E : un employé d'Easy2Book voit tous les leads d'Easy2Book, aucun de Bob SARL, 404 sur un lead de Bob, export CSV refusé (403).

**Procédure (propriétaire, quand vous déciderez ; ~2 minutes, réversible, sans sauvegarde nécessaire car aucune donnée n'est touchée) :**
1. SQL Editor → coller et exécuter `supabase/migrations/0009_employees_see_org_leads.sql` (une seule fois). Attendu : « Success. No rows returned ».
2. Exécuter `supabase/scripts/postcheck-0009.sql` : **5 lignes OK**.
3. Retour arrière si besoin : `supabase/rollback/0009_rollback.sql` (rétablit la règle de 0008, aucune donnée touchée).


## 15. Chantier 04 — unicités par organisation (TENANT-UNIQUENESS-04)

**Statut : CODE ÉCRIT + TESTÉ (PostgreSQL réel via PGlite, faux Supabase de bout en bout). Migrations 0010 et 0011 NON appliquées en production** (action du propriétaire, après décision de fusion de la PR).

**Problème.** Avec une seule entreprise, des clés uniques globales suffisent. Dès qu'une 2ᵉ entreprise existe, elles bloquent ses écritures : deux entreprises ne peuvent pas avoir le même code promo, la même catégorie, le même SKU, le même numéro bloqué, la même clé d'idempotence, ni chacune sa ligne « intégration Meta » ou « protection ».

**Solution — « élargir puis resserrer »** (jamais de moment où la base accepte des doublons à tort ou refuse un cas légitime) :
- `0010_per_org_uniqueness_expand.sql` : ajoute les index uniques **par organisation** (leads : idempotence, téléphone/produit/jour ; événements ; intégrations ; blocklist ; protection ; codes promo ; catégories ; offres), la fonction `landing_redeem_promo(code, produit, organisation)` (réservée au `service_role`), les vues statistiques avec `organization_id`, et un **verrou** : tant que 0011 n'est pas appliquée, la base **refuse de créer une 2ᵉ organisation**. Les anciennes contraintes globales restent : aucun comportement actuel ne change.
- `0011_per_org_uniqueness_contract.sql` : retire les contraintes globales, remplace les clés primaires `landing_integrations(provider)` et `landing_protection(id)` par `(organization_id, …)`, supprime l'ancienne fonction promo et les valeurs par défaut `organization_id` (une insertion sans organisation est désormais refusée). Exige 0010. Refusable en retour arrière s'il existe plusieurs organisations.
- Retours arrière : `supabase/rollback/0010_rollback.sql`, `0011_rollback.sql` (refusés si cela corromprait des données). Contrôles en lecture seule : `supabase/scripts/postcheck-0010.sql` (7), `postcheck-0011.sql` (7).
- Reste volontairement **global** : `landing_leads.ref` (référence WhatsApp lisible par le client) et l'e-mail du personnel.

**Code (aucune fuite entre entreprises).**
- `lib/server/db.ts` : les écritures `upsert` portent l'organisation dans `on_conflict` ; la fonction promo reçoit `p_org` ; les vues sont filtrées par organisation en mode multi ; la purge RGPD globale est refusée en mode multi.
- Trois fuites supplémentaires trouvées et corrigées pendant ce chantier : **cache des intégrations** et **cache de protection** étaient partagés entre entreprises (désormais clés `organisation:fournisseur`) ; **le jeton et le pixel Meta/TikTok des variables Vercel** (ceux d'Easy2Book) étaient proposés à toute organisation sans réglage (désormais réservés à l'organisation de la plateforme, `isPlatformOrg()`) ; les clés anti-doublon en mémoire (`/api/leads`, `/api/track`) incluent maintenant l'organisation.

**Preuves.** `tests/migration-0010.test.ts` (18, dont 4 sabotages détectés), `tests/tenant-caches.test.ts` (4, 3 sabotages détectés), `tests/tenant-db.test.ts` (mis à jour, 3 sabotages détectés) ; e2e `multi-tenant` : 58 contrôles dont Bob SARL crée le même code promo `RAMADAN27`, bloque le même numéro, voit sa propre vue Niches et aucune donnée d'Easy2Book ; les doublons **dans** une même organisation restent refusés.

**Ordre d'application obligatoire (propriétaire, après fusion — rien ne doit être fait avant votre GO) :**
1. Sauvegarde du jour. 2. Exécuter `0010` puis `postcheck-0010.sql`. 3. Déployer le code de cette PR (le code et 0010 sont compatibles dans les deux sens). 4. **Seulement avant de créer une 2ᵉ organisation** : `0011` puis `postcheck-0011.sql`.
Le code de cette PR **ne doit pas** être déployé avant 0010 (il envoie `p_org` et des `on_conflict` par organisation, que seule 0010 fournit).

## 16. Chantier 05 (partie A) — création d'une entreprise et de son premier administrateur

**Statut : CODE ÉCRIT + TESTÉ (PostgreSQL réel, e2e à trois entreprises). Migration 0012 NON appliquée en production.** Les formulaires adaptatifs (partie B du chantier 05) ne sont **pas** dans cette PR : voir « Reste à faire ».

**Ce qui existe.**
- **Espace plateforme `/admin/plateforme`** : réservé au Super Admin (jeton vérifié auprès de Supabase puis présence dans `platform_admins`). Liste des entreprises (membres, administrateurs, statut), création, suspension / réactivation. Aucun lead n'y apparaît, nulle part : le Super Admin n'a toujours aucune fiche d'équipe, donc aucun accès au CRM d'une entreprise.
- **Connexion** : un Super Admin sans fiche d'équipe arrive sur `/admin/plateforme` ; un administrateur d'entreprise qui tape `/admin/plateforme` est renvoyé à la connexion.
- **Création** (`lib/server/platform.ts`) : validation (nom, identifiant, e-mail, identifiants réservés) → identifiant libre ? → **invitation par e-mail** du premier administrateur (Supabase Auth) → fonction SQL `landing_create_organization` (migration 0012) qui crée **en une seule transaction** l'organisation, la fiche d'équipe administrateur (le membre suit par le déclencheur de 0008) et la trace d'audit. Aucun mot de passe ne passe par le serveur ni par vous.
- **Acceptation** `/admin/invitation` : le jeton d'invitation est lu dans le fragment d'URL (jamais dans les journaux), vérifié auprès de Supabase ; l'invité choisit son mot de passe (10 caractères minimum) puis se connecte.
- **Migration 0012** : deux fonctions SQL, exécutables par `service_role` uniquement (ni anon, ni authenticated, ni PUBLIC), qui vérifient que l'acteur est dans `platform_admins` ; `service_role` n'obtient **aucun** droit d'écriture direct sur les tables d'organisation. L'organisation de la plateforme (`easy2book`) ne peut pas être suspendue. Un compte appartient à **une seule** entreprise.
- **Retour arrière** `supabase/rollback/0012_rollback.sql` (retire les fonctions, ne touche aucune organisation créée) ; **contrôle** `supabase/scripts/postcheck-0012.sql` (4 lignes OK).

**Preuves.** `tests/migration-0012.test.ts` (9, rôles réels : création atomique, refus d'un non Super Admin, compte inconnu ou déjà rattaché, identifiant en double sans résidu, verrou de 0010 avant 0011, anon/authenticated refusés, l'administrateur créé ne lit que SES leads, suspension tracée et plateforme protégée, retour arrière) ; `tests/platform.test.ts` (10, dont l'ordre invitation → création et l'absence de mot de passe) ; e2e `multi-tenant` : **82 contrôles** (dont 24 nouveaux : connexion Super Admin, aucun accès aux leads via `/admin`, fiche d'un lead, clients, export, création, invitation émise, acceptation, jeton invalide refusé, CRM vide de la nouvelle entreprise, 404 sur un lead d'Easy2Book, même code promo `RAMADAN27` accepté, espace plateforme fermé aux administrateurs d'entreprise, suspension et réactivation). **Sabotage** : si l'espace plateforme acceptait tout compte connecté, 2 contrôles e2e échouent.

**À régler côté Supabase par le propriétaire AVANT la première création réelle :**
1. Authentication → URL Configuration → *Redirect URLs* : ajouter `https://landingpage-easy2book.vercel.app/admin/invitation` (sinon le lien de l'e-mail est refusé).
2. Authentication → SMTP : configurer un expéditeur propre (l'envoi par défaut de Supabase est très limité et marqué comme test).
3. Appliquer **0011** (verrou de 0010 contre une 2ᵉ organisation) puis **0012**, dans cet ordre, après sauvegarde.

**Reste à faire (partie B, chantier 05) :** formulaires adaptatifs par entreprise (champs, produits, obligatoires), qui supposent une page publique par entreprise (chantier 07, constructeur de site) ; sans elle, une 2ᵉ entreprise n'a pas encore de formulaire public. **Limites actuelles :** une seule entreprise publique (Easy2Book) ; un compte = une entreprise ; pas de sélecteur d'organisation ; le Super Admin ne peut pas encore changer l'administrateur d'une entreprise.

**Audit de la PR 16 (08/11/2026) — deux défauts trouvés et corrigés avant validation.**
1. *Un compte Super Admin pouvait être rattaché comme administrateur d'une entreprise* (et donc lire ses leads, contre la règle). La fonction 0012 le refuse ; test PostgreSQL et test e2e.
2. *Les messages d'erreur précis de la base n'arrivaient pas à l'écran* : `DbError` ne portait pas le texte PostgreSQL (verrou 0011, compte déjà rattaché…), l'écran aurait affiché un message générique. `DbError.pgMessage` (texte de nos propres fonctions, jamais dans les journaux) ; 5 tests.
Points relevés, non bloquants : un échec entre l'invitation et la création laisse un compte invité sans entreprise (sans accès ; une nouvelle tentative le réutilise) ; les erreurs de suspension / réactivation ne sont pas affichées à l'écran ; l'envoi d'e-mails dépend du SMTP (voir `docs/PLAN_ONBOARDING_PROD.md`).

## 17. Chantier 06 — rôles et permissions (Super Admin, Administrateur, Manager, Employé)

**Statut : CODE ÉCRIT + TESTÉ (PostgreSQL réel, e2e à trois entreprises). Migration 0013 NON appliquée en production.**

**Constat d'audit.** La matrice des rôles (`lib/permissions.ts`, chantier 01) n'était appliquée **nulle part** : toutes les pages et actions décidaient avec l'ancien couple `admin` / `agent`, et le rôle Manager n'existait pas dans l'équipe. Désormais **chaque page, action et le menu décident par permission** (`can(orgRole, permission)`).

**Décisions du propriétaire (08/11/2026).** (1) Un employé voit tous les leads de son entreprise (déjà appliqué, migration 0009) et **modifie ses leads et les leads non affectés**, jamais ceux affectés à un collègue. (2) Le rôle **Manager** est créé maintenant.

| Droit | Employé | Manager | Administrateur | Super Admin |
|---|---|---|---|---|
| Voir tous les leads de son entreprise | oui | oui | oui | **jamais** |
| Modifier statut, notes, relance, vente | ses leads + non affectés | tous | tous | non |
| Affecter un lead | prendre un lead libre, rendre le sien | à n'importe qui | à n'importe qui | non |
| Statistiques, pipeline, clients, segments | oui | oui | oui | non |
| Voir l'équipe | non | oui | oui | non |
| Ajouter, désactiver, changer un rôle | non | non | oui | non |
| Offres/catégories, codes promo, protection, intégrations, modèles WhatsApp, export CSV | non | non | oui | non |
| Créer / suspendre une entreprise | non | non | non | oui |

**Migration 0013** : `landing_staff.role` accepte `manager` ; la recopie vers `organization_members` traduit admin → admin, manager → manager, agent → employee ; « il reste toujours un administrateur » inchangé. Retour arrière `supabase/rollback/0013_rollback.sql` (refusé tant qu'un manager existe) ; contrôle `supabase/scripts/postcheck-0013.sql` (2 OK).

**Preuves.** `tests/migration-0013.test.ts` (7, dont sabotage) ; `tests/roles.test.ts` (18 : matrice, qui modifie, qui affecte) ; e2e `multi-tenant` : **109 contrôles** dont 26 pour les rôles (employé : menu réduit, lead d'un collègue refusé en statut et en affectation, ses leads et les non affectés acceptés, 6 pages fermées, export 403 ; manager : équipe en lecture seule, 5 pages fermées, export 403, modifie et réaffecte les leads d'un collègue ; administrateur : ajout et changement de rôle). **Sabotage** : sans la protection des leads d'un collègue dans l'action, 2 contrôles e2e échouent.

**Limites.** L'application des droits est faite côté serveur ; la base (RLS) laisse encore tous les rôles de l'entreprise lire tous les leads (c'est voulu) mais ne distingue pas encore qui peut modifier quoi, puisque le site écrit avec le serveur. Les statistiques restent visibles par tous les rôles (comme avant). Un Manager est créé depuis l'écran Équipe par un administrateur.
