# ROADMAP vivante — Easy2Book Customer Growth OS

Statuts : À AUDITER · AUDITÉ · À CORRIGER · EN COURS · TESTÉ · VALIDÉ PAR TESTS · BLOQUÉ · EN ATTENTE D'ARBITRAGE · PR PRÉPARÉE · FUSIONNÉ · DÉPLOYÉ · CERTIFIÉ.
Règle : **code écrit ≠ code testé ≠ intégration connectée ≠ parcours validé ≠ production certifiée.**
Le propriétaire (Hassen02020) garde la main sur fusion, déploiement, migrations de production, secrets et comptes externes.

## Décisions commerciales actées (non négociables)

WhatsApp = canal privilégié · prénom au premier contact · téléphone requis pour un contact WhatsApp · e-mail facultatif · région pendant la qualification · budget plus tard (déclaration, jamais une dépense) · âge non demandé · formulaire initial court · EasyV4 = source de vérité des réservations et finances · base landing séparée d'EasyV4 · aucune campagne ni budget sans autorisation.

## Décisions en attente du propriétaire

Seuils VIP · période de calcul · formule dépenses + fréquence · avantages des niveaux · durées de conservation définitives · identifiants et autorisations des intégrations externes (WhatsApp Business API, Meta, TikTok, e-mail, SMS).

## Écarts constatés (02/11/2026)

| Priorité | Écart | Bloc |
|---|---|---|
| P0 | Aucun écart de sécurité critique trouvé dans le code lors de cette passe (droits SQL, jetons chiffrés, rôles testés). Audit approfondi en Bloc 1. | 1 |
| P1 | ~~Aucune CI~~ → **corrigé** : `.github/workflows/ci.yml` (typecheck, tests, build) — *s'exécutera à l'ouverture de la PR* | 1 |
| P1 | ~~Budget, voyageurs, type de séjour, dates demandés au premier contact~~ → **corrigé** (formulaire court) | 2 |
| P1 | ~~Aucun champ e-mail ni région~~ → **corrigé** : migration 0006 + carte « Qualification » sur la fiche | 2 |
| P1 | ~~`adults = 1 / children = 0` inventés~~ → **corrigé** : NULL = non précisé | 2 |
| P2 | ~~En-têtes de sécurité HTTP absents~~ → **corrigé** et vérifié sur le serveur réel | 1 |
| P2 | Limites de débit en mémoire (par instance serverless) : protection partielle | 1 |
| P2 | Pipeline à 5 statuts (cible : 9) | 5 |
| P1 | ~~Message WhatsApp reçu non rattaché à sa source (la référence E2B n'était lue nulle part)~~ → **corrigé** (« Nouveau lead » + message collé) | 4 |
| P2 | ~~Clic confondu avec conversation~~ → **corrigé** : onglet Statistiques → WhatsApp (observé / saisi / calculé), échanges saisis | 4 |
| Bloqué | API officielle WhatsApp Business / webhook : accès, numéro et politique de conservation à fournir par le propriétaire (`docs/WHATSAPP.md`) | 4 |
| P1 | **Canal mal détecté** : un `utm_source` contenant « ig », « fb » ou « wa » (ex. « digital », « big-sale », « wave ») était classé Meta ou WhatsApp → ~~corrigé~~ (mots entiers, testé) | 3 |
| P2 | ~~Pas de générateur de liens UTM~~ → **corrigé** : `/admin/liens` | 3 |
| P2 | ~~Page du formulaire non enregistrée~~ → **corrigé** (`form_page`, migration 0006) ; ~~Facebook et Instagram indiscernables dans les stats~~ → colonne « Source » | 3 |
| P3 | ~~Deux adresses pour l'Omra (`/omra` et `/c/omra-2027`)~~ → redirection avec conservation des paramètres | 3 |
| P2 | Customer 360, segmentation, marketing, fidélité : absents | 6–8 |
| P3 | Lint non configuré ; Playwright non déclaré dans `package.json` | 1 |
| ~~Opérationnel~~ | ~~Jeton Meta de production invalide (190)~~ → **résolu le 10/11/2026** : pixel + API des conversions Meta actifs et validés (événement de test reçu) ; TikTok actif | — |
| Opérationnel | PR #1 (PETORA, août 2026) ouverte et sans rapport : à fermer par le propriétaire | — |

## Blocs

| Bloc | Objectif | État | Preuves / notes |
|---|---|---|---|
| 0 | Baseline et cartographie | **VALIDÉ PAR TESTS** | `docs/CARTOGRAPHIE.md` ; tsc, Vitest 176/176, build, e2e 11/11 + 9/9 + 67/67 |
| 1 | Fiabilité des fondations | **TESTÉ** (partiel : limites de débit en mémoire et lint restent à traiter) | CI, en-têtes HTTP (`security-headers.test`, vérifiés par `curl`), repli d'insertion, export tolérant |
| 2 | Formulaires et collecte | **VALIDÉ PAR TESTS** — *PR PRÉPARÉE* (migration 0006 à appliquer par le propriétaire) | `collecte.test` 11, `migration-0006.test` 6 (PostgreSQL/PGlite), `collect.e2e` (4 pages × mobile/bureau), `omra-journey` 9, `admin-flow` 70 |
| 3 | Réseaux → landing pages | **VALIDÉ PAR TESTS** — *PR PRÉPARÉE* | `channel-links.test` 11, `collecte.test` 14, `migration-0006.test` 7, `social.e2e` 24 (navigateur réel + faux Supabase) ; aucune campagne lancée |
| 4 | WhatsApp | **VALIDÉ PAR TESTS** pour tout ce qui est possible sans API — *PR PRÉPARÉE* ; API officielle **BLOQUÉE** (accès propriétaire) | `whatsapp.e2e` (38 liens × avec / sans consentement), `whatsapp.test` 12, `admin-flow` (rattachement, doublon, origine inconnue, échanges, stats) |
| 5 | CRM et équipe | **VALIDÉ PAR TESTS** (pipeline à 10 statuts) — *PR PRÉPARÉE* (migration 0007, après 0006, à appliquer par le propriétaire) | `pipeline.test` 18, `crm-lot3.test`, `admin-flow` 96 contrôles dont le scénario prospect → conseiller → qualification → devis → négociation → réservation → gagné (faux Supabase) |
| 6 | Customer 360 | **VALIDÉ PAR TESTS** — *PR PRÉPARÉE* (aucune migration) | `customer360.test` 8, `admin-flow` : liste Clients, fiche client (demandes, chronologie commune, consentements, ventes / CA), liens lead ⇄ client, 404 sur clé invalide |
| 7 | Segmentation et marketing | **VALIDÉ PAR TESTS** pour la segmentation — *PR PRÉPARÉE* (aucune migration) ; **envoi / campagne : NON FAIT par décision** (autorisation du propriétaire requise) | `segments.test` 7, `admin-flow` (7 contrôles segments) |
| 8 | Fidélité / VIP | **CODE ÉCRIT + TESTÉ** (règles décidées le 06/11/2026) ; **seuil VIP en attente** ; *non déployé* | `loyalty.test` 6, `segments.test`, `admin-flow` (niveaux, fiche client, segment VIP) |
| 9 | Analytics | **VALIDÉ PAR TESTS** (entonnoir, délais, série par jour) — *PR PRÉPARÉE* (aucune migration) | `analytics.test` 6, `admin-flow` (onglet Entonnoir) ; stats marketing / équipe / offres / WhatsApp existantes |
| 10 | Certification | **AUDIT FAIT** (06/11/2026) — voir la matrice ci-dessous ; *PRODUCTION CERTIFIÉE* seulement après vérification en ligne | tsc, Vitest 260/260, build, e2e : whatsapp, collect, omra-journey, consent, social (0 échec), admin 121 contrôles (0 échec), CI GitHub verte (run 9) |

## Journal

- 02/11/2026 — Bloc 0 : état réel vérifié (main `04de912`, 3 branches, PR #1 ouverte hors sujet, 0 workflow CI).
- 02/11/2026 — Interface admin refondue (menu latéral groupé, tiroir mobile) ; faux Supabase en mémoire pour tester l'admin de bout en bout (`tests/e2e/fake-supabase.mjs`).
- 02/11/2026 — Bloc 1 : CI GitHub Actions, en-têtes de sécurité, repli d'insertion pour base non migrée, export tolérant.
- 02/11/2026 — Bloc 2 : formulaire public court ; migration `0006_landing_qualification.sql` ; qualification CRM (région, e-mail, budget déclaré, voyageurs, période, canal) tracée dans l'historique ; e-mail et région effacés à l'anonymisation.

## Limites des preuves (à lire)

- Les tests « admin » utilisent un **faux Supabase en mémoire** : ils prouvent le comportement du code, pas celui de la base réelle. Le schéma SQL, lui, est vérifié sur un vrai PostgreSQL (PGlite).
- Les formulaires publics sont testés dans un vrai navigateur, mais l'envoi à `/api/leads` y est intercepté. L'API est testée séparément avec une base simulée.
- Aucune intégration externe (Meta, TikTok, WhatsApp Business) n'a été exercée : jeton Meta de production invalide, aucune API WhatsApp connectée.
- La CI GitHub n'a pas encore tourné (elle démarre à l'ouverture de la PR).
- 02/11/2026 — Bloc 3 : détection de canal corrigée (`lib/channel.ts`) ; générateur de liens `/admin/liens` (`lib/links.ts`) ; `form_page` ; colonne « Source » ; redirection `/c/omra-2027` → `/omra` ; parcours e2e par source (Instagram bio, Facebook payant, TikTok dynamique, WhatsApp, direct, navigateur intégré), avec et sans consentement.

### Bloc 3 — ce qui est prouvé et ce qui ne l'est pas

| Prouvé (test exécuté) | Non prouvé / dépendance |
|---|---|
| Chaque lien généré est reconnu par la détection de canal et ses paramètres arrivent intacts dans le lead (aller-retour, 4 réseaux × tous supports) | Que Meta / TikTok remplissent réellement les paramètres dynamiques (`{{campaign.name}}`, `__CAMPAIGN_NAME__`) : à constater sur une vraie publicité, **sans la lancer ici** |
| Clic → landing → navigation interne → formulaire → ligne enregistrée : canal, source, support, campagne, groupe, annonce, page d'arrivée, page du formulaire | Que les applications mobiles transmettent leur origine : sans UTM, seul le navigateur intégré (Instagram, Facebook, TikTok) est reconnu |
| Sans consentement : campagne gardée, **aucun** fbclid / ttclid / identifiant visiteur / IP / navigateur enregistrés | Envoi réel à Meta / TikTok : jetons absents dans les tests ; Meta de production invalide |
| Un `utm_source` inconnu ou trompeur (« digital_bio ») n'est pas attribué à Meta | Lien de bio sur un vrai profil : à coller par le propriétaire (aucun compte modifié) |
- 05/11/2026 — Bloc 4 : audit navigateur des 38 liens WhatsApp (aucun défaut côté site) ; rattachement d'un message reçu à son clic d'origine (référence E2B) ; échanges reçus / envoyés saisis (`wa_in`, `wa_out`, migration 0006) ; onglet Statistiques → WhatsApp ; audit de l'API officielle documenté sans simulation (`docs/WHATSAPP.md`).

- 05/11/2026 — Bloc 5 : pipeline NOUVEAU → À CONTACTER → CONTACTÉ → À QUALIFIER → QUALIFIÉ → DEVIS → NÉGOCIATION → RÉSERVÉ → GAGNÉ (+ PERDU) ; source unique `lib/status.ts` ; migration `0007_landing_pipeline.sql` ; anciens statuts conservés ; « Vendus » = réservé + gagné (une vente n'est comptée qu'une fois) ; tableau Pipeline à 10 colonnes ; statistiques équipe avec propositions.

### Bloc 4 — prouvé / non prouvé

| Prouvé (test exécuté) | Non prouvé / bloqué |
|---|---|
| 38 liens, numéro officiel unique, référence ajoutée à chaque clic, événement « Contact » seulement avec consentement | **Envoi réel d'un message** et **réception réelle** : aucune API connectée, aucun message envoyé |
| Message collé → clic d'origine retrouvé (canal, source, campagne) sans copier d'identifiant publicitaire ; doublon évité ; origine inconnue déclarée comme telle | Que le visiteur envoie réellement le message prérempli (non observable sans l'API officielle) |
| Échanges saisis tracés ; entonnoir WhatsApp avec natures séparées | Webhook, statuts de lecture, réponses automatiques : bloqués (numéro, accès, conservation du texte) |

### Bloc 5 — prouvé / non prouvé

| Prouvé (test exécuté) | Non prouvé / à valider |
|---|---|
| Parcours complet en navigateur (affectation, qualification, 6 étapes, réservation refusée sans montant, gagné) ; `booked_at` et montant inchangés de réservé à gagné ; historique avant / après de chaque étape | Migration 0007 sur la base de production : **non appliquée** (PGlite seulement) ; l'e2e tourne sur un faux Supabase |
| Perdu depuis une étape ouverte, réouverture, filtre « vendus », actions groupées sans les statuts de vente, CA sans double comptage | Sens exact de `reserve` / `gagne` : **proposition à valider** par le propriétaire ; règle de répartition des leads entre conseillers : non définie |

### Bloc 6 — prouvé / non prouvé

| Prouvé (test exécuté) | Non prouvé / limites |
|---|---|
| Un numéro = un client (2 demandes du même numéro → 1 fiche) ; ventes = réservé + gagné sans double comptage ; un retrait marketing sur une demande exclut le client | Regroupement par **téléphone seulement** : un même client avec deux numéros reste deux fiches (pas de fusion manuelle) |
| Chronologie commune de toutes les demandes ; clé non numérique refusée sans requête | Dossiers anonymisés exclus par construction ; e2e sur faux Supabase, pas sur la base réelle ; liste limitée aux 5 000 demandes les plus récentes |

### Bloc 7 — prouvé / non prouvé

| Prouvé (test exécuté) | Non prouvé / limites |
|---|---|
| 7 segments calculés (à traiter, relance 7 j, proposition sans réponse, perdus à reprendre, Omra sans réservation, clients ayant réservé, région à renseigner) ; seuils testés aux bornes | **Aucun envoi, aucune campagne, aucun export** : volontairement non implémentés (protection du propriétaire) |
| Segments « marketing » : client sans consentement marketing exclu et compté à part (test unitaire) ; segments « suivi » indépendants du consentement marketing | Dans l'e2e, le faux Supabase n'a presque aucun consentement marketing : l'exclusion y est vérifiée mais les listes marketing sont quasi vides — la preuve forte est le test unitaire |
| La consultation n'écrit rien | Seuils (7 j, 60 j) et définitions = **propositions à valider** ; fenêtre de 5 000 demandes récentes |

### Bloc 9 — prouvé / non prouvé

| Prouvé (test exécuté) | Non prouvé / limites |
|---|---|
| Entonnoir en 6 étapes, un dossier perdu compte jusqu'à l'étape atteinte ; réservé → gagné compté une fois ; aucune division par zéro | Délais calculés sur les actes saisis dans le CRM (statut, note, WhatsApp saisi) : un contact fait hors CRM n'est pas vu |
| Délai médian / moyen de premier traitement, seuils 1 h et 24 h, dossiers jamais traités ; série par jour sans trous | Coût par lead / ROAS : **impossibles sans les dépenses publicitaires réelles** (aucune API publicitaire connectée, aucun budget saisi) |
| Consultation en lecture seule (contrôlé en e2e sur le faux Supabase) | Activités lues depuis le début de la période (50 000 max) ; e2e sur faux Supabase, pas sur la base réelle |

### Migrations 0006 et 0007 — vérification en production (06/11/2026)

Requête de lecture seule exécutée par le propriétaire dans le projet des landing pages : `colonnes_0006 = 4`, `statuts_0007 = true`, `purge_0007 = true`. Les deux migrations sont donc appliquées. **Le code des blocs 2 à 9 n'est pas encore déployé** (PR #8 en brouillon, aucune fusion, aucun déploiement sans autorisation).

## Bloc 10 — Matrice de certification (06/11/2026)

Niveaux : CODE ÉCRIT < TESTÉ < INTÉGRATION CONNECTÉE < PARCOURS VALIDÉ < PRODUCTION CERTIFIÉE.

| Domaine | Niveau atteint | Preuve | Ce qui manque pour le niveau suivant |
|---|---|---|---|
| Formulaire court, collecte, anti-doublon | PARCOURS VALIDÉ (navigateur, faux Supabase) | `collect.e2e`, `omra-journey`, `collecte.test` | Un lead de test réel après déploiement |
| Consentements et traceurs | PARCOURS VALIDÉ | `consent.e2e`, tests CAPI / Events | Vérification avec un vrai pixel (jetons) |
| Attribution sociale / liens de campagne | TESTÉ + PARCOURS VALIDÉ | `social.e2e`, `channel-links.test` | Lien de bio posé sur un vrai profil (propriétaire) |
| WhatsApp (liens, rattachement, échanges saisis) | PARCOURS VALIDÉ pour les liens ; API officielle **NON CONNECTÉE** | `whatsapp.e2e`, `whatsapp.test` | Accès Business API (propriétaire) |
| Pipeline à 10 statuts, ventes comptées une fois | PARCOURS VALIDÉ + migration 0007 **appliquée en production** | `pipeline.test`, scénario `admin-flow`, requête du propriétaire | Parcours réel après déploiement |
| Customer 360, segments, analytics | PARCOURS VALIDÉ (faux Supabase) | `customer360`, `segments`, `analytics` + e2e | Relecture sur données réelles |
| Intégration Meta | **ACTIVE EN PRODUCTION** (10/11/2026) : pixel + API des conversions, événement de test reçu, domaines limités | `meta-tiktok.test`, `admin-features.test` | — |
| Intégration TikTok | **ACTIVE EN PRODUCTION** (10/11/2026) : pixel + Events API, test accepté, premier événement navigateur reçu | `meta-tiktok.test` | Compte annonceur à activer pour diffuser |
| Sécurité (en-têtes, RLS, droits minimaux, EasyV4 interdit) | TESTÉ | `security-headers`, `db-minimal`, migrations PGlite ; aucun secret trouvé dans le dépôt | Revue externe / lint non configuré |
| Fidélité / VIP (Bloc 8) | **NON FAIT** | — | Règles à définir par le propriétaire |
| Envoi de messages, campagnes, export de segments | **NON FAIT par décision** | — | Autorisation spécifique du propriétaire |
| Production | **NON CERTIFIÉE tant que la vérification en ligne n'est pas faite** | — | Déploiement + contrôles en ligne (ci-dessous) |

Écarts connus : limites de débit en mémoire par instance ; lint non configuré ; e2e sur faux Supabase ; coût par lead / ROAS impossibles sans dépenses réelles ; sens de `reserve` / `gagne`, seuils de segments et répartition des leads à valider.

### Correction WhatsApp — emojis (06/11/2026)

Constat en production (capture du propriétaire) puis par requêtes sur `wa.me` : **tout emoji d'un texte prérempli est remplacé par « � »** dans la redirection vers `api.whatsapp.com` (👋 ✈️ 🏖️ 📅 testés). Les accents et l'arabe passent. Correction : `lib/wa-text.ts` (`waText`) retire les emojis des liens WhatsApp (formulaire, accueil, Summer Vibes, voyages organisés, catégories, modèles d'équipe) ; les puces des listes deviennent des tirets. Test garde-fou `tests/wa-emoji.test.ts` : aucun message « Bonjour Easy2Book… » du code ne peut contenir d'emoji. Les emojis de l'**interface** (boutons, pages) sont conservés : seuls les textes envoyés via `wa.me` sont concernés. Les modèles d'équipe déjà en base gardent leurs emojis (migration 0005 non modifiée) ; ils sont nettoyés à l'envoi.

Complément (même jour) : la vérification en ligne après le premier déploiement a montré que `/omra` envoyait encore « 🕋 » (le garde-fou ne cherchait que « Bonjour Easy2Book », pas le texte arabe). Tous les liens `wa.me` passent maintenant par `waText` ; `wa-emoji.test` vérifie que tout fichier qui construit un lien `wa.me?text=` l'utilise, et `whatsapp.e2e` contrôle l'absence d'emoji sur les liens réellement rendus (4 pages × avec / sans consentement).

### Bloc 8 — règles décidées et preuves (06/11/2026)

**Règles (décision du propriétaire)** : base = chiffre d'affaires cumulé des ventes (réservé + gagné) ; période = cumul à vie ; deux niveaux, **Fidèle** dès la 1re vente et **VIP** à partir d'un seuil ; avantages = étiquette + segment « Clients VIP » seulement (aucune remise automatique, aucun envoi, aucun prix modifié ; le segment VIP exclut les clients sans consentement marketing).

**Seuil VIP : montant non décidé.** Il se règle par la variable d'environnement `LANDING_VIP_THRESHOLD_TND` (nombre > 0). Tant qu'elle est absente ou invalide, **personne n'est classé VIP** (tous les clients ayant acheté sont « Fidèle ») : aucune valeur n'est inventée.

| Prouvé (test exécuté) | Non prouvé / à faire |
|---|---|
| Seuil absent / invalide → jamais VIP ; seuil inclus (≥) ; aucun niveau sans vente ; cumul sur toutes les demandes y compris anciennes ; perdu non compté | Montant du seuil : à fixer par le propriétaire, puis variable à poser sur Vercel (action propriétaire) |
| Niveaux affichés dans Clients et la fiche client (avec explication du calcul) ; segment VIP avec exclusion sans consentement marketing | Aucun avantage concret (remise, code, message) : non demandé, non fait |
| Consultation en lecture seule | Rétrogradation : sans objet (cumul à vie) ; e2e sur faux Supabase avec seuil de test 10 000 TND |

## Plateforme multi-entreprises (cahier des charges « Connect & Convert », 07/11/2026)

Ordre décidé par le propriétaire : 1 multi-tenant + RLS · 2 migration des données Easy2Book · 3 rôles · 4 inscription · 5 formulaires adaptatifs · 6 employés + round-robin · 7 site builder · 8 OAuth Meta / TikTok / Threads · 9 WhatsApp Embedded Signup · 10 campagnes / dépenses / analytics · 11 certification.

| Chantier | État |
|---|---|
| MULTI-TENANT-FOUNDATION-01 (chantiers 1 à 3 : organisations, rattachement d'Easy2Book, rôles, Super Admin, RLS, tests d'isolation) | **CODE ÉCRIT + TESTÉ** ; migration 0008 **appliquée en production le 07/11/2026 (postcheck 12 / 12 OK, test d'écriture réussi)** ; code de la PR #12 non fusionné ; détail : `docs/MULTI_TENANT.md` |
| Suivants (4 à 11) | non démarrés (GO explicite requis pour chacun) |
| TENANT-APP-SCOPING-02 (cloisonnement par organisation côté serveur, refus par défaut en mode multi) | **CODE ÉCRIT + TESTÉ** ; non fusionné ni déployé ; mode multi non exploitable avant le câblage des points d'entrée ; lecture admin par jeton (RLS) reportée ; détail : `docs/MULTI_TENANT.md` §10 |
| TENANT-ENTRYPOINTS-03 (organisation du compte connecté pour l'admin, site public rattaché à Easy2Book, e2e à deux entreprises) | **CODE ÉCRIT + TESTÉ** ; non fusionné ni déployé ; écritures sur unicités globales encore refusées en mode multi ; détail : `docs/MULTI_TENANT.md` §12-13 |
| Règle des employés (08/11/2026) : tous les leads de leur entreprise, aucun d'une autre — migration 0009 | **CODE ÉCRIT + TESTÉ** ; migration **non appliquée** ; sans effet sur le CRM actuel (lecture par le serveur) ; `docs/MULTI_TENANT.md` §14 |
| Unicités par organisation — migrations 0010 (élargir) / 0011 (resserrer), caches par organisation, variables Vercel réservées à la plateforme (chantier 04) | **CODE ÉCRIT + TESTÉ** ; migrations **non appliquées** ; ordre : 0010 → déploiement → 0011 avant la 2ᵉ organisation ; `docs/MULTI_TENANT.md` §15 |
| Création d'une entreprise + premier administrateur invité par e-mail, espace plateforme Super Admin (chantier 05 A) — migration 0012 | **CODE ÉCRIT + TESTÉ** ; migration **non appliquée** ; formulaires adaptatifs (05 B) à faire ; `docs/MULTI_TENANT.md` §16 |
| Rôles et permissions : Employé / Manager / Administrateur appliqués par permission partout, rôle Manager (chantier 06) — migration 0013 | **CODE ÉCRIT + TESTÉ** ; migration **non appliquée** ; `docs/MULTI_TENANT.md` §17 |
| Page publique `/o/<identifiant>` et formulaire configurable par entreprise (chantier 05 B) — migration 0014 | **CODE ÉCRIT + TESTÉ** ; migration **non appliquée** ; `docs/MULTI_TENANT.md` §19 |


## Chantier 07 — audit et amélioration UI/UX du frontend public (09/11/2026)
Audit mesuré (axe-core, captures mobile 390 px et ordinateur 1366 px, poids, débordements) sur `/`, `/omra`, `/voyages-organises`, `/summer-vibes`. **Avant : 15 à 76 défauts d'accessibilité par page** (contrastes insuffisants sur les boutons verts, le texte gris et les couleurs d'accent ; aucune zone `main` ; page arabe déclarée en français ; ordre des titres ; zones tactiles trop petites ; logo de 1,4 Mo ; image d'en-tête de 1 600 px servie à un mobile de 390 px). **Après : 0 défaut axe sur les 8 vues.** Détail dans `docs/UI_AUDIT_07.md`.

| AUDIT-FRONT-09 | Suites de l'audit frontend (prix Omra, urgence, preuves, SEO, confidentialité) | `docs/AUDIT_FRONT_09.md` |
| AUDIT-LEADS-MULTICANAUX | Réception automatique des leads Facebook / Instagram / TikTok / WhatsApp : audit A0–A5 (aucun code), lots 1 à 5 proposés | `docs/AUDIT_LEADS_MULTICANAUX.md` |
