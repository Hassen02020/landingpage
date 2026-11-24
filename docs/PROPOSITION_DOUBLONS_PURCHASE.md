# Proposition — détection des doublons de dossiers et de réservations (23/11/2026)

**Statut : PROPOSITION DOCUMENTAIRE. Aucun code, aucune migration, aucune modification de production.** Elle répond à la décision du propriétaire : *avant de considérer Purchase comme entièrement fiable, détecter les doublons de dossiers et de réservations.* Aucun GO de réalisation.

## 1. Ce que montrent les données réelles (production, lecture seule, 23/11/2026)
9 dossiers réels pour **5 clients** (téléphones distincts) ; aucune vente enregistrée (aucun montant, aucune réservation) ; 7 dossiers « perdus », 2 « nouveaux ». Aucun numéro ni nom n'est reproduit.
| Client | Dossiers | Ce qu'on observe | Lecture |
|---|---|---|---|
| 1, 2, 5 | 1 chacun | — | Pas de doublon |
| 3 | 3 | Formulaire pour le même départ à 9 jours d'écart, avec un message WhatsApp entre les deux | Même client, même offre redemandée : **intérêt répété**, pas forcément un doublon à supprimer |
| 4 | 3 | Un dossier le 06/11, deux autres le 10/11 à **5 minutes** d'écart, produits différents (Omra sans offre, puis « autre ») | **Doublon probable** (double envoi ou changement de choix dans la même session) |
**Conséquence :** aujourd'hui, aucun doublon ne peut fausser Purchase, faute de vente. Le risque est **futur** : dès qu'un client à plusieurs dossiers réserve, deux dossiers pourraient être comptés comme deux ventes.
**Rappel des garde-fous déjà en place :** un dossier = un statut ; date de réservation posée une fois ; un événement Purchase par dossier (identifiant unique, imposé par la base). Ils protègent contre le **double comptage d'un même dossier**, pas contre **deux dossiers pour une même réservation**.

## 2. Trois niveaux de doublon à distinguer
| Niveau | Définition | Exemple réel | Traitement proposé |
|---|---|---|---|
| A. Doublon technique | Même envoi reçu deux fois (même clé d'idempotence ou même visiteur + même téléphone + même produit en quelques minutes) | Client 4 (5 min) | Détection automatique ; **signal** au conseiller, jamais de suppression automatique |
| B. Doublon probable | Même téléphone + même produit + même offre, dossier précédent encore ouvert, dans une fenêtre de N jours | Client 3 (même départ) | **Avertissement** sur la fiche ; le conseiller décide : « rattacher » ou « garder séparé » |
| C. Doublon de réservation | Deux dossiers du même client pour **la même** réservation (même produit et même offre ou même voyage) alors que l'un est réservé / gagné | Aucun encore | **Blocage doux** au moment d'enregistrer la vente : confirmation explicite requise avant de compter une deuxième vente |

## 3. Règles proposées
1. **Une vente = un dossier réservé ou gagné avec montant, non marqué doublon.** Le passage « réservé » → « gagné » ne crée pas de vente.
2. **Clé de réservation** (pour le niveau C) : téléphone + produit + offre (ou départ). Si l'offre est vide, la clé est trop faible : on **n'affirme pas** un doublon, on **avertit** seulement.
3. **Un dossier « doublon »** est rattaché à un dossier principal ; il est **exclu** des ventes, des indicateurs de conversion et de l'envoi Purchase ; il reste consultable (historique conservé, jamais supprimé).
4. **Aucune fusion automatique.** Toute décision de rattachement est humaine, journalisée (qui, quand, pourquoi), et réversible.
5. **Purchase :** avant l'envoi, vérifier qu'aucun autre dossier du même client n'est déjà réservé pour la même clé ; sinon ne pas envoyer et signaler. L'envoi reste unique par dossier.
6. **Fenêtres** (à valider, non appliquées) : 15 minutes pour le niveau A ; 30 jours pour le niveau B. Ce sont des propositions techniques, pas des décisions commerciales.
7. **Chiffre d'affaires et marge** restent deux mesures distinctes : le chiffre d'affaires est le montant réellement confirmé du dossier ; la marge nette n'est calculée que lorsque les coûts sont saisis, sinon « non disponible ». Aucune valeur n'est inventée ni présentée comme une autre mesure.

## 4. Réalisation possible, par étapes (chacune avec son GO)
- **P1 — Détection en lecture seule, sans migration :** fonctions pures qui repèrent les niveaux A, B et C et affichent un avertissement sur la fiche et dans la liste « À traiter ». Aucune écriture.
- **P2 — Rattachement manuel :** nécessite de **marquer un dossier comme doublon** (colonne ou table de liens). **Migration, GO distinct.** Journal d'audit.
- **P3 — Garde-fou Purchase :** contrôle avant envoi (règle 5). Modification du code, GO distinct, avec tests sur des jeux fictifs.
- **P4 — Rapport :** nombre de doublons détectés, ventes comptées avec et sans doublon, pour mesurer l'écart.

## 5. Tests prévus
Même dossier réservé puis gagné = une vente ; deux dossiers, même clé, un seul réservé = une vente ; deux dossiers réservés pour la même clé = alerte, un seul Purchase ; dossier doublon exclu des ventes et de Purchase ; offre vide = avertissement sans affirmation ; rattachement réversible ; aucun doublon supprimé ; leads de test exclus.

## 6. Décisions demandées au propriétaire
1. Faut-il considérer deux demandes pour **le même départ** à quelques jours d'écart comme un doublon, ou comme un intérêt répété ?
2. Fenêtres de détection (15 minutes et 30 jours proposés).
3. Qui peut rattacher un dossier comme doublon (administrateur, responsable, tout conseiller sur ses dossiers) ?
4. GO éventuel pour P1 (détection en lecture seule), puis P2, P3 et P4 séparément.
