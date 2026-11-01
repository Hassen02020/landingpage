# active-memory handoff: Easy2Book — landing pages Meta/TikTok/WhatsApp + mini-CRM autonome

**Handoff #1** · 2026-10-31 · Lineage: #1 (2026-10-31): landing pages connectées Meta/TikTok/WhatsApp, séparation totale d'EasyV4, base Supabase dédiée, mini-CRM /admin, audits successifs ; 6 corrections de sécurité de 0002 faites (commit « fix(sécurité): 0002 … »), 0002 toujours non appliquée

## 0. Instructions for Claude (read first)

You are continuing work from a previous chat. That chat is gone; this file is the complete context and the source of truth.

1. Read this whole file before replying.
2. Follow sections 3 (Style), 4 (Hard rules) and 5 (Corrections) in every reply, for the rest of this chat. They override your defaults.
3. Use the values in section 8 exactly. Never round, re-estimate, or "correct" them.
4. Do not suggest anything listed in section 7 (Changed / rejected) again unless the user brings it up.
5. Code word: None active. If the user types /amcodeword, start every reply with the phrase they choose (default "Yes Boss!").
6. Your first reply: at most 5 lines covering the goal, the current state, and the next step (section 11). Mention any files from section 13 that were not attached. Ask the questions in section 12 if there are any. End with "Ready to continue with <next step>?" Then wait for the user's go.

## 1. Mission
- **Goal:** landing pages Easy2Book (voyages organisés, Omra, promos hôtels) qui reçoivent le trafic des campagnes Meta / TikTok, orientent vers WhatsApp, enregistrent les leads dans un mini-CRM autonome (Supabase dédié) pour valider les réservations, tester les niches et servir de source complémentaire.
- **Done looks like:** PR #2 certifiée « prête pour la production » avec preuves techniques (tests réels sur Supabase, P0/P1 fermés), puis fusion uniquement sur GO explicite du décisionnaire.
- **Why it matters / context:** les leads de campagnes doivent être captés, attribués (UTM, Meta, TikTok) et suivis jusqu'à la réservation.

## 2. About the user (as relevant to this work)
- Hassen Tarhouni (« Décisionnaire : Hassen Tarhouni »), Easy2Book (agence de voyage, Tunisie). Écrit en français, parfois de façon abrégée ; colle souvent des extraits des tableaux de bord Supabase/Vercel.
- Pilote par missions nommées (ex. `LANDING-INDEPENDENT-CRM-AUDIT-01`, `LANDING-CONNECTION-01`, `LANDING-CRM-PRODUCTION-READINESS-01`) avec phases OBSERVE → AUDIT → GAP → PROPOSE et des GO explicites.
- Possède aussi le CRM EasyV4 (dépôt `Hassen02020/EasyV4`, Supabase EasyV4) : **hors périmètre, ne pas toucher**.

## 3. Style & communication
- **Language:** réponses en français.
- **Tone:** factuel, preuves à l'appui, honnête sur ce qui n'a pas été testé ; ne jamais surestimer (les tests ≠ certification).
- **Reply length:** rapports structurés et complets pour les audits ; court pour les confirmations.
- **Formatting:** titres, tableaux (vérifications, matrices de tests, droits), niveaux P0/P1/P2, preuves `fichier:ligne`, SHA exacts, liens PR complets.
- **Working style:** ne rien modifier sans GO ; distinguer ce qui relève de l'utilisateur (rotation de clé, SQL en production, réglages Supabase/Vercel) de ce que Claude fait (code sur la branche) ; signaler spontanément toute action qui a dépassé le périmètre.
- **Avoid:** demander ou recopier des secrets ; exécuter du SQL ou écrire en production ; déclarer « prêt » sans preuve ; contacter ou modifier EasyV4.

## 4. Hard rules (word for word)
1. « CRM EasyV4 ne pas toucher on creer une subpase pour landing page comme projet separer en totalite »
2. « Décision officielle : le projet `landingpage` est totalement indépendant d'EasyV4. » — « Aucun appel API EasyV4. » « Aucune dépendance au CRM EasyV4. » « Aucune synchronisation automatique entre les deux projets. »
3. « La PR doit rester non fusionnée et non déployée. »
4. « Aucune exécution du SQL en production, aucune modification des variables Vercel, aucun changement des comptes Meta/TikTok et aucune campagne publicitaire. »
5. « Après ouverture, attendre mon GO distinct pour la fusion et mes autorisations spécifiques pour les opérations de production. »
6. « Aucun secret demandé ou manipulé. » / « Ne jamais afficher, copier ou journaliser un secret. »
7. « Ne pas considérer les 83 tests annoncés comme une certification complète du mini-CRM. » (vaut pour tout décompte de tests)
8. « Attendre mon GO explicite avant toute modification. » / « Aucune implémentation supplémentaire sans nouveau GO. »
9. Interdictions de la mission readiness : « Aucune écriture Supabase. Aucun SQL exécuté. Aucune migration appliquée. Aucune modification Vercel. Aucun secret lu ou affiché. Aucune fusion. Aucun déploiement. Aucune campagne publicitaire. »
10. « Les durées proposées ne sont pas considérées comme validées. » (durées de conservation)
11. « La rotation de la clé exposée sera effectuée par moi directement dans Supabase. »
12. Git : développer et pousser uniquement sur `claude/exciting-volta-ndkljc` ; ne jamais créer de PR ni pousser ailleurs sans demande ; terminer chaque commit par les lignes d'attribution fournies par la session (Co-Authored-By / Claude-Session) et la PR par la mention « Generated with Claude Code » ; aucun identifiant de modèle dans les commits.

## 5. Corrections log
| # | Claude did | The user wanted |
|---|---|---|
| 1 | A créé une table `leads` parallèle puis a voulu transmettre les leads au CRM EasyV4 (et un SQL qui aurait altéré la table `leads` d'EasyV4 en production) | « CRM EasyV4 ne pas toucher » : projet Supabase landing totalement séparé (`tdexdlukqciolslvjmhd`) |
| 2 | SQL initial avec politique `SELECT TO authenticated USING (true)` (fuite multi-agences) | RLS fermée : aucune politique publique ; accès équipe via `landing_is_staff()` |
| 3 | Pixel Meta : `eventID` passé dans les données (3ᵉ argument) → pas de déduplication | `fbq(method, name, data, { eventID })` en 4ᵉ argument ; même `event_id` côté serveur |
| 4 | Référence de lead `ref` fournie par le navigateur, non unique (détournement possible des statuts / conversions) | `ref` générée par le serveur, unique ; code visiteur séparé dans `visitor_ref` (corrigé, commit `bfd90e5`) |
| 5 | Pendant un audit « lecture seule », tentative de POST sur des fonctions RPC (dont la purge) — bloquée par le système | Aucune écriture ni exécution : uniquement des GET en lecture |
| 6 | Pendant la vérification post-`0001`, tentative d'INSERT avec la clé publique (refusée) | Signalé ; ne plus faire de tentative d'écriture sans GO |
| 7 | Décompte des fichiers de la PR erroné (28/15 au lieu de 26/14) | Chiffres exacts, recomptés via `git diff --name-status` |
| 8 | Envisager d'utiliser les secrets collés dans la conversation | Ne jamais les utiliser ni les recopier ; demander la rotation et la saisie hors conversation |

## 6. Decisions
| Decision | Why |
|---|---|
| Projet landing totalement indépendant d'EasyV4 | décision officielle du décisionnaire |
| Base Supabase landing : `tdexdlukqciolslvjmhd` | fournie par l'utilisateur |
| Consentement traceurs opt-in (bandeau) ; aucun pixel ni envoi Meta/TikTok sans « Accepter » | protection des données |
| Variables Supabase Vercel en **Production uniquement** (Preview sans base réelle) | séparation des environnements |
| Migrations exécutées par l'utilisateur dans SQL Editor (Claude n'a pas d'accès) | choix utilisateur (« Corriger puis vous l'exécutez ») |
| Correctif P0-3 intégré directement dans `0001` avant son application | table vide à ce moment |
| `0002` corrigée directement tant qu'elle n'est pas appliquée | pas de migration 0003 nécessaire |
| Purge non planifiée automatiquement tant que les durées ne sont pas validées | règle 10 |
| Mini-CRM `/admin` avec Supabase Auth (REST, sans dépendance), membres dans `landing_staff`, rôles `admin`/`agent` | GO « for all » |

## 7. Changed / rejected
- Table `leads` parallèle + export/statut couplés à EasyV4 → base dédiée landing (règle 1)
- Transmission des leads vers EasyV4 (`EASYV4_LEAD_INTAKE_URL`, contrat `submitLead`) → abandonnée
- `supabase/leads-table.sql` (ancien) → supprimé, remplacé par `supabase/migrations/0001_landing_leads.sql`
- `ref` fournie par le navigateur → `ref` serveur unique + `visitor_ref`
- Droits `UPDATE` / `INSERT` directs pour `authenticated` dans `0002` → lecture seule
- Planification `pg_cron` dans `0002` → retirée (commande manuelle dans le README)
- ❌ Utiliser la chaîne de connexion PostgreSQL / mot de passe de la base (non nécessaire ; jamais en conversation)
- ❌ Installation de `npx skills add supabase/agent-skills` (interrompue par l'utilisateur ; rien écrit)

## 8. Data & facts (exact)
**Dépôt / PR**
| Clé | Valeur |
|---|---|
| Dépôt | `Hassen02020/landingpage` |
| Branche de travail | `claude/exciting-volta-ndkljc` |
| HEAD | `2373022b73cc36561f436cc7e379e5a3775c03eb` |
| `main` (production actuelle) | `d78427808aabc934b241327f1a0c416a2bc597ef` |
| PR | https://github.com/Hassen02020/landingpage/pull/2 — ouverte, brouillon, non fusionnée, `mergeable_state: clean` |
| Commits clés | `ee75856`, `5249d23`, `6e0d6bc`, `9cd2e46`, `bfd90e5` (P0-3, version de `0001` appliquée), `cb12831` (mini-CRM), `2373022` (P1) |

**Supabase landing**
| Clé | Valeur |
|---|---|
| Projet | `tdexdlukqciolslvjmhd` (eu-west-3) |
| URL API | `https://tdexdlukqciolslvjmhd.supabase.co` (joignable depuis la session cloud) |
| Clé publique (non secrète) | `sb_publishable_pFYhG2cx2oxzr5xgsx7ZeA_82iYH33H` |
| Clé secrète exposée en conversation | `[secret removed: re-enter it]` — rotation **non confirmée** |
| Base directe / pooler | `db.tdexdlukqciolslvjmhd.supabase.co:5432` ; `aws-1-eu-west-3.pooler.supabase.com:6543` (user `postgres.tdexdlukqciolslvjmhd`) — injoignables depuis la session, inutiles |
| Connecteur Supabase de la session | ne voit que EasyV4 ; accès landing → « permission denied » |
| `0001` | ✅ appliquée (31/10/2026) ; colonnes `ref`, `visitor_ref`, `lead_day`, `idempotency_key`, `tracking_consent` confirmées |
| `0002` | ✅ appliquée par l'utilisateur le 2026-11-01 (version `c5c4290`) — vérifié : `landing_staff`, `landing_lead_activities`, colonnes `source`, `last_activity_at`, `consent_text_version`… → `42501` (existent, clé publique refusée) |
| Auth | ✅ `disable_signup: true` vérifié le 2026-11-01 ; fournisseur email actif |
| Intégration GitHub Supabase | active (check « Supabase Preview » sur la PR, *skipped*) — réglages de migration auto non vérifiés |
| Projets EasyV4 interdits | `crygnaichvlxavvbifqi` (EasyV4), `fxjhahtqrglktrmgqkvs` (EasyV4-preview) — refusés par `lib/server/db.ts` |

**Vercel**
| Clé | Valeur |
|---|---|
| Équipe | `Easy2Book` — `team_32LT0Y5AfZ3sMn86l736IXtD` |
| Projet | `landingpage` — `prj_W3M2Px2mEwSMYDeESpxMQLAWb62L` |
| Domaine | `landingpage-easy2book.vercel.app` |
| Production actuelle | `dpl_8Y4M9rLQUxc6THCTHffTKrFseAPB` (commit `d784278` de `main`) ; aucun déploiement Preview de la branche |
| Variables Production | `LANDING_SUPABASE_URL` (plain), `LANDING_SUPABASE_PUBLISHABLE_KEY` (encrypted), `LANDING_SUPABASE_SERVICE_ROLE_KEY` (sensitive), `LANDING_ADMIN_API_KEY` (sensitive), `META_ACCESS_TOKEN`, `META_PIXEL_ID`, `ETA_PIXEL_ID` (inutilisée) |
| Variables Preview | `META_ACCESS_TOKEN`, `META_PIXEL_ID`, `ETA_PIXEL_ID` (⚠️ Meta en Preview) ; aucune variable Supabase |
| Absentes | `NEXT_PUBLIC_META_PIXEL_ID` (défaut code `1674012850599992`), TikTok (`NEXT_PUBLIC_TIKTOK_PIXEL_ID`, `TIKTOK_PIXEL_ID`, `TIKTOK_ACCESS_TOKEN`), `RESEND_API_KEY`, `NOTIFY_*`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` |

**Métier**
- WhatsApp `21698140514` ; téléphone `98140514`.
- Réseaux : https://www.facebook.com/Easy2Bookplateforme · https://www.instagram.com/easy2book.2025/ · https://www.tiktok.com/@easy2book
- Pixel Meta : `1674012850599992`.
- Produits : `omra`, `voyage`, `hotel`, `autre`. Statuts : `nouveau`, `contacte`, `qualifie`, `reserve`, `perdu`. Sources : `form`, `whatsapp`, `phone`, `manual`. Rôles : `admin`, `agent`.
- Référence : `E2B-XXXXXX` (alphabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`).
- Version du consentement : `2026-11-v1`.
- Omra (page mise à jour le 2026-11-01) : « عمرة رمضان 2027 + عمرة شوال », titre « عروض مميزة ». Forfaits confirmés par l'utilisateur : الفوج الأول 27 جانفي 2027, 5500 TND, 10 ليالي مكة + 4 المدينة ; الفوج الثاني 18 فيفري 2027, 7800 TND, 20 ليلة مكة + 5 المدينة ; عمرة شوال 5 مارس 2027, 4800 TND, 10 + 4. « هدايا خاصة لمولد النبوي » supprimé (demande utilisateur). Bandeau : « ابتداءً من 4 800 ».
- Voyages : 19 départs du 06/07 au 15/09/2026 (dépassés). Hôtels : 12 offres « avant le 30 Juin » ; compte à rebours 31/07/2026 (dépassés).
- Images : 22 images Unsplash distinctes non vérifiées. `public/logo.png` 3750×3750 (Open Graph annonce 1200×630).
- Durées de conservation **proposées, non validées** : identifiants pub/techniques 90 jours ; `landing_events` 13 mois ; leads non réservés anonymisés 24 mois ; réservés 36 mois.

**Tests (au commit `2373022`)**
- `npm test` : 136 réussis / 0 échoué (14 fichiers), dont 43 tests de migrations `0001`+`0002` sur PGlite **avec les droits par défaut Supabase simulés**.
- `NODE_PATH=$(npm root -g) node tests/e2e/consent.e2e.mjs http://localhost:3456` : 11 / 0.
- `npm run typecheck`, `npm run build` : OK.
- Non exécutés : Supabase Auth réel, API Supabase avec clé secrète, `0002` sur Supabase, envois réels Meta/TikTok/Resend/Turnstile, charge, restauration.

## 9. People, terms & names
- **People:** Hassen Tarhouni — décisionnaire, propriétaire des comptes (GitHub `Hassen02020`, Vercel `tarhounihassene-7062`).
- **Terms & nicknames:** « GO » = autorisation explicite ; « EasyV4 » = CRM existant, hors périmètre ; « landing » = ce projet ; P0/P1/P2 = niveaux de risque ; « Réf » = référence `E2B-…` dans les messages WhatsApp.
- **Names in use:** tables `landing_leads`, `landing_events`, `landing_staff`, `landing_lead_activities` ; vues `landing_campaign_performance`, `landing_niche_performance` ; fonctions `landing_is_staff()`, `landing_purge_personal_data()`, `landing_touch_updated_at()`, `landing_activities_immutable()` ; routes `/api/leads`, `/api/leads/status`, `/api/leads/export`, `/api/track`, `/admin`, `/admin/login`, `/admin/leads/[id]`, `/admin/leads/new`, `/admin/stats`, `/admin/export` ; fichiers `lib/server/{db,crm,auth,notify,captcha,guard,meta,tiktok,export,admin-auth}.ts`, `middleware.ts`, `app/admin/actions.ts`.

## 10. Work state
| Item | Status | Version / location | Notes |
|---|---|---|---|
| Landing pages + tracking + consentement | fait | branche, `app/`, `lib/` | contenu (dates, images) à corriger |
| `0001_landing_leads.sql` | appliquée en prod | `supabase/migrations/`, version `bfd90e5` | inchangée depuis |
| `0002_landing_crm.sql` | **appliquée** (2026-11-01, version `c5c4290`) | `supabase/migrations/` | ne plus modifier : toute évolution = nouvelle migration `0003` |
| Mini-CRM `/admin` | fait (non testé en réel) | `app/admin/` | connexion Supabase Auth réelle non testée |
| README / `.env.example` | à jour (droits service_role, règles métier en base, conservation depuis la dernière interaction, clé API déconseillée) | racine | — |
| PR #2 | brouillon, description à jour (`2373022`) | lien section 8 | marquée NON PRÊTE |
| Ce fichier handoff | commité | `handoff-landingpage-easy2book.md` (racine du dépôt) | à mettre à jour à chaque passation |

**Dernière vérification (6 points), résultats prouvés :**
1. Rôle admin contrôlé côté serveur : ✅ (`app/admin/export/route.ts:13`, rôle relu en base `lib/server/auth.ts:77-82`) ; seule fonction réservée = export ; `/api/leads/export` ouvert à `LANDING_ADMIN_API_KEY`.
2. RLS : ✅ `anon` aucun droit ; `authenticated` SELECT seul + filtré par `landing_is_staff()`.
3. `service_role` : ❌ (corrigé dans `0002`, non appliquée) garde tous les droits (droits par défaut Supabase) → `TRUNCATE` historique, `DELETE` leads, `TRUNCATE` événements, ré-identification d'un lead anonymisé, remise à NULL de `booked_at`, `INSERT` dans `landing_staff` possibles.
4. Leads anonymisés (corrigé en base dans `0002`) : protégés dans toute l'application (`lib/server/crm.ts` gardes l.165, 218, 226, 234, 242 avant toutes les écritures l.179, 228, 236, 243) ; ❌ aucune protection en base.
5. Purge (corrigé dans `0002` : depuis `last_activity_at` / `booked_at`) : ❌ durées comptées depuis `created_at` → un lead créé il y a 37 mois et réservé il y a 2 jours est anonymisé ; un lead créé il y a 25 mois et rappelé hier aussi. Montant/`booked_at`/preuve de consentement conservés.
6. `0002` cohérente avec `0001` appliquée : ✅.

## 11. Next steps
1. **Next action:** les 6 corrections de `0002` sont faites (service_role sans DELETE/TRUNCATE ; TRUNCATE historique interdit ; trigger `landing_leads_guard` : lead anonymisé figé, anonymisation réservée à la purge, `booked_at` définitif ; `last_activity_at` + purge depuis la dernière interaction ; README corrigé ; `LANDING_ADMIN_API_KEY` déconseillée). `0002` appliquée et vérifiée (2026-11-01). Déclarés faits par l'utilisateur, non vérifiables par Claude : révocation de l'ancienne clé, désactivation du déploiement auto des migrations GitHub. Compte équipe créé le 2026-11-01 : `direction@easy2book.tn`, Hassen Tarhouni, rôle `admin`, actif (sortie SQL fournie par l'utilisateur). Inscriptions publiques fermées (vérifié). Prochaine action : tests réels de /admin (environnement de test, ou GO explicite pour un test contrôlé en production), puis contenu, puis GO de fusion.
2. Côté utilisateur, avant toute fusion : confirmer la révocation de l'ancienne clé secrète ; vérifier/désactiver le déploiement automatique des migrations de l'intégration GitHub Supabase ; valider les durées ; fermer les inscriptions publiques ; appliquer `0002` (puis vérification en lecture seule par Claude sur GO) ; créer les comptes équipe ; projet Supabase de test pour la Preview et retrait des variables Meta en Preview ; contenu (dates, images, page de confidentialité, logo OG).
3. Tests réels sur environnement de test, puis GO de fusion.

## 12. Open questions ⚠️
- L'ancienne clé secrète `sb_secret_…` a-t-elle été révoquée ? (oui / non / à vérifier)
- Réglages de l'intégration GitHub Supabase : déploiement automatique des migrations sur `main` activé ? (désactiver / renommer les migrations et marquer `0001` comme appliquée)
- Durées de conservation à valider (90 j / 13 mois / 24 mois / 36 mois ou autres) et contrainte légale de conservation des ventes en Tunisie (validation juridique).
- Créer un projet Supabase de test pour la Preview ? Retirer `META_ACCESS_TOKEN` / `META_PIXEL_ID` de la Preview ?
- Conserver `LANDING_ADMIN_API_KEY` en production ?
- Le connecteur Supabase peut-il être reconnecté sur le compte/organisation possédant `tdexdlukqciolslvjmhd` ?

## 13. Re-attach checklist
- Nothing to attach. Tout est dans le dépôt `Hassen02020/landingpage`, branche `claude/exciting-volta-ndkljc` (la nouvelle session doit être ouverte sur ce dépôt et cette branche).

---
<sub>Audit: 13/13 sections · 12 rules · 8 corrections · 60+ data points · secrets removed: yes · generated by active-memory · mis à jour après les corrections de sécurité de 0002</sub>
