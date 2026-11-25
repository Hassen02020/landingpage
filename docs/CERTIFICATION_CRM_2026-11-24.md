# Rapport de certification CRM — 24/11/2026

**Périmètre : Landing Page / Growth OS (base `tdexdlukqciolslvjmhd`). EasyV4 n'est ni lu ni modifié.**
**Mode : lecture seule en production. Aucun développement, aucune migration, aucune écriture.**
Production : `main` = `49676fd`, déployé. Migrations appliquées jusqu'à `0030` (24/11).

## 1. Décision du propriétaire enregistrée
**D5 = exclusion sans colonne.** Les doublons confirmés sont exclus de l'export CSV ; aucune colonne de marquage n'est ajoutée. Preuve : filtre central `selectRealLeads`, test `tests/duplicates-server.test.ts` (export).

## 2. Livré et en production
| Lot | PR | État |
|---|---|---|
| Conversations (1a) | #84 | FUSIONNÉ, DÉPLOYÉ |
| Relances « À traiter » (lecture seule) | #85 | FUSIONNÉ, DÉPLOYÉ |
| Canaux (preuve par événement réel) | #86 | FUSIONNÉ, DÉPLOYÉ |
| Segments D1/D2 | #87 | FUSIONNÉ, DÉPLOYÉ, **NON CERTIFIÉ** (audit connecté à faire) |
| Doublons G1+G3 (migration 0030 appliquée avant déploiement) | #88 | FUSIONNÉ, DÉPLOYÉ, **NON CERTIFIÉ** |

## 3. Les cinq vérifications demandées
| # | Vérification | Résultat | Niveau de preuve |
|---|---|---|---|
| 1 | Audit connecté D1/D2 | Protocole mis à jour (`docs/AUDIT_CONNECTE_D1_D2.md`) : valeurs de référence recalculées (6 clients, 5 éligibles marketing, « À traiter » 3, « Omra sans réservation » 3 membres / 2 éligibles / 1 exclu) | **À exécuter par un administrateur autorisé** |
| 2 | Droits employé / Manager / Admin dans l'interface réelle | Matrice complète prouvée par tests unitaires et e2e (employé voit tout, ne modifie que ses dossiers ; Manager décide des doublons mais jamais les siens ; réouverture Admin seul ; Super Admin sans contenu de lead). **Non vérifiable en réel** : la production n'a que 2 comptes administrateur | Tests : OUI · Réel : **NON** |
| 3 | Doublons dans l'interface réelle | 4 paires candidates détectables en lecture seule. Aucun signalement créé, aucune donnée fictive. Signaler, confirmer, rouvrir écrivent des données réelles : décision du propriétaire | Détection : lue · Écritures : **NON testées en réel** |
| 4 | Cohérence anciennes données et statistiques | Lecture SQL : dossiers, activités, conversions et migrations cohérents ; empreinte d'intégrité inchangée (`60f394e0…`) avant/après 0030 ; aucun doublon confirmé, donc aucun chiffre modifié ; anciennes activités conservées | **OUI** (lecture seule) |
| 5 | Rapport final et ROADMAP | Ce document + entrée ROADMAP | Fait |

## 4. Ce qui reste NON certifié
- D1/D2 et doublons dans l'interface connectée (aucun compte autorisé côté Claude, et Claude n'en demande jamais les identifiants).
- Droits Manager et employé en réel (comptes inexistants en production).
- Meta : aucun événement réel envoyé pour le contrôle des doublons ; correction d'un Purchase déjà reçu non vérifiée (D3 : aucune correction).
- Purchase retenu puis libéré : Meta refuse un événement de plus de 7 jours ; TikTok sans journal de relance (en pause).
- 10 ans de conservation : non validé avant examen juridique. Seuils de relance (60 min / 4 h / 3 jours) : propositions, jamais appliqués automatiquement.

## 5. Portes en attente d'un GO explicite
| Porte | Contenu |
|---|---|
| P1 | PR de documentation (ce rapport, protocole d'audit, ROADMAP) |
| P2 | Création de comptes Manager et employé de test (écriture production) pour vérifier les droits en réel |
| P3 | Audit connecté D1/D2 + doublons (réalisé par le propriétaire ou un administrateur désigné) |
| P4 | Éventuel signalement réel d'un doublon (écriture), si le propriétaire veut tester le parcours en réel |

Statut global : **VALIDÉ PAR TESTS, DÉPLOYÉ — certification de production NON prononcée** tant que P2/P3 ne sont pas faits.

## 6. Mise à jour du 25/11/2026 — audit connecté de l'Administrateur
- Étapes 1 à 8, 12 et 14 vérifiées dans l'interface réelle : conformes (voir `docs/AUDIT_CONNECTE_D1_D2.md` §4). Console sans erreur sur « Segments ».
- Constat : le pipeline affiche les dossiers de test (11 au total) ; décision éventuelle de les masquer = développement, GO requis.
- Écriture W1 autorisée : dossier de test `9c9f5f5b` marqué `is_test`. Réel : 9 dossiers.
- **D1/D2 : certifiés pour le rôle Administrateur** (sous réserve de la console de « Doublons »). Rôles Super Admin, Manager, employé : non vérifiés en réel (P2).
- Doublons : parcours d'écriture (signaler, confirmer, rouvrir) non testé en réel (P2 puis P4).
