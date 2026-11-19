# Intelligence Center — Phase 1 (menu + qualité des données)

Décisions du propriétaire (16/11/2026) : cadre « Easy2Book Intelligence OS » (5 moteurs, moteur de décision). **Phase 1 = ossature + gouvernance minimale, sans recommandation automatique.**

## Principes
- On affiche ce que les données permettent de dire, rien de plus : un petit échantillon est signalé (« Données insuffisantes : 2 réservation(s), 5 minimum pour comparer »), jamais masqué.
- Observé, estimé et prévu sont distincts. La Phase 1 n'affiche que de l'**observé**.
- Aucun âge ni sexe déduit d'un nom ou d'une photo. Aucune donnée externe mélangée aux réservations.
- Droits inchangés : vue d'ensemble et qualité des données = `reports.view` (responsables) ; chiffres financiers = `ads.view`. Aucun contenu de lead n'est affiché (comptages seulement).

## Contenu
| Élément | Fichier |
|---|---|
| Menu (définition pure, testée) : groupe « Analyse » renommé « Intelligence », + « Vue d'ensemble » et « Qualité des données » | `lib/admin-nav.ts` |
| Logique pure : `sampleState`, `qualityReport`, `overviewAlerts` | `lib/intelligence.ts` |
| Chargement lecture seule, avec repli selon les colonnes présentes | `lib/server/intelligence.ts` |
| Pages | `app/admin/(crm)/intelligence/page.tsx`, `.../qualite/page.tsx` |
| Composant « données insuffisantes » | `app/admin/(crm)/_components/DataGuard.tsx` |

## Contrôles de qualité (PR A, sans migration)
Leads sans région · Leads Meta sans campagne · Noms de campagne hors convention · Sans consentement de suivi · Non traités depuis plus de 24 h · Réservations sans commission importée (droit `ads.view` seulement ; sinon « non disponible », jamais 0).
Contrôles dépendant de la migration de gouvernance (PR B) : leads de test (exclus), pertes sans motif, réservations sans produit acheté — déclarés **indisponibles** tant que la migration n'est pas appliquée.

## Tests
`tests/intelligence.test.ts`, `tests/intelligence-loader.test.ts` ; menu e2e mis à jour (`tests/e2e/admin-flow.e2e.mjs`).

## PR B — gouvernance des données (migration 0026 ÉCRITE, NON APPLIQUÉE)
| Colonne (`landing_leads`) | Rôle |
|---|---|
| `is_test` booléen, défaut faux | lead de test : exclu des statistiques, entonnoir, rentabilité, WhatsApp, tableau de bord, clients/segments et export ; reste visible (badge « TEST ») dans la liste et la fiche |
| `lost_reason` (9 valeurs) | motif de perte, facultatif ; effacé si le lead quitte « perdu » |
| `purchased_product` (omra / voyage / hotel / autre) | produit réellement acheté, choisi à la réservation (pré-rempli avec le produit demandé) |

- **Droits :** marquer / démarquer un test = `reports.view` (responsables). Motif et produit acheté : tout conseiller qui peut changer le statut du lead.
- **Compatible avant la migration :** `selectRealLeads` (lib/server/lead-scope.ts) lit sans filtre tant que la colonne manque et retente le filtre toutes les minutes ; l'écriture du statut retombe sur l'ancien patch ; la page Qualité des données déclare les contrôles indisponibles.
- **Garde-fou de test :** `tests/data-governance.test.ts` échoue si un nouveau fichier serveur lit `landing_leads` sans passer par `selectRealLeads` (liste d'exceptions justifiée).
- **Fichiers :** `supabase/migrations/0026_data_governance.sql`, `supabase/rollback/0026_rollback.sql` (refusé si des données existent), `supabase/scripts/postcheck-0026.sql` (4 contrôles), `tests/migration-0026.test.ts` (PostgreSQL de test).
- **À faire par le propriétaire, après ses GO distincts :** appliquer la migration (condition de sécurité + contrôle postcheck), puis déployer. Marquer le lead de test existant `d3518f63-b61f-4c47-a4fd-958dab2888bf` = une seule écriture, soumise à un GO séparé.

## Lot 6 — Tranche d'âge DÉCLARÉE (migration 0027 ÉCRITE, NON APPLIQUÉE ; champ désactivé par défaut)
- **Principes :** facultative ; choisie librement par le visiteur (18-24, 25-34, 35-44, 45-54, 55+, ou « je préfère ne pas répondre » = rien d'enregistré) ; **jamais déduite** d'un nom ou d'une photo ; **jamais envoyée** à Meta ni à TikTok (test) ; jamais pour une entreprise cliente (formulaires `/o/…`).
- **Activation page par page** dans le Créateur (case « Demander la tranche d'âge »), **désactivée sur tous les modèles**. À n'activer qu'après validation du texte d'information.
- **Texte d'information proposé (à valider par le propriétaire)** — FR : « Facultatif : votre tranche d'âge nous aide à adapter nos offres. Elle n'est pas partagée avec des tiers. » ; EN : « Optional: your age range helps us tailor our offers. It is not shared with third parties. » ; AR : « اختياري: تساعدنا فئتك العمرية على تحسين عروضنا. لا تتم مشاركتها مع أي طرف ثالث. » (`lib/age-range.ts`).
- **Compatible avant la migration :** la valeur est retirée de l'enregistrement si la colonne manque (le lead n'est jamais perdu) ; la vue « Tranche d'âge » de la rentabilité (lot 4) lit avec repli.
- **Fichiers :** `supabase/migrations/0027_age_range.sql`, `supabase/rollback/0027_rollback.sql` (refusé si des données existent), `supabase/scripts/postcheck-0027.sql` (3 contrôles), `tests/migration-0027.test.ts`, `tests/age-range.test.ts`.
- **Décision laissée au propriétaire :** à l'anonymisation d'un lead, la tranche d'âge (non identifiante seule) est conservée comme donnée statistique ; dites-le si elle doit être effacée.

## Lot 5 — Évènement « lead qualifié » vers Meta
- **Définition (validée par le propriétaire) :** la **première** fois qu'un lead atteint « qualifié » **ou plus loin** (devis, négociation, réservé, gagné), une seule fois par lead ; jamais rejoué si le lead revient en arrière puis est requalifié, ni s'il est perdu puis rouvert.
- **Évènement** : `QualifiedLead` (personnalisé), envoyé côté serveur par `changeStatus`, avec `event_id = qualified-<id du lead>`, **sans valeur monétaire**, téléphone et prénom hachés, **seulement si le visiteur a accepté le suivi**. TikTok non concerné.
- **Jamais depuis le navigateur** : absent de `ALLOWED_EVENTS` (test).
- **En cas de doute** (lecture de l'historique impossible) : rien n'est envoyé. Meta non configuré : statut enregistré, pas de fausse mention « envoyé ».
- Une réservation directe envoie `QualifiedLead` puis `Purchase` (deux évènements distincts).
- **Test sur le pixel :** utiliser `META_TEST_EVENT_CODE` (Meta → Gestionnaire d'évènements → Tester les évènements) avant le premier envoi réel. Aucun évènement artificiel n'a été envoyé pendant le développement.
- Une fois l'évènement reçu par Meta, il apparaît comme évènement personnalisé et peut servir d'objectif d'optimisation (à choisir dans Ads Manager, décision du propriétaire).

## Lot 4 — Rentabilité par région, ensemble de publicités, annonce et tranche d'âge déclarée
- Nouvelles vues de `/admin/rentabilite/analyse` : **Ensemble de publicités** (`utm_term`, à défaut `adset_id`), **Annonce**, **Région**, **Tranche d'âge (déclarée)** ; les vues Réseau, Campagne, Produit et Niche sont inchangées.
- La dépense d'une campagne est **répartie au prorata des leads** dans ces vues : elle est marquée « estimée » (≈), jamais présentée comme réelle. Les totaux restent exacts.
- **Échantillon** : chaque ligne sous 5 réservations confirmées affiche « échantillon insuffisant : X lead(s), Y réservation(s) confirmée(s) sur 5 minimum ». Aucune ligne n'est « gagnante » sans ce minimum.
- Lecture de repli selon les colonnes présentes (tranche d'âge avant sa migration, région avant 0006) ; les leads de test sont exclus (`selectRealLeads`).
- Correctif : `selectRealLeads` ne conclut « colonne `is_test` absente » que si le message de la base nomme `is_test` ; une autre colonne manquante (ex. tranche d'âge) ne désactive jamais l'exclusion des tests.
- Jeu de données des tests **fictif et déclaré comme tel** ; aucune conclusion commerciale n'est tirée de ces vues tant qu'il n'y a pas de réservations réelles.

## Journal et relance des conversions Meta (migration 0028 ÉCRITE, NON APPLIQUÉE)
- **Problème corrigé :** sans journal, une vente ou une qualification non reçue par Meta (panne, jeton expiré) était perdue pour toujours (la date de réservation n'est posée qu'une fois) et rien ne prouvait ce qui avait été envoyé.
- **Table `landing_conversion_log` :** une ligne par conversion (Lead, QualifiedLead, Purchase) avec état (`pending`, `sent`, `failed`, `skipped`, `expired`), tentatives, prochaine tentative, raison technique courte. **Aucune donnée personnelle** (la charge utile est reconstruite depuis le lead). Unicité (entreprise, réseau, identifiant d'évènement) : jamais deux envois du même évènement. Serveur seulement, UPDATE autorisé, jamais DELETE.
- **Relance :** jusqu'à 5 tentatives (15 min, 1 h, 6 h, 24 h), même identifiant, même heure d'évènement et même valeur ; **jamais** pour un lead de test, sans consentement de suivi ou anonymisé ; abandon après 7 jours (limite de Meta). Cron quotidien `/api/cron/retry-conversions` (protégé par `CRON_SECRET`, comme la publication programmée) + bouton « Relancer maintenant » sur la page Qualité des données.
- **Compatible avant la migration :** aucun journal, comportement historique ; la page Qualité des données déclare le contrôle indisponible.
- **Prérequis :** 0026 seulement (indépendante de 0027). Fichiers : `supabase/migrations/0028_conversion_log.sql`, `supabase/rollback/0028_rollback.sql` (refusé si le journal contient des lignes), `supabase/scripts/postcheck-0028.sql` (5 contrôles), `tests/migration-0028.test.ts`, `tests/conversion-log.test.ts`.
- **Limite connue :** le cron Vercel Hobby est quotidien : une conversion échouée est rattrapée au plus tard le lendemain matin (ou immédiatement par le bouton).

## Tableau dirigeant — les cinq questions (`/admin/intelligence/dirigeant`)

Une page, cinq réponses, chacune avec sa fiabilité (« Chiffre exact », « Partiel » ou « Non disponible ») :

1. **Combien dépensé ?** Dépenses saisies dans Rentabilité. Aucune dépense saisie : « non disponible » (jamais 0). Dépense sans lead rattaché : « partiel ».
2. **Combien de qualifiés ?** A atteint « qualifié » ou plus loin, avec le coût par lead qualifié si des dépenses existent.
3. **Combien de réservations ?** Comptées une seule fois, avec le coût par réservation si calculable.
4. **Combien gagné ?** Marge nette sur commissions CONFIRMÉES seulement. « Partiel » tant que des réservations n'ont pas de commission importée ; les provisoires ne sont jamais comptées.
5. **Quelle campagne financer ?** Reprend la gagnante du moteur de rentabilité (résultat positif, dépenses, au moins 5 réservations confirmées). Sinon : « Aucune pour l'instant » avec la raison.

Droits : page « reports.view » ; les questions financières (1, 4, 5) exigent « ads.view », sinon elles s'affichent « non disponible ». Aucune donnée personnelle. Code : `lib/executive.ts` (pur, testé), `loadExecutive` dans `lib/server/intelligence.ts`. Aucune migration.

## Import des dépenses Meta (CSV) et motif de perte obligatoire

**Import des dépenses (`/admin/rentabilite`, section « Importer les dépenses Meta »).** Export CSV d'Ads Manager, colonnes « Jour », « Nom de la campagne », « Montant dépensé (USD) » (ou `montant_tnd`). Aperçu obligatoire avant toute écriture. Montant dans une autre devise que le TND : le propriétaire saisit le taux, jamais deviné. Nom de campagne hors convention : ligne refusée. Une ligne déjà importée (même jour, même campagne) n'est jamais doublée ; si le montant a changé, elle est signalée « conflit » (annuler l'ancienne dépense, puis ré-importer). Écritures au registre à ajout seul, réseau Meta, `source = manuel`, référence `import-meta:<date>:<campagne>`. Aucune migration. L'API Marketing de Meta (automatique) reste à décider (jeton à saisir par le propriétaire).

**Motif de perte obligatoire.** Passer un lead à « perdu » depuis la fiche exige un motif ; depuis le pipeline, l'utilisateur est renvoyé vers la fiche ; les actions groupées « perdu » sont refusées. Le marquage « doublon » et l'API (motif facultatif `lost_reason`) restent possibles. Code : `lossReasonError` dans `lib/governance.ts`.
