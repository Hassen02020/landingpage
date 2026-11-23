# Décisions du propriétaire du 23/11/2026 — et documents préparatoires

**Aucun GO n'est donné pour D3, D4, le lot E, une migration, un export, une activation publicitaire ou une modification de production.** Priorité unique : vérifier et certifier D1 et D2 dans l'interface réelle (protocole : `docs/AUDIT_CONNECTE_D1_D2.md`).

## 1. Registre des décisions
| N° | Décision | Effet |
|---|---|---|
| 1 | D1 et D2 : audit fonctionnel connecté uniquement, sans donnée fictive en production, sans export, sans activation | Protocole prêt ; D1 et D2 restent « déployés, non certifiés » |
| 2 | Seuils 30 / 100 / 50 % : propositions techniques, non validées | §2 : rôle, justification, conséquences |
| 3 | D3 : proposition documentaire seulement | §3 |
| 4 | D4 (exports d'audiences) : en veille | Aucun export vers Meta ni autre plateforme sans décision et autorisation distinctes |
| 5 | Lot E : **sans stockage du texte intégral des messages** ; le CRM garde les métadonnées commerciales nécessaires ; lecture et réponse dans l'interface officielle du canal | §5 |
| 6 | WhatsApp, Messenger, Instagram : pas de publication de l'application Meta ni de modification de sa configuration sans GO explicite ; un canal n'est fonctionnel qu'après réception et vérification d'un événement réel | Règle déjà appliquée par la page « Canaux » |
| 7 | Relances : seuils 60 min / 4 h / 3 jours **non appliqués automatiquement** ; proposition fondée sur les données commerciales et les horaires de travail | §6 |
| 8 | Conservation 10 ans : aucune validation avant examen juridique et durées par catégorie de données | §7 |
| 9 | Purchase : spécification « une seule vente par réservation », sans double comptage réservé / gagné, chiffre d'affaires distinct de la marge nette | §4 |

Remarque d'état : les règles de relance du lot B sont **en lecture seule** (liste « À traiter », aucun message ni action automatique) ; leurs seuils par défaut y sont affichés comme tels. Aucun seuil n'est appliqué à une action.

## 2. Seuils de la fiche de segment (D2) — rôle, justification, conséquences
| Seuil | Valeur par défaut | Rôle | Justification | Conséquence si on le change |
|---|---|---|---|---|
| Échantillon minimal (`MIN_SAMPLE`) | 30 contacts éligibles | Sous ce nombre, la fiabilité est « insuffisante » et aucune conclusion n'est tirée | Règle statistique usuelle : pour une proportion de 50 %, la marge d'erreur à 95 % est d'environ ±18 points avec 30 contacts, ±10 points avec 100. Un taux calculé sur moins de 30 personnes est trop instable pour guider une décision | Le baisser fait paraître fiable un segment trop petit ; le relever retarde les conclusions |
| Échantillon suffisant (`GOOD_SAMPLE`) | 100 contacts éligibles | Seuil de la fiabilité « élevée » | Marge d'erreur d'environ ±10 points : acceptable pour comparer des audiences grossièrement, pas pour des écarts fins | Idem |
| Part d'exclus faute de consentement (`MAX_EXCLUDED_SHARE`) | 50 % | Au-delà, la liste éligible est peu représentative du segment (le consentement n'est pas aléatoire) et la fiabilité baisse d'un niveau | Si la moitié des membres est exclue, les éligibles ne représentent plus le segment | Le relever masque un biais de consentement |
| Région connue | 50 % | Sous ce seuil, le ciblage géographique est signalé peu fiable et la fiabilité baisse d'un niveau | Une région connue pour moins de la moitié des contacts ne permet pas un ciblage régional | Idem |

**Conséquence réelle aujourd'hui (23/11/2026) :** la production compte **5 clients distincts** et le plus gros segment en compte 3. Toutes les fiches afficheront donc « Insuffisante » : c'est le comportement voulu, et cela restera vrai tant que les volumes n'atteignent pas 30. Ces seuils **n'ont aucun effet sur l'appartenance aux segments, ni sur un envoi ou un export** (il n'en existe aucun) ; ils n'influencent que le niveau de fiabilité affiché.
**Décision attendue :** valider, modifier, ou fixer ces seuils (éventuellement réglables par variable de configuration, non fait). Tant qu'ils ne sont pas validés, ils sont présentés comme « par défaut ».

## 3. D3 — registre de validation humaine (proposition documentaire, aucune migration)
**But :** aucune audience publicitaire ne peut être activée sans une décision humaine tracée.
- **Objet validé :** un segment non sensible, de nature marketing, dans une version précise de ses règles.
- **Table proposée** `landing_audience_approvals` (à migrer seulement après GO distinct) : identifiant ; entreprise ; segment ; empreinte des règles du segment ; effectif et effectif éligible au moment de la décision ; plateforme visée ; décision (validée / refusée) ; motif ; décidé par ; date ; date d'expiration ; révoquée le / par.
- **Règles :** un segment sensible ne peut jamais être validé (contrainte en base et dans le code, en plus du garde-fou D1) ; une validation expire (durée à décider, 30 jours proposés) et devient caduque si les règles du segment changent ; seul le propriétaire (ou un rôle explicitement désigné) peut valider ; chaque décision est journalisée ; consentement marketing exigé pour chaque contact ; aucune écriture de leads.
- **Tests prévus :** impossibilité de valider un segment sensible ; expiration ; caducité après changement de règles ; droits par rôle ; aucune lecture de données personnelles dans le registre.
- **Statut :** documentaire. Ni D3 ni D4 ne sont autorisés ; D3 n'a d'utilité que si le propriétaire décide un jour d'exporter des audiences.

## 4. Purchase — spécification : une seule vente par réservation ; chiffre d'affaires ≠ marge nette
**Constat dans le code actuel** (vérifié) :
- Un lead porte un seul statut ; `réservé` et `gagné` sont deux étapes d'un **même** dossier, jamais deux ventes.
- La date de réservation (`booked_at`) est posée **une seule fois** ; l'événement Purchase a un identifiant unique `purchase-<lead>` ; le journal impose l'unicité (organisation, réseau, identifiant) : un même dossier n'envoie jamais deux fois Purchase, même s'il passe de « réservé » à « gagné ».
- Le montant de la vente (`booking_value`) est obligatoire pour réservé ou gagné.
**Exigences de la spécification :**
1. **Définition :** une vente = un dossier (lead) au statut réservé **ou** gagné avec un montant ; le passage de « réservé » à « gagné » ne crée **pas** une deuxième vente (comptage par dossier, jamais par transition).
2. **Doublons :** deux dossiers du même client pour la **même** réservation (doublon de saisie) ne doivent pas compter deux fois : règle proposée = un dossier peut être « rattaché » à un autre comme doublon ; le dossier doublon est exclu des ventes. *Aujourd'hui, ce rattachement n'a pas de statut dédié : risque de double comptage à traiter.*
3. **Annulation et correction :** une vente annulée ou corrigée (montant) met à jour le dossier ; l'événement déjà envoyé à Meta n'est pas « annulé » automatiquement (Meta ne le permet pas simplement) : documenter la conduite à tenir et mesurer l'écart.
4. **Chiffre d'affaires :** montant encaissé ou facturé du dossier (`booking_value`), tel que saisi.
5. **Marge nette :** chiffre d'affaires moins commissions (table des commissions) moins coûts variables (table des coûts variables) rattachés au dossier ; jamais déduite d'un taux inventé ; **calculée seulement quand les coûts sont saisis**, sinon affichée « non disponible » avec ce qui manque.
6. **Valeur envoyée à Meta :** **décision du propriétaire en attente** (chiffre d'affaires ou marge nette). Tant qu'elle n'est pas prise, la valeur actuelle (montant de la vente) reste en place ; aucune modification.
7. **Tests prévus :** une seule vente comptée pour un dossier qui passe réservé → gagné ; un seul événement Purchase par dossier ; doublon exclu ; marge indisponible sans coûts ; CA et marge jamais confondus à l'écran.
**Statut :** spécification seulement, aucune modification du code ni de la base.

## 5. Lot E — principe retenu (sans stockage du texte des messages)
- Le CRM **ne stocke jamais** le texte intégral d'un message. Il conserve des **métadonnées commerciales** : canal, date et heure du premier message et de la première réponse, qui a répondu, statut de la conversation, rattachement à un dossier, produit concerné, motif d'hésitation ou de refus **saisi par le conseiller** sous forme de catégorie.
- La **lecture et la réponse** se font dans l'interface officielle du canal (WhatsApp Business, Meta Business Suite…) ; le CRM propose un lien et rappelle ce qui doit être traité.
- Aucune publication de l'application Meta ni changement de configuration sans GO explicite.

## 6. Relances — proposition à construire sur des données, pas sur des seuils posés
**État :** les seuils 60 min, 4 h et 3 jours ne sont pas appliqués automatiquement.
**Ce qui manque aujourd'hui :** (a) les **horaires de travail** de l'équipe (jours, plages, jours fériés, pauses) ; (b) un **volume suffisant** de dossiers (la production en compte 9 pour 5 clients) pour mesurer un délai de première réponse réel.
**Proposition de méthode :**
1. Recueillir les horaires de travail (par conseiller si possible).
2. Calculer les délais en **minutes ouvrées** (hors nuits, week-ends, fermetures), jamais en minutes civiles : un message reçu à 23 h n'est pas « en retard » à 0 h.
3. Mesurer d'abord (délai de première réponse réel, par canal et par produit), sur une période suffisante, puis proposer des seuils fondés sur la médiane et le 80ᵉ percentile observés, **validés par le propriétaire** avant toute alerte active.
4. Distinguer l'urgence par nature : demande directe (WhatsApp, téléphone) et formulaire.
**Décisions attendues :** horaires de travail ; qui est alerté ; si l'alerte reste une simple liste ou devient une notification.

## 7. Conservation — plan d'examen juridique (aucune durée validée)
Aucune durée n'est validée tant que l'examen juridique n'est pas fait. Catégories à examiner, une durée et une base légale chacune :
| Catégorie | Exemples | Question à trancher |
|---|---|---|
| Fiche prospect non converti | nom, téléphone, demande | Durée sans nouvelle activité avant anonymisation |
| Client (vente conclue) | dossier, montant, réservation | Durée comptable et contractuelle (pièces de vente) |
| Consentements | consentement de contact et marketing, retrait | Durée de conservation de la preuve du consentement |
| Conversations (métadonnées) | canal, dates, statut | Durée alignée sur la fiche, sans texte stocké |
| Journaux techniques | événements entrants, conversions, audit | Durée de conservation des journaux |
| Avis | prénom, note, commentaire publié | Durée de publication et droit de retrait |
| Données publicitaires | identifiants de clic, cookies de mesure | Durée de conservation après consentement |
**Livrable attendu du conseil juridique :** durée par catégorie, base légale, mention à ajouter à la politique de confidentialité. **Aucune** purge ni anonymisation automatique n'est mise en place avant.
