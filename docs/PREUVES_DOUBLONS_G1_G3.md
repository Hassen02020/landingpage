# Dossier de preuves — doublons de dossiers (G1 migration 0030 + G3 code) — 23/11/2026

**Statut : préparé et prouvé EN LOCAL. Rien n'est appliqué en production, rien n'est fusionné, rien n'est déployé.** G2 (application de la migration) et G4 (fusion et déploiement) attendent un GO explicite du propriétaire.

## 1. Identification
| Élément | Valeur |
|---|---|
| Dépôt | `Hassen02020/landingpage` |
| Branche | `feat/doublons-g1-migration-0030` (aucune PR ouverte) |
| Base | `origin/main` = `c1232f2` (PR #87, code actuellement en production) |
| Code testé | `38c90f7`. Le commit suivant (`190103d`) ne fait que retirer des captures d'écran hors périmètre : **0 fichier de code modifié** entre les deux |
| Périmètre | 26 fichiers, 1641 ajouts, 64 suppressions, **0 fichier hors chantier** |
| Projet | Landing Page / Growth OS (base `tdexdlukqciolslvjmhd`). EasyV4 n'est ni lu ni modifié |

## 2. Résultats d'exécution (même SHA `38c90f7`, mêmes commandes que la CI)
| Contrôle | Résultat |
|---|---|
| Typage `tsc --noEmit` | **0 erreur** |
| Tests unitaires et de migration (`vitest run`) | **128 fichiers, 1323 tests, tous passés** |
| E2E navigateur, série complète (même liste que `.github/workflows/ci.yml`) | **9 scripts sur 9 passés, 571 contrôles, 0 échec** |

Détail e2e : multi-entreprises 133 · admin 174 (dont 13 de doublons) · créateur 138 · consentement 15 · collecte 27 · parcours Omra 9 · WhatsApp 28 · avis 22 · réseaux sociaux 25.
Les journaux bruts sont dans `/tmp/claude-0/e2e-all/` (session) ; la CI de la future PR les rejouera à l'identique.

## 3. Ce qui a été prouvé, par exigence
| Exigence | Preuve |
|---|---|
| Règles 15 min / 30 jours / intérêt renouvelé | `tests/duplicates.test.ts` : frontières (14 min, 15 min, 15 min + 1 s, 29 j, 30 j, 30 j + 1 s) ; au-delà de 30 jours, aucun signalement |
| Rapprochement = signalement, jamais preuve | Offre ou départ inconnus : confiance « faible » ; offre ou départ différents : aucun candidat |
| Aucune fusion ni suppression | Tests serveur : aucune écriture sur `landing_leads` ; e2e : aucune requête `DELETE` ; migration : pas de droit `DELETE` |
| Le statut du dossier ne change jamais | Serveur et e2e : statut identique avant et après signalement et confirmation ; l'ancien passage à « perdu » est supprimé |
| Notes préservées | Serveur : la note du dossier s'**ajoute** (jamais d'écrasement) ; trop longue : non modifiée, l'historique garde tout |
| D1 — double regard sans exception | Base : contrainte `four_eyes` (preuve par mutation : sans elle le test échoue) ; code : même Admin refusé ; e2e : l'auteur n'a pas de bouton « Confirmer » |
| D2 — réouverture Admin seul | Permissions testées ; serveur : Manager et conseiller refusés ; e2e : l'Admin rouvre |
| Conseiller signale, Manager décide | Matrice complète testée ; e2e : l'agent n'a ni menu ni page des doublons |
| Cloisonnement par entreprise | Base : même entreprise obligatoire ; code : dossier d'une autre entreprise introuvable ; e2e multi-entreprises : **toutes** les lectures filtrées par organisation (a détecté un oubli, corrigé, voir §4) |
| Doublon confirmé exclu des chiffres | Serveur : clients 360, filtre central, ventes et chiffre d'affaires (2 ventes / 1000 TND avant, 1 vente / 500 TND après) ; e2e : absent du pipeline ; consultable par sa fiche |
| Une réservation = une vente = un Purchase | Serveur : arrêt avec la liste des dossiers, rien d'écrit, aucun Purchase ; « réservation distincte » avec motif : un Purchase, décision tracée ; réservé puis gagné : un seul Purchase ; preuve par mutation (sans le contrôle, 3 tests échouent) |
| D4 — contrôle indisponible | Serveur : réservation enregistrée, Purchase **retenu** (journal « ignoré », raison « doublon:… »), jamais envoyé |
| D3 — Purchase déjà envoyé | Serveur : état « envoyé » enregistré, avertissement, **aucun** envoi correctif à Meta |
| Purchase retenu : libéré ou jamais envoyé | Rejet : libéré pour la relance habituelle ; confirmation : reste ignoré pour toujours ; la relance n'envoie jamais un doublon confirmé |
| D6 — commission ou coût rattaché | Serveur : confirmation bloquée avec le détail, débloquée après réaffectation ; rattachements futurs ignorent les doublons confirmés |
| D7 — principal proposé | Fonction pure testée : dossier portant le Purchase envoyé, sinon le plus ancien |
| D5 — export CSV | Passe par le filtre central : les doublons confirmés en sortent. **Aucune colonne de marquage ajoutée** (décision « si nécessaire pour EasyV4 » en attente) |
| Aucune donnée personnelle dans les traces | Serveur et e2e : ni téléphone ni nom dans les activités, le journal d'audit ni les signalements |
| Migration sûre et réversible | 13 tests PGlite : contraintes, déclencheurs, droits, garde « refuse sur EasyV4 », retour arrière refusé s'il existe des données, rejouable ; contrôle après application : 10 lignes OK |
| Code tolérant avant la migration | Filtre central testé : colonne absente tolérée, reprise après 1 minute ; les pages signalent « migration non appliquée » |

## 4. Anomalies trouvées PAR les tests pendant la préparation (toutes corrigées)
1. **Cloisonnement oublié** : `landing_duplicate_reviews` n'était pas dans `TENANT_TABLES` ; le contrôle d'isolation de l'e2e multi-entreprises l'a détecté (1 lecture sans filtre d'organisation). Corrigé, puis 133 sur 133.
2. **Typage du test serveur** : erreurs de `tsc` que `vitest` ne voit pas (étape « Typecheck » de la CI). Corrigé.
3. **Filtre `or` non supporté** par le faux serveur de test : les signalements d'un dossier sont désormais lus en deux requêtes simples.
4. **Test historique obsolète** : l'ancien parcours « marquer comme doublon → perdu » a été remplacé par le signalement (comportement voulu).
5. **Test de gouvernance** : le nouveau fichier `duplicates.ts` lit des références de dossiers ; déclaré explicitement dans la liste du garde-fou, avec justification.
6. **Captures hors périmètre** : 30 captures d'écran du créateur, régénérées par un e2e, s'étaient glissées dans un commit ; retirées dans un commit dédié.

## 5. Ce qui n'est PAS prouvé (limites à connaître)
- **Production** : rien n'a été appliqué ni lu au-delà des constats en lecture seule. La migration n'a été exécutée que sur PostgreSQL de test (PGlite), jamais sur la base réelle.
- **Interface réelle connectée** : les parcours navigateur utilisent un **faux Supabase** (sans les vrais déclencheurs ; la synchronisation `duplicate_of` y est émulée et vérifiée séparément par les tests de migration). L'audit connecté par un administrateur autorisé reste à faire après déploiement.
- **Meta** : aucun événement réel n'a été envoyé ou testé. Ce que Meta accepte comme correction d'un Purchase déjà reçu n'est **pas vérifié** (D3 : aucune correction).
- **Purchase retenu puis libéré** : (a) il repart par la relance Meta, qui **refuse un événement de plus de 7 jours** : une libération tardive peut expirer ; (b) **TikTok** n'a pas de journal de relance : un Purchase retenu n'est pas renvoyé à TikTok à la libération (TikTok est en pause).
- **Offre et départ** : seule une partie des dossiers porte un identifiant d'offre (4 sur 10 en production) ; sinon la détection repose sur le libellé normalisé, avec confiance « faible » en cas de doute.
- **Pas de page d'alerte** « signalements en attente » dans le tableau de bord (amélioration secondaire, non faite).

## 6. Risques résiduels et retour arrière
| Risque | Parade |
|---|---|
| Une vente légitime bloquée à tort | L'arrêt ne survient que si un autre dossier du même client, même produit, même offre est déjà réservé ; « réservation distincte » avec motif débloque immédiatement ; une panne technique ne bloque pas la vente |
| Un doublon confirmé qui avait déjà un Purchase envoyé | Prévention ; principal proposé = dossier portant le Purchase envoyé ; écart Meta contre CRM signalé ; aucune correction automatique |
| Retour arrière de la migration | `supabase/rollback/0030_rollback.sql` : **refusé** s'il existe des signalements, des doublons confirmés ou des activités de doublon (exporter d'abord) |
| Retour arrière du code | Revert de la PR ; les colonnes absentes sont tolérées par le code ; l'ancien marquage « perdu » n'est pas rétabli (il n'a jamais été utilisé en production : 0 note « Doublon de… ») |

## 7. Portes restantes (aucune n'est franchie)
| Porte | État | Condition |
|---|---|---|
| G2 — appliquer 0030 en production | **EN ATTENTE** | Examen du SQL par le propriétaire ; lecture avant/après ; contrôle `postcheck-0030.sql` à 10 lignes OK |
| G4 — fusion et déploiement | **EN ATTENTE** | PR ouverte, CI verte (`verify` et `e2e`), ordre « migration puis déploiement » |
| Audit connecté | **À FAIRE** après G4 | Administrateur autorisé, sans donnée fictive en production |
| Question ouverte D5 | **EN ATTENTE** | Marquage dans l'export seulement si l'import EasyV4 l'exige |
