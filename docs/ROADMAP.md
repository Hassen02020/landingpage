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
| P2 | WhatsApp : clic ≠ message reçu ; pas d'API / webhook (accès propriétaire requis) | 4 |
| P1 | **Canal mal détecté** : un `utm_source` contenant « ig », « fb » ou « wa » (ex. « digital », « big-sale », « wave ») était classé Meta ou WhatsApp → ~~corrigé~~ (mots entiers, testé) | 3 |
| P2 | ~~Pas de générateur de liens UTM~~ → **corrigé** : `/admin/liens` | 3 |
| P2 | ~~Page du formulaire non enregistrée~~ → **corrigé** (`form_page`, migration 0006) ; ~~Facebook et Instagram indiscernables dans les stats~~ → colonne « Source » | 3 |
| P3 | ~~Deux adresses pour l'Omra (`/omra` et `/c/omra-2027`)~~ → redirection avec conservation des paramètres | 3 |
| P2 | Customer 360, segmentation, marketing, fidélité : absents | 6–8 |
| P3 | Lint non configuré ; Playwright non déclaré dans `package.json` | 1 |
| Opérationnel | Jeton Meta de production invalide (erreur 190) : à remplacer par le propriétaire dans `/admin/integrations` | — |
| Opérationnel | PR #1 (PETORA, août 2026) ouverte et sans rapport : à fermer par le propriétaire | — |

## Blocs

| Bloc | Objectif | État | Preuves / notes |
|---|---|---|---|
| 0 | Baseline et cartographie | **VALIDÉ PAR TESTS** | `docs/CARTOGRAPHIE.md` ; tsc, Vitest 176/176, build, e2e 11/11 + 9/9 + 67/67 |
| 1 | Fiabilité des fondations | **TESTÉ** (partiel : limites de débit en mémoire et lint restent à traiter) | CI, en-têtes HTTP (`security-headers.test`, vérifiés par `curl`), repli d'insertion, export tolérant |
| 2 | Formulaires et collecte | **VALIDÉ PAR TESTS** — *PR PRÉPARÉE* (migration 0006 à appliquer par le propriétaire) | `collecte.test` 11, `migration-0006.test` 6 (PostgreSQL/PGlite), `collect.e2e` (4 pages × mobile/bureau), `omra-journey` 9, `admin-flow` 70 |
| 3 | Réseaux → landing pages | **VALIDÉ PAR TESTS** — *PR PRÉPARÉE* | `channel-links.test` 11, `collecte.test` 14, `migration-0006.test` 7, `social.e2e` 24 (navigateur réel + faux Supabase) ; aucune campagne lancée |
| 4 | WhatsApp | À AUDITER | API officielle : arbitrage et accès propriétaire |
| 5 | CRM et équipe | PARTIEL (pipeline à 5 statuts) | |
| 6 | Customer 360 | À AUDITER | |
| 7 | Segmentation et marketing | À AUDITER | aucun envoi réel sans autorisation |
| 8 | Fidélité / VIP | EN ATTENTE D'ARBITRAGE | règles non définies |
| 9 | Analytics | PARTIEL | stats marketing / équipe / offres présentes |
| 10 | Certification | À AUDITER | |

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
