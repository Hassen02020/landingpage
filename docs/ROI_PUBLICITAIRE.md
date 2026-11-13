# Rentabilité publicitaire — « Tests publicitaires & niches rentables » (chantier ADS)

Décisions du propriétaire (12/11/2026) : dépenses saisies à la main (API plus tard, historique conservé) · EasyV4 = référence financière (aucune dépendance directe à sa base : import contrôlé, données provisoires clairement identifiées) · marge = commission nette · étapes cumulatives par l'historique des statuts.

## Formules (fonction pure `lib/ad-economics.ts`)
| Indicateur | Formule | Cas particulier |
|---|---|---|
| Résultat | commission nette − dépenses | |
| Rentabilité | commission nette ÷ dépenses × 100 | dépenses = 0 → **non calculable** (jamais 0 %) |
| CPL, coût par qualifié / devis / réservation | dépenses ÷ effectif | dépenses = 0 ou effectif = 0 → non calculable |
| Taux de qualification / devis / réservation | effectif ÷ leads × 100 | leads = 0 → non calculable |
| Qualifié | a atteint « qualifié » ou plus loin | un dossier perdu après qualification reste compté |
| Devis | a atteint « devis » ou plus loin | un dossier perdu après devis reste compté |
| Réservation | dossier **actuellement** réservé ou gagné | une annulation le retire (et sa commission est corrigée) |

Chaque dossier est compté **une fois** par étape. Calcul en **millimes** (entiers) : aucune erreur d'arrondi. Exemple : 1 000 TND de dépenses, 3 000 TND de commissions nettes → résultat +2 000 TND, rentabilité 300 % (testé).

## Gagnante
Meilleur **résultat** (pas le plus de leads), avec dépenses > 0, résultat > 0 et **au moins 5 réservations** (seuil réglable). Sinon : « aucune gagnante » avec la raison.

## Données (migration 0016, à appliquer par le propriétaire — NON appliquée)
- `landing_ad_spend` : date, réseau (`meta`/`tiktok`), campagne (nom normalisé automatiquement), montant TND, référence facultative, **source** (`manuel` / `api_meta` / `api_tiktok`). **Ajout seul** ; une erreur se corrige par une écriture d'annulation (montant opposé exact, même campagne, même date, une seule fois).
- `landing_commissions` : registre **à ajout seul** importé d'EasyV4 : référence de la réservation EasyV4, nature (`commission` positive, `annulation` / `remboursement` négatifs), statut **provisoire** puis **confirmé** (une seule fois, par un administrateur), clé d'idempotence (réimporter un fichier ne crée aucun doublon).
- Cloisonnées par entreprise ; aucun droit pour les comptes d'utilisateurs ; seul le serveur y accède. Le lead d'une commission doit appartenir à la même entreprise (déclencheur).
- Contrôle : `supabase/scripts/postcheck-0016.sql` (6 lignes OK). Retour arrière : `supabase/rollback/0016_rollback.sql` (refusé si des données existent).

## Hypothèses retenues (à confirmer — les 4 points restés sans réponse)
1. Rapprochement EasyV4 ↔ lead par la **référence E2B-XXXXXX** du lead ; à défaut téléphone + date avec validation manuelle.
2. Dépenses rattachées aux leads par **réseau + nom de campagne normalisé** (même nom que `utm_campaign`) ; sinon liste « non rattachées ».
3. Seuil d'échantillon : 5 réservations.
4. Confirmation d'une commission par un administrateur, après contrôle contre EasyV4.

## Suite
PR 2 : saisie des dépenses + import des commissions (aperçu avant validation). PR 3 : écran « Tests publicitaires & niches rentables » (réseau, campagne, niche, produit, annonce, période). Intégration automatique EasyV4 / API Meta et TikTok : après définition de l'export (aucun accès à EasyV4 n'est utilisé).

## PR 2 — Dépenses et commissions (écran `/admin/rentabilite`)

- **Dépenses** : saisie manuelle (date ≤ aujourd'hui, réseau Meta/TikTok, campagne, montant TND, référence facultative). Ajout seul : une erreur se corrige par une **annulation** (écriture opposée exacte), jamais par modification. Une annulation ne s'annule pas ; une dépense ne s'annule qu'une fois.
- **Commissions EasyV4** : import CSV contrôlé (`reservation_ref ; nature ; montant_tnd ; date ; lead_ref ; telephone ; ligne`). Le signe est décidé par la nature (commission +, annulation/remboursement −). Aperçu obligatoire avant écriture ; rapprochement par référence dossier `E2B-XXXXXX` (sûr) ou par téléphone (à valider ligne par ligne) ; téléphone ambigu = jamais importé ; réservation rattachée à deux dossiers = conflit. Import idempotent (clé `réservation|nature|ligne`), tout est importé « provisoire », confirmation explicite ensuite.
- **Droits** : `ads.manage` (admin) écrit ; `ads.view` (manager) lit. Employé : aucun accès. Isolation par entreprise.
- **Prérequis** : migration 0016 (non appliquée par Claude). Sans elle, l'écran est en lecture seule et l'indique.
- Tests : `commission-import`, `ad-spend-commissions` (isolation, idempotence, conflits, confirmation unique, migration absente).

## Marge nette réellement conservée (migration 0017)

**Marge nette = commission nette − publicité − coûts variables.** Une publicité n'est gagnante que si elle rapporte une marge nette conservée, pas des réservations ni du chiffre d'affaires.

1. **Pas de double comptage** : un coût variable se rattache à UNE réservation (dossier `E2B-XXXXXX`) OU à UNE campagne OU à rien (« non attribué », compté au total, jamais réparti en silence). Réservation + campagne : refusé (contrainte en base) ; dans le calcul, la réservation l'emporte.
2. **Remboursements** : le remboursement client est une ligne négative du registre des commissions, donc déjà déduit de la commission nette. Il n'est pas une catégorie de coût (refusé en base, écarté dans le calcul). Seul le geste commercial hors commission se saisit comme coût. La publicité non plus n'est pas un coût variable (table `landing_ad_spend`).
3. **Provisoire / confirmé** : deux marges distinctes — `marginConfirmed` (commissions confirmées seulement, seule base d'un bénéfice définitif) et `marginWithProvisional` (estimation si les provisoires se confirment).
4. **Gagnante** : marge nette confirmée > 0 ET au moins 5 réservations à commission confirmée ET marge strictement supérieure à celle des autres lignes comparables (égalité exacte : pas de gagnante). Sinon la raison est affichée.
- Sans coût variable saisi, l'écran l'indique : la marge est « avant coûts variables non saisis ».
- Catégories : frais de paiement, prime du conseiller, messagerie, geste commercial, autre.

## Écran d'analyse `/admin/rentabilite/analyse`

Répond aux cinq questions : combien on dépense pour attirer un client (dépenses ÷ réservations), combien de réservations sont confirmées (commission confirmée), combien de commission est conservée (confirmée / provisoire séparées), ce qui reste après tous les coûts (marge nette confirmée ; marge « avec provisoire » = estimation), quelles campagnes rapportent (bandeau « Gagnante » ou raison de l'absence de gagnante).
- Axes : réseau, campagne, produit, niche, annonce ; période choisie (leads créés sur la période, dépenses et coûts datés sur la période).
- Les dépenses réparties au prorata des leads (produit / niche / annonce) sont marquées « estimée » ; les dépenses sans lead et les coûts non attribués sont listés, jamais répartis en silence.
- Accès : `ads.view` (admin, manager). Lecture seule, cloisonné par entreprise.
