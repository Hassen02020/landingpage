# Vision — Easy2Book Growth & Marketing Intelligence (22/11/2026)

**Statut : VISION ET FEUILLE DE ROUTE. Ce document n'autorise aucun développement, aucune migration, aucune activation publicitaire et aucun envoi de message.** Chaque chantier ci-dessous exige : audit → proposition → **GO distinct** du propriétaire. Projet visé : Landing Page / Growth OS (EasyV4 non concerné).

## 1. Parcours commercial piloté
Publicité → Audience → Visite → Conversation → Prospect → Qualification → Devis → Réservation → Marge nette → Fidélisation.
Principe : une conversation n'est pas un prospect, un prospect n'est pas une vente. Chaque étape est mesurée avec sa **fiabilité** (échantillon, source, données manquantes) ; un chiffre sans base suffisante n'est pas présenté comme une conclusion.

## 2. Les trois capacités

### 2.1 Audience Intelligence
Pour chaque campagne et chaque module (hôtels, vols, séjours, circuits, activités, Omra, E-Visa, etc.) :
- distinguer **visiteurs, prospects, clients, clients fidèles** ;
- mesurer contacts, qualification, devis, réservations et **marge nette** ;
- indiquer pour chaque audience : **taille estimée, provenance, fiabilité** ;
- recommander des audiences à tester à partir de **données autorisées** ;
- **validation humaine obligatoire avant toute activation**.
**Interdits (règle acceptée le 22/11/2026) :** aucune audience publicitaire sur donnée sensible ou inférence sensible. Une demande d'Omra reste une **information interne** : pas de construction ni d'export d'audience Meta (ni similaire) à partir d'elle. Tout export exige le consentement marketing du contact et la validation écrite du propriétaire.

### 2.2 Product Trend Intelligence
Identifier, par produit : les plus **demandés**, **consultés**, ceux qui génèrent le plus de **conversations**, de **devis**, ceux qui **convertissent** le mieux, la meilleure **marge nette**, et ceux avec **beaucoup de demandes mais peu de réservations**. Proposer des opportunités avec le **niveau de fiabilité** du signal. Exemple : forte consultation mais abandon après le prix → signal « prix, présentation ou valeur perçue à examiner », jamais une certitude.

### 2.3 Customer Feedback Intelligence
Solliciter et recueillir avis, réponses, objections, besoins depuis Messenger, WhatsApp, Instagram Direct, formulaires et pages web. Pour chaque retour, conserver si possible : client/prospect associé, canal, produit, date, question posée, réponse ou retour structuré, **motif** (satisfaction, hésitation, refus). Le fonctionnement automatique de **chaque canal est prouvé séparément** ; consentements, fenêtres de messagerie, modèles approuvés et possibilités officielles des API sont respectés.

## 3. Ce qui existe déjà (au 22/11/2026)
| Capacité | Déjà en production |
|---|---|
| Parcours et mesure | Pipeline 10 statuts, Centre d'intelligence (5 réponses dirigeant), économie publicitaire (8 dimensions, import des dépenses), conversions Meta journalisées avec relance |
| Conversations | Migration 0029 appliquée ; saisie du jour et conversations reliées aux fiches (`/admin/conversations`) |
| Clients | Client 360, étiquettes Fidèle / VIP, segments avec consentement (aucun envoi) |
| Produits | Pages par produit et niche, visites par page (Vercel Analytics), pipeline par produit |
| Retours clients | Avis en étoiles sur la page Omra (modération) ; motif de perte obligatoire |
| Canaux | WhatsApp entrant signé (inactif tant que l'application Meta n'est pas publiée), journal des événements entrants |
| Relances | Lot B (PR #85) : liste « À traiter », règles de relance, sans envoi |

## 4. Écarts principaux
1. Messenger / Instagram / WhatsApp : aucune lecture ni réponse automatique prouvée (application Meta à publier, permissions à faire valider).
2. Pas de modèle de **retour client structuré** (question, réponse, motif, produit) ni de campagne de sollicitation.
3. Pas de **marge nette par produit** exploitable tant que les commissions et coûts ne sont pas saisis de façon complète.
4. Pas de table de **rapprochement d'identités** inter-canaux (uniquement par numéro ou référence fiable ; sinon interaction non identifiée).
5. Audiences : segments existants, mais sans taille estimée, provenance ni fiabilité affichées, et sans registre de validation avant activation.

## 5. Feuille de route (propositions, aucune n'est autorisée)
Chaque ligne : audit → proposition détaillée → GO distinct. Les migrations ont leur propre GO.
| Chantier | Contenu | Dépend de |
|---|---|---|
| **C — Pilotage des canaux** | État réel par canal (connecté / reçoit / ne reçoit plus), alerte visible | Preuve par événement réel |
| **D — Segments et audiences** | Segments prêts à l'emploi ; taille, provenance, fiabilité ; **registre de validation humaine** ; garde-fou « données sensibles » appliqué par le code | Règle de protection (acceptée) |
| **G1 — Product Trend Intelligence** | Tableau produits : demandes, consultations, conversations, devis, conversion, marge, « beaucoup de demandes / peu de réservations » avec fiabilité | Marge nette saisie ; conversations saisies |
| **G2 — Retours clients structurés** | Fiche de retour (client, canal, produit, date, question, réponse, motif) saisie par les conseillers ; synthèse des objections | Décision sur le texte des messages |
| **G3 — Sollicitation d'avis** | Préparer (jamais envoyer sans validation) des demandes d'avis par canal, selon consentement et modèles approuvés | Canaux prouvés ; consentement |
| **E — Boîte de réception** | Lecture et réponse depuis le CRM par canal | Décision stockage du texte ; application Meta publiée |
| **F — Rapprochement d'identités** | Un client, plusieurs canaux, uniquement par clé fiable | E |
| **P — Pilotage direction** | Vue unique Publicité → … → Fidélisation : quels produits développer, quelles audiences tester, quelles objections traiter, quels investissements sont rentables | G1, G2, D |

Ordre indicatif de valeur et de risque : C, D, G1, G2, puis E, F, G3, P. Il se révise à chaque GO.

## 6. Garde-fous permanents
- Aucune donnée sensible ni inférence sensible dans une audience publicitaire ; segment « Omra » interne seulement.
- Consentement marketing exigé pour tout export ; retrait respecté.
- **Rien n'est activé sans validation humaine** : audiences, campagnes, messages.
- Messages automatiques : consentement, fenêtre de messagerie, modèles approuvés, désinscription, règles de chaque plateforme.
- Données minimales : pas de texte de message ni de nom dans les conversations tant que le propriétaire n'a pas décidé du contraire (décision en attente pour la boîte de réception).
- Le propriétaire lance et paie les campagnes ; le CRM prépare et recommande.
- Un canal « connecté » n'est déclaré fonctionnel qu'après un événement réel reçu de ce canal.
- Permissions existantes inchangées et testées côté serveur ; Super Admin sans contenu de lead.
- Aucune dépendance ni écriture vers EasyV4.

## 7. Décisions en attente du propriétaire
1. Stockage du texte des messages pour la boîte de réception et les retours clients (oui / non / durée).
2. Seuils des règles de relance (60 min, 4 h, 3 jours par défaut).
3. Base légale écrite de la conservation de 10 ans (comptable / conseil juridique).
4. Règles d'affectation et de réaffectation automatiques (par produit, charge ou tour de rôle).
5. Valeur envoyée à Meta pour un achat : chiffre d'affaires ou marge.
