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
| P1 | **Aucune CI** : une régression peut être fusionnée sans contrôle | 1 |
| P1 | Formulaire de la page Hôtels demande le **budget** dès le premier contact (contraire à la décision) ; voyageurs, type de séjour aussi | 2 |
| P1 | **Aucun champ e-mail ni région** dans le modèle : impossible de qualifier comme décidé | 2 |
| P1 | `adults = 1 / children = 0` **inventés** quand rien n'est saisi (qualité de données) | 2 |
| P2 | En-têtes de sécurité HTTP absents (nosniff, frame, referrer, no-store sur /admin) | 1 |
| P2 | Limites de débit en mémoire (par instance serverless) : protection partielle | 1 |
| P2 | Pipeline à 5 statuts (cible : 9) | 5 |
| P2 | WhatsApp : clic ≠ message reçu ; pas d'API / webhook (accès propriétaire requis) | 4 |
| P2 | Pas de générateur de liens UTM pour bio / publications / publicités | 3 |
| P2 | Customer 360, segmentation, marketing, fidélité : absents | 6–8 |
| P3 | Lint non configuré ; Playwright non déclaré dans `package.json` | 1 |
| Opérationnel | Jeton Meta de production invalide (erreur 190) : à remplacer par le propriétaire dans `/admin/integrations` | — |
| Opérationnel | PR #1 (PETORA, août 2026) ouverte et sans rapport : à fermer par le propriétaire | — |

## Blocs

| Bloc | Objectif | État | Preuves / notes |
|---|---|---|---|
| 0 | Baseline et cartographie | **VALIDÉ PAR TESTS** | `docs/CARTOGRAPHIE.md` ; tsc, Vitest 176/176, build, e2e 11/11 + 9/9 + 67/67 |
| 1 | Fiabilité des fondations | EN COURS | voir journal ci-dessous |
| 2 | Formulaires et collecte | À CORRIGER | écarts P1 ci-dessus |
| 3 | Réseaux → landing pages | À AUDITER | |
| 4 | WhatsApp | À AUDITER | API officielle : arbitrage et accès propriétaire |
| 5 | CRM et équipe | PARTIEL (pipeline à 5 statuts) | |
| 6 | Customer 360 | À AUDITER | |
| 7 | Segmentation et marketing | À AUDITER | aucun envoi réel sans autorisation |
| 8 | Fidélité / VIP | EN ATTENTE D'ARBITRAGE | règles non définies |
| 9 | Analytics | PARTIEL | stats marketing / équipe / offres présentes |
| 10 | Certification | À AUDITER | |

## Journal

- 02/11/2026 — Bloc 0 : état réel vérifié (main `04de912`, 3 branches, PR #1 ouverte hors sujet, 0 workflow CI).
