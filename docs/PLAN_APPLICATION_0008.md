# Plan d'application de la migration 0008 en production

**Statut : PLAN — rien n'est exécuté.** Chaque étape de production est faite **par le propriétaire** (éditeur SQL du projet Supabase des
landing pages, `tdexdlukqciolslvjmhd`, jamais EasyV4). Claude lit les résultats que le propriétaire colle et dit « on continue » ou « on s'arrête ».

## 0. Pourquoi l'ordre est sans risque
- Le site actuellement en production (commit `2ca4fc0`) **ignore** les nouvelles colonnes : il fonctionne identiquement avant et après 0008.
- Le code de la PR #12 (`lib/permissions.ts`, `lib/server/tenant.ts`) n'est pas utilisé par le CRM actuel et se **replie** sur l'équipe actuelle si la migration n'est pas appliquée.
- Donc : **la migration d'abord, le code ensuite** (ou même jamais tant que vous le décidez). Aucun déploiement n'est nécessaire pour appliquer 0008.
- 0008 s'exécute en **une seule transaction** : si une instruction échoue, **rien** n'est appliqué.

## 1. Feu vert (tous les critères, sinon on ne commence pas)
| # | Critère | Qui |
|---|---|---|
| 1 | PR #12 relue ; CI verte | propriétaire / Claude |
| 2 | Règle de visibilité des employés confirmée (07/11/2026 : leurs leads + les non affectés ; **remplacée le 08/11/2026 par : tous les leads de leur entreprise**, migration 0009) | propriétaire |
| 3 | Sauvegarde faite et vérifiée (§2) | propriétaire |
| 4 | Contrôle `precheck-0008.sql` : **10 lignes OK** | propriétaire → Claude relit |
| 5 | Compte `Tarhouni.Hassene@gmail.com` : existe, **adresse confirmée**, non suspendu (2ᵉ tableau du contrôle) | propriétaire → Claude relit |
| 6 | Créneau calme (ex. nuit, heure de Tunis) ; ~15 minutes disponibles | propriétaire |

## 2. Sauvegarde (avant tout)
1. **Supabase → Database → Backups** : vérifier qu'une sauvegarde récente existe (selon l'offre : sauvegardes quotidiennes ou restauration à la minute). Noter la date et l'heure.
2. **Si aucune sauvegarde n'est disponible**, faire une copie dans un **schéma privé** (jamais dans `public` : les copies y seraient exposées à l'API) :
```sql
create schema backup_0008;
revoke all on schema backup_0008 from public, anon, authenticated, service_role;
create table backup_0008.landing_leads           as select * from public.landing_leads;
create table backup_0008.landing_lead_activities as select * from public.landing_lead_activities;
create table backup_0008.landing_staff           as select * from public.landing_staff;
select (select count(*) from backup_0008.landing_leads) as leads, (select count(*) from public.landing_leads) as leads_source;
```
   La copie contient des données personnelles : **à supprimer** (`drop schema backup_0008 cascade;`) une fois la migration validée (≥ 7 jours).

## 3. Déroulé
| Étape | Action | Résultat attendu | Si autre chose |
|---|---|---|---|
| 1 | Exécuter `supabase/scripts/precheck-0008.sql` | 10 lignes **OK** ; compte propriétaire : `email_confirme = true`, `suspendu = false` | **STOP** : coller le résultat à Claude, ne rien appliquer |
| 2 | Exécuter `supabase/migrations/0008_multitenant_foundation.sql` (coller tout le fichier, une seule fois) | « Success. No rows returned » | Erreur : **rien n'est appliqué** (transaction) ; copier l'erreur telle quelle |
| 3 | Exécuter `supabase/scripts/postcheck-0008.sql` | 12 lignes **OK** | Un ÉCHEC : ne pas continuer, coller le résultat |
| 4 | Test CRM : se connecter à `/admin`, ouvrir Leads, Pipeline, Clients, une fiche lead | écrans habituels, mêmes données | Problème : voir §5 |
| 5 | Test d'écriture : envoyer un lead de test (`TEST Claude`) sur `/omra`, puis `select organization_id, status from landing_leads order by created_at desc limit 1;` | `00000000-0000-4000-8000-0000000e2b01` et `nouveau`, lead visible dans l'admin | Problème : voir §5 |
| 6 | Passer le lead de test en « Perdu » | — | — |
| 7 | **Super Admin (seulement si le critère 5 est vrai)** : exécuter `supabase/scripts/provision-super-admin.sql` | message `Super Admin : compte … enregistré` ; `select count(*) from platform_admins;` = 1 | « aucun compte CONFIRMÉ et actif » : rien créé, le compte se crée/confirme par le parcours d'authentification normal, puis on relance |

## 4. Surveillance (24 h)
- Vercel : erreurs d'exécution du projet (aucune nouvelle attendue). Claude peut les lire.
- Nouveaux leads : ils continuent d'arriver (formulaire, WhatsApp) et portent l'organisation Easy2Book.
- Supabase → Logs : pas d'erreur répétée sur `landing_leads` / `landing_staff`.

## 5. Quand revenir en arrière
**Critères** : un contrôle post-migration en ÉCHEC non expliqué ; l'admin ne charge plus les leads ; un nouveau lead n'est plus enregistré ; une erreur répétée dans les journaux.
**Procédure** : exécuter `supabase/rollback/0008_rollback.sql` (une seule organisation requise, sinon refusé), puis `precheck-0008.sql` : retour à l'état 0007 (10 OK). Aucun lead perdu (prouvé en test). Le journal d'audit et la table des Super Admin sont supprimés avec le reste : exporter avant si utile.
**Restauration complète** (dernier recours, perte des données postérieures à la sauvegarde) : uniquement sur décision du propriétaire, via la sauvegarde du §2.

## 6. À ne pas faire
- Ne pas modifier le contenu de 0008 ; ne pas l'exécuter deux fois (le script s'arrête de lui-même) ; ne jamais l'exécuter dans EasyV4.
- Ne pas ajouter d'organisations ni d'utilisateurs par SQL « à la main » avant les chantiers prévus.
- Ne pas désactiver la RLS ni accorder de droits d'écriture aux rôles `anon`, `authenticated` ou `service_role` sur les nouvelles tables.
- Vérifier dans Supabase → Authentication que **l'inscription publique n'est pas ouverte** sans confirmation d'adresse (sinon n'importe qui peut créer un compte). Le script Super Admin refuse déjà les adresses non confirmées.

## 7. Après l'application (autres chantiers, chacun avec son GO)
1. Fusion de la PR #12 et déploiement du code (sans effet visible : le CRM n'utilise pas encore les nouveautés).
2. Chantier suivant : l'admin lit avec le jeton de l'utilisateur, filtrage par organisation de toutes les requêtes serveur, unicités par organisation, puis suppression des valeurs par défaut Easy2Book.
3. Inscription des entreprises, formulaires adaptatifs, etc. (ordre décidé le 07/11/2026).

## 8. Ce que Claude ne fait pas
Claude n'exécute **aucune** étape de production (migration, script, variable, déploiement) : il prépare, lit les résultats collés, audite et conseille. Sa lecture directe de la base de production n'est pas autorisée ; la vérification du compte propriétaire passe donc par le contrôle ci-dessus, exécuté par le propriétaire.
