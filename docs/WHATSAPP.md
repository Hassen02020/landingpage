# WhatsApp — audit, état réel et API officielle

> Audit du 05/11/2026 sur le code de la branche `claude/exciting-volta-ndkljc`.
> **Un lien `wa.me` n'est pas une intégration API.** Aucune API WhatsApp Business n'est connectée et aucun message réel n'a été envoyé pendant ce travail.

## 1. Ce qui existe (prouvé par `tests/e2e/whatsapp.e2e.mjs`)

| Constat | Résultat |
|---|---|
| Liens WhatsApp sur les 4 pages publiques | **38** (accueil 3, Omra 6, voyages 13, hôtels 16) |
| Numéro | Tous vers `21698140514` (source unique `lib/config.ts`) |
| Référence au clic | Chaque clic ajoute `Réf: E2B-XXXXXX` au message (avec ou sans consentement : c'est une référence de conversation, pas un traceur envoyé à un tiers) |
| Événement « Contact » | Envoyé **seulement** avec consentement aux traceurs (clic = intention, rien de plus) |
| Formulaire → WhatsApp | Le lead est enregistré (référence serveur), puis le visiteur est redirigé vers WhatsApp avec un message prérempli |
| Défaut trouvé | **Aucun** dans les liens eux-mêmes. Deux fausses alertes de mon propre test (espaces transformés en `+` par WhatsApp ; texte du pied de page qui passe à la ligne) : corrigées dans le test, pas dans le site |

À confirmer par le propriétaire : la page Hôtels affiche aussi **97 449 510** à côté du 98 140 514. Je ne peux pas vérifier que ce second numéro est un numéro Easy2Book officiel.

## 2. Les états d'une conversation : ce qui est observable

| État | Observable sans API officielle ? | Où il est enregistré | Nature |
|---|---|---|---|
| Clic sur un lien WhatsApp | Oui, si le visiteur a accepté les traceurs | `landing_events` (`Contact`, `visitor_ref`) | **Observé** |
| Ouverture de l'application WhatsApp | **Non** | — | Non observable |
| Message envoyé par le visiteur | **Non** (seulement sa référence, une fois reçu) | — | Non observable |
| Message reçu par l'équipe | Saisi par le conseiller | activité `wa_in` | **Saisi par l'équipe** |
| Message envoyé par l'équipe | Saisi par le conseiller | activité `wa_out` | **Saisi par l'équipe** |
| Contact identifié (téléphone) | Oui (formulaire ou saisie) | `landing_leads.phone` | Observé / saisi |
| Prospect créé | Oui | `landing_leads` (`source` = `form` ou `whatsapp`) | Observé / saisi |
| Rattaché à son clic d'origine | Calculé (référence E2B) | `visitor_ref` | **Calculé** |
| Conversation suivie | Calculé (au moins un échange saisi) | activités `wa_in` / `wa_out` | **Calculé** |
| Réservation | Saisi (montant obligatoire) | `landing_leads.status = reserve` | Saisi |

Ces natures sont affichées telles quelles dans **Statistiques → WhatsApp**. Un clic n'est jamais présenté comme un message envoyé.

## 3. Ce que le CRM fait maintenant (Bloc 4)

- **Rattacher un message reçu à son origine.** « Nouveau lead » accepte le message collé (ou la seule référence `E2B-XXXXXX`) : le CRM retrouve le clic, donc le canal, la source, la campagne, l'annonce. Aucun identifiant publicitaire ni personnel n'est copié du clic.
- **Pas de doublon.** Si le visiteur a déjà une demande (même référence), le message est ajouté à son historique.
- **Honnêteté.** Référence sans clic retrouvé (visiteur sans consentement, message ancien) : le lead est créé avec « origine inconnue », sans rien déduire.
- **Affectation.** Un lead saisi par un conseiller lui est assigné. Les leads du formulaire restent non assignés : la règle de répartition (tour de rôle, par produit, par région, par charge) est une **décision commerciale du propriétaire**.
- **Échanges saisis.** Boutons « 💬 Message reçu / envoyé » sur la fiche (migration 0006 : types d'activité `wa_in`, `wa_out`).
- **Modèles de messages** (déjà livrés au lot 3) : un clic ouvre WhatsApp avec le message rempli. L'envoi reste manuel.

## 4. API officielle WhatsApp Business Platform — audit

**Statut : NON IMPLÉMENTÉE — BLOQUÉE par des accès et des décisions du propriétaire.** Je n'ai écrit ni point d'entrée, ni simulation de messages : un faux entrant ferait croire à une intégration qui n'existe pas.

### Ce qu'elle apporterait
Messages entrants et sortants reçus en temps réel, statuts de livraison et de lecture, rattachement automatique par numéro, réponses dans la fenêtre de 24 h, messages modèles approuvés au-delà.

### Prérequis (à faire par le propriétaire) — à revérifier dans la documentation officielle de Meta au moment de la connexion
1. Un compte **Meta Business** vérifié.
2. Un **compte WhatsApp Business (WABA)** et une **application Meta** de type Business.
3. Un **numéro** : numéro dédié à l'API, ou migration du numéro actuel (qui ne pourrait plus servir dans l'application WhatsApp classique : décision à prendre).
4. Un **jeton d'accès permanent** (utilisateur système) et l'**identifiant du numéro**.
5. Une **URL de webhook publique en HTTPS** et un **jeton de vérification**.
6. Des **modèles de messages approuvés** pour écrire hors fenêtre de 24 h, et le **consentement** du client pour être écrit (opt-in).

### Décisions commerciales à prendre
- Quel numéro, et que devient l'application WhatsApp actuelle des conseillers ?
- Qui répond : outil partagé (boîte commune), application métier, ou conseillers sur téléphone ?
- Coût : les conversations sont facturées selon la grille de Meta (budget à autoriser).
- Conservation : stocker ou non le **texte** des messages (donnée personnelle) et combien de temps. Proposition prudente : ne stocker que l'identifiant du message, le numéro, l'horodatage, le sens, la référence E2B détectée ; le texte reste dans WhatsApp.

### Architecture proposée (non codée)
- `GET /api/whatsapp/webhook` : vérification (jeton de vérification).
- `POST /api/whatsapp/webhook` : **signature `X-Hub-Signature-256`** (HMAC SHA-256 avec le secret de l'application) vérifiée avant tout traitement ; réponse rapide ; traitement idempotent par identifiant de message.
- Table `landing_wa_messages` (migration dédiée, à appliquer seulement à la connexion) : `wa_message_id` unique, sens, numéro normalisé, horodatage, référence E2B, `lead_id`.
- Rattachement : d'abord le **numéro** (leads existants), puis la **référence E2B** (clic d'origine), sinon création d'un lead « WhatsApp » assigné par la règle de répartition à définir.
- Désactivée par défaut : sans secret ni jeton de vérification configurés, le point d'entrée répond « non configuré ».

### À partir de là, mes prochaines étapes dépendent de vous
1. Choisir le numéro et la politique de conservation du texte.
2. Créer l'application Meta et le WABA, puis fournir les accès **par le formulaire sécurisé** (jamais dans la conversation).
3. M'autoriser à coder le webhook ; les tests utiliseront des charges **signées localement et déclarées comme simulations**.
