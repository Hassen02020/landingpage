# Rapport de certification — Intelligence, évènements Meta, parcours commercial, rentabilité

Date : 17/11/2026 — code certifié : `main` à `aa843e7` (+ correctifs de la présente PR) — production : déploiement `dpl_B5ZfTMLzRdWkrBRLMCtDTRih9BjM`.
Méthode : lecture seule en production (schéma, droits, comptages), 1 130 tests unitaires, 9 parcours e2e contre un faux Supabase. **Aucun évènement Meta réel, aucun formulaire en production, aucune écriture en base.**

## Décision
**CERTIFIÉ AVEC RÉSERVES** pour le socle technique (sécurité, cloisonnement, évènements Meta, parcours commercial, logique de rentabilité).
**NON CERTIFIABLE sur chiffres réels** pour la rentabilité : la production contient 0 réservation, 0 dépense, 0 commission, 0 coût. Aucune décision d'investissement ne doit s'appuyer sur ces vues avant des ventes réelles.

## P0-1 Sécurité et intégrité financière — CERTIFIÉ
| Contrôle | Preuve | Résultat |
|---|---|---|
| Sécurité par ligne (RLS) | production : 25 tables sur 25 avec RLS activée | OK |
| Accès anonyme | production : `anon` n'a aucun droit SELECT/INSERT sur les tables Landing | OK |
| Comptes connectés | lecture seule limitée à 7 tables, par appartenance à l'entreprise (`landing_member_role(organization_id)`) ; **aucun droit UPDATE** | OK |
| Données financières | dépenses, commissions, coûts : RLS sans aucune politique = inaccessibles hors serveur | OK |
| Cloisonnement entre entreprises | e2e multi-entreprises : 133 vérifications OK (leads, clients, export CSV, stats, liens, avis) | OK |
| Permissions par rôle | e2e admin : 130 vérifications OK ; employé : pas de Vue d'ensemble, Qualité des données ni Rentabilité, même en accès direct | OK |
| Exclusion des tests | filtre `is_test` sur 7 chargements d'analyse + test garde-fou ; production : 1 test exclu / 7 vrais leads | OK |
| Cohérence des ventes | production : 0 vente sans date/montant, 0 date de réservation sans vente ; contrainte `landing_leads_booking_consistency` + trigger de garde | OK |
| Marges | 56+ tests de formules ; scénario exact (dépenses 400, commission 1 500, coût 100 → marge confirmée 1 000 ; avec provisoire 1 300) sur 6 vues | OK |

## P0-2 Évènements Meta — CERTIFIÉ AVEC RÉSERVES
- **Lead** : un seul par prospect, même `event_id` que le pixel navigateur (déduplication Meta), consentement de suivi obligatoire, doublon/rejeu = aucun second Lead. OK.
- **QualifiedLead** : première qualification seulement, `event_id = qualified-<lead>`, sans valeur monétaire, données hachées, jamais depuis le navigateur. OK.
- **Purchase** : une fois par lead (date de réservation posée une fois), `event_id = purchase-<lead>`, valeur = montant de la réservation. OK.
- **Correctif de cette PR :** un lead marqué **TEST** qui passait à « qualifié » ou « réservé » envoyait de vraies conversions à Meta. Corrigé (aucun envoi pour un lead de test) + test.
- **Réserves :** (R2) aucun **journal** des conversions envoyées (erreurs seulement en console) et aucune **relance** : si Meta est indisponible au moment de la vente, la conversion est perdue définitivement. (R5) Purchase envoie le **chiffre d'affaires**, pas la marge : décision commerciale à prendre. (R8) Premier envoi réel de QualifiedLead non testé chez Meta : utiliser `META_TEST_EVENT_CODE`.

## P1-3 Parcours commercial — CERTIFIÉ (logique)
Test de bout en bout `tests/certification-parcours.test.ts` : lead Facebook (campagne, ensemble, annonce, région) → contacté → qualifié → devis → négociation → réservé → gagné/perdu/rouvert → client « Fidèle » → marge. Une vente, un QualifiedLead, un Purchase ; annulation + remboursement : la vente retombe et la marge reste honnête. Non vérifié en production (aucun parcours réel).

## P1-4 Rentabilité — LOGIQUE CERTIFIÉE, DONNÉES NON CERTIFIABLES
Formules, anti-double comptage, répartition au prorata marquée « estimée », échantillon minimal de 5 réservations confirmées, vues par campagne / produit / annonce / ensemble / région / tranche d'âge : tests OK. **Production : 0 dépense, 0 commission, 0 coût, 0 réservation** (R6).

## P1-5 Qualité des données (production, comptages)
| Contrôle | Valeur |
|---|---|
| Leads (réels / test) | 7 / 1 |
| Leads sans région | 7 sur 7 |
| Leads Meta sans campagne | 5 (liens non balisés, antérieurs à la campagne) |
| Noms de campagne hors convention | 0 |
| Leads perdus sans motif | 1 |
| Réservations sans commission | 0 (aucune réservation) |
| **Leads sans premier contact depuis plus de 24 h** | **6 sur 7 (point d'attention opérationnel n°1)** |
| Numéros présents dans plusieurs leads | 2 |
| Dépenses / commissions / coûts enregistrés | 0 / 0 / 0 |

## P2-6 Tableau de décision
Vue d'ensemble et Qualité des données livrées (indicateurs réellement disponibles, alertes tirées des seuls chiffres, « données insuffisantes » sous 5 réservations). Vérifiées en local (bureau et mobile, rôles) ; **non vérifiées connecté en production**. Aucune recommandation automatique tant qu'il n'y a pas de ventes (décision de la Phase 1).

## Corrections de la présente PR
1. Aucune conversion Meta pour un lead de test (code + 6 tests).
2. Faux Supabase des e2e : `is_test` absent = lead réel (comme en base). Sans cela, 9 vérifications e2e échouaient à tort depuis la PR #71.
3. Attentes e2e périmées remises à jour : bandeau de consentement arabe sur `/omra` ; 14 modèles ; Ramadan = 8 conditions et témoignages masqués par défaut.

## Réserves restantes
| # | Réserve | Gravité | Proposition |
|---|---|---|---|
| R1 | Correctif « lead de test » pas encore en production | élevée | fusionner et déployer cette PR |
| R2 | Pas de journal ni de relance des conversions Meta | moyenne | table de journal + relance (migration, GO séparé) |
| R3 | La CI n'exécute pas les parcours e2e (9 échecs sont passés inaperçus) | moyenne | ajouter les e2e à la CI |
| R4 | Production non vérifiée connecté (pas de compte de test) | moyenne | session de contrôle guidée avec le propriétaire |
| R5 | Purchase envoie le chiffre d'affaires, pas la marge | à décider | décision commerciale |
| R6 | 0 vente / dépense / commission : rentabilité non certifiable sur chiffres réels | élevée | saisir les dépenses Meta, importer les commissions |
| R7 | 6 leads réels non traités > 24 h ; 5 Meta sans campagne ; 0 région | élevée (commerciale) | traiter les leads ; balisage obligatoire |
| R8 | QualifiedLead jamais envoyé réellement | moyenne | test avec `META_TEST_EVENT_CODE` |
| R9 | Limite de débit et anti-doublon mémoire par instance (la base garantit l'unicité) | faible | pare-feu Vercel en complément |
