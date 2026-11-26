# Règles de calcul et définitions — Growth OS (lot L0, documentation seule)

Statut : **document de référence, aucun code modifié**. Rédigé le 26/11/2026 (lot L0 du plan v3). Dépôt : `Hassen02020/landingpage` uniquement.
Légende de chaque règle : **[Appliquée]** = le code la met en œuvre (ligne citée) · **[Proposée, non appliquée]** = règle voulue, pas encore dans le code · **[À définir]** = information métier manquante.
Aucune valeur de seuil nouvelle n'est introduite ici. Les seuils existants sont **« par défaut, non validés »** (propositions de `docs/DECISIONS_2026-11-23.md`).

## 1. Parcours et vocabulaire

source/campagne → interaction → conversation → lead → prospect qualifié → devis → réservation → vente → chiffre d'affaires → commissions et coûts → marge nette.
Un clic, une visite ou une conversation n'est **jamais** une vente. Une donnée absente n'est **pas** zéro : elle s'affiche « non disponible » ou « non renseigné ».

## 2. Résultat d'un dossier

| Notion | Définition | Code |
|---|---|---|
| Dossier ouvert | statuts nouveau, a_contacter, contacte, a_qualifier, qualifie, devis, negociation | `lib/status.ts:24` **[Appliquée]** |
| Dossier perdu | statut `perdu`, avec motif de perte | `lib/status.ts` **[Appliquée]** |
| **Réservation enregistrée** (= vente enregistrée) | statut `reserve` ou `gagne`, avec **montant de réservation obligatoire**. C'est une saisie du conseiller : elle ne prouve ni la confirmation du fournisseur ni un paiement. | `lib/status.ts:26`, `lib/server/crm.ts:209` **[Appliquée]** |
| Date de réservation | `booked_at`, posée **une seule fois** à la première réservation | `lib/server/crm.ts:215, 241` **[Appliquée]** |

Le résultat du dossier (ouvert / gagné / perdu) est **distinct** de la confirmation de la réservation (décision du 25/11).

## 3. Trois définitions séparées

1. **Réservation enregistrée** : voir §2. **[Appliquée]**
2. **Réservation confirmée** = confirmation du fournisseur **ET** conditions de paiement remplies. Aucune de ces deux preuves n'est enregistrée aujourd'hui. **[Proposée, non appliquée]** ; la nature des preuves (Q2) et les conditions de paiement par offre sont **[À définir]**.
3. **Commission confirmée** = commission confirmée par la source compétente. Une commission confirmée **ne suffit pas seule** à rendre une réservation confirmée. Qui confirme (Q3) est **[À définir]**. Aujourd'hui : une ligne de commission passe de `provisoire` à `confirme` par action d'un administrateur (`supabase/migrations/0016_ad_economics.sql`, `lib/ad-economics.ts:188`) **[Appliquée]**.

### Écart connu K1 (à ne pas masquer)
Le code calcule `confirmedBooking = réservation enregistrée ET commission confirmée > 0` (`lib/ad-economics.ts:197`). C'est un **substitut** (proxy) : il ne correspond pas à la définition n°2. Il alimente `confirmedBookings`, le test « échantillon suffisant » (`ad-economics.ts:287, 292`), la désignation d'une « gagnante » (`ad-economics.ts:13, 295`) et un message de `lib/intelligence.ts:148`. Tant que les données de confirmation n'existent pas (lot L7b), ce nombre doit être étiqueté pour ce qu'il est (« réservations à commission confirmée »), sans changer la formule.
Seuil : 5 réservations (`MIN_BOOKINGS`, `lib/intelligence.ts:8` ; `minBookings` par défaut 5, `ad-economics.ts:180`) — **par défaut, non validé**. Sous le seuil : « données insuffisantes pour conclure », aucune « gagnante ».

## 4. Une réservation = une vente = un événement Purchase

- Un seul `Purchase` par dossier : identifiant d'événement `purchase-<id du dossier>` (`lib/server/crm.ts:298, 315`) **[Appliquée]**.
- Envoyé seulement à la **première** réservation (`booked_at` vide), jamais renvoyé (`crm.ts:286`) **[Appliquée]**.
- Pas d'envoi sans consentement de suivi (`crm.ts:287`) ; envoi **retenu** et journalisé si un signalement de doublon est ouvert, libéré seulement après décision humaine (`crm.ts:291-294`) **[Appliquée]**.
- Meta refuse les événements de plus de 7 jours : un Purchase tardif n'est pas pris en compte par la plateforme (limite externe).
- Annulation / correction : une annulation ou un remboursement est une ligne de commission **négative** (`CommissionRow.kind`, `ad-economics.ts:56`) ; le Purchase déjà envoyé n'est pas retiré. **[Appliquée]** pour la commission, **[Proposée, non appliquée]** pour toute correction de la valeur envoyée à Meta.

## 5. CA, commission, marge : trois choses différentes

| Mesure | Définition | Statut |
|---|---|---|
| Chiffre d'affaires | somme des `booking_value` des réservations enregistrées | **[Appliquée]** (saisie conseiller, non confirmée par le fournisseur) |
| Commission nette d'un dossier | somme de ses lignes (commission + annulations et remboursements négatifs), provisoire et confirmé **séparés** | `lib/ad-economics.ts:17, 184-190` **[Appliquée]** |
| Marge nette | commission nette − publicité − coûts variables. Deux marges jamais mélangées : « confirmée » (commissions confirmées seulement) et « avec provisoire » (estimation, jamais un bénéfice définitif) | `lib/ad-economics.ts:8-9` **[Appliquée]** |

Le CA n'est ni une commission ni une marge. Un montant de **devis** n'est jamais du CA (décision du 25/11, lot L7, **[Proposée, non appliquée]**).
Fiabilité à afficher sur chaque indicateur : exact / partiel / estimé / non disponible. Une répartition de dépense au prorata est **estimée**.

## 6. Valeur de l'événement Purchase — **décision en attente (Q9), aucune recommandation arbitraire**

Comportement actuel (inchangé) : `value` = montant de réservation saisi, en TND (`crm.ts:290, 298`). Options à arbitrer par le propriétaire :
- **A. Chiffre d'affaires de la réservation** (actuel). Simple ; surestime la valeur si le CA diffère de ce que gagne l'agence.
- **B. Commission nette.** Reflète le gain réel ; mais la commission n'est connue qu'après l'import ou la confirmation, souvent après les 7 jours de Meta.
- **C. Marge nette estimée.** Plus proche de la rentabilité ; dépend de la répartition des coûts, donc estimée.
La production ne compte aucune réservation, commission ni dépense (état au 25/11/2026) : rien ne permet de comparer. **Aucun changement de comportement Meta n'est fait ni autorisé par ce document.**

## 7. Seuils existants (tous « par défaut, non validés »)

| Seuil | Valeur | Code |
|---|---|---|
| Réservations minimum pour comparer / désigner une gagnante | 5 | `lib/intelligence.ts:8` |
| Contacts minimum pour un profil de segment | 30 ; « bon échantillon » 100 | `lib/segment-profile.ts:10-11` |
| Relances | 60 min / 4 h / 3 jours | `lib/follow-up-rules.ts` |
Sans seuil connu : ne jamais en inventer ; afficher « données insuffisantes pour conclure ».

## 8. Points à définir (informations métier manquantes)

- **Q2** : quelles preuves de confirmation du fournisseur, et quelles conditions de paiement par offre (ex. acompte avant une date pour l'Omra).
- **Q3** : qui est la source compétente pour confirmer une commission.
- **Q9** : valeur du Purchase (§6).
- Les réservations existantes n'ont pas ces données : elles resteront « non renseigné », jamais « confirmée » par défaut.

## 9. Règles non appliquées — récapitulatif

Réservation confirmée au sens du propriétaire (§3-2) · étiquette du substitut K1 · montant de devis hors CA · correction de la valeur Purchase après annulation · valeur Purchase alternative (§6).
