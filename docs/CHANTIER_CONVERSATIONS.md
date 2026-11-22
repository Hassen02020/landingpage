# Chantier « Growth & Marketing Intelligence » — Étape 1 : les conversations

Statut : **PRÉPARATION (rien n'est codé ni appliqué).** Découpage et règle de protection des données acceptés par le propriétaire le 22/11/2026. Chaque lot ci-dessous demande son propre GO ; la migration demande un GO distinct.

## 0. Principe
Easy2Book mesure des **conversations, prospects et ventes**, pas des visites. Une conversation n'est pas un prospect : « Bonjour, je voudrais des informations » est une conversation ; elle devient un prospect quand un conseiller crée ou relie un dossier, puis un prospect qualifié, puis une vente. **L'état d'une conversation n'est jamais dupliqué** : il se déduit du dossier (lead) auquel elle est reliée.

## 1. Règle de protection des données (acceptée)
1. **Aucune audience publicitaire ne se construit sur des données sensibles ou leur déduction** : convictions religieuses, santé, etc. « A demandé l'Omra » fonctionne comme un indicateur de religion : ce segment est utilisé **en interne uniquement** (analyse, relance par un conseiller). Pas d'export vers Meta, pas de lookalike, sauf validation écrite du propriétaire après lecture de la politique Meta en vigueur.
2. **Consentement d'abord** : tout export de contacts vers une plateforme exige le consentement marketing du contact (case dédiée), jamais le simple consentement de contact.
3. **Données minimales** : une conversation ne stocke **ni le texte des messages, ni le nom**, seulement canal, origine, dates, compteurs, identifiant de contact (téléphone ou identifiant technique de la plateforme) et rattachement au dossier.
4. **Anonymisation** : quand un lead est anonymisé, ses conversations le sont aussi (téléphone et identifiant effacés, compteurs gardés).
5. **Aucun envoi sans validation** : le CRM prépare, un humain active.

## 2. Modèle de données (proposé)
Table `landing_conversations` (une ligne = un fil de conversation, **ou** un lot du jour) :

| Colonne | Rôle |
|---|---|
| `id`, `organization_id` | cloisonnement par entreprise (comme `landing_conversion_log`) |
| `kind` | `individuelle` ou `lot` (lot = « n conversations ce jour-là sur ce canal », sans identité) |
| `channel` | `whatsapp`, `messenger`, `instagram`, `facebook_commentaire`, `telephone`, `autre` |
| `origin` | `annonce`, `organique`, `direct`, `inconnue` |
| `campaign`, `ad_id`, `niche` | rattachement (convention de nommage des campagnes ; vides si inconnus) |
| `conversation_count` | 1 pour `individuelle` ; n pour un `lot` |
| `contact_phone`, `contact_ref` | téléphone normalisé et/ou identifiant technique (BSUID, PSID, IGSID) ; **nuls pour un lot** |
| `lead_id` | dossier relié (nullable) |
| `started_at`, `last_activity_at`, `first_reply_at` | dates ; `first_reply_at` mesure le délai de première réponse |
| `messages_in`, `messages_out` | compteurs (sans texte) |
| `status` | `ouverte` ou `sans_suite` |
| `source_kind` | `saisie` (équipe) ou `webhook` (automatique, lots suivants) |
| `is_test`, `anonymized_at`, `created_by`, `created_at` | gouvernance |

Contraintes : valeurs contrôlées ; `lot` ⇒ pas de contact ni de dossier ; `individuelle` ⇒ `conversation_count = 1` ; **jamais de DELETE** (service uniquement SELECT, INSERT, UPDATE) ; sécurité par ligne forcée ; organisation immuable.
Étape déduite (jamais stockée) : *conversation seule* → *prospect* (dossier nouveau, à contacter, contacté) → *qualifié* → *devis* → *vendu* (réservé, gagné) / *perdu*.

## 3. Brouillon de migration 0029 (NON appliqué, à valider)
Prérequis : 0001 à 0028 (notamment 0026 pour `is_test`). **Volontairement placé ici et non dans `supabase/migrations/`** pour qu'aucun outil ne l'applique avant le GO.
```sql
CREATE TABLE public.landing_conversations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('individuelle', 'lot')),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'messenger', 'instagram', 'facebook_commentaire', 'telephone', 'autre')),
  origin TEXT NOT NULL DEFAULT 'inconnue' CHECK (origin IN ('annonce', 'organique', 'direct', 'inconnue')),
  campaign TEXT CHECK (char_length(campaign) <= 255),
  ad_id TEXT CHECK (char_length(ad_id) <= 64),
  niche TEXT CHECK (char_length(niche) <= 64),
  conversation_count INTEGER NOT NULL DEFAULT 1 CHECK (conversation_count BETWEEN 1 AND 1000),
  contact_phone TEXT CHECK (char_length(contact_phone) <= 20),
  contact_ref TEXT CHECK (char_length(contact_ref) <= 100),
  lead_id UUID REFERENCES public.landing_leads (id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_reply_at TIMESTAMPTZ,
  messages_in INTEGER NOT NULL DEFAULT 0 CHECK (messages_in >= 0),
  messages_out INTEGER NOT NULL DEFAULT 0 CHECK (messages_out >= 0),
  status TEXT NOT NULL DEFAULT 'ouverte' CHECK (status IN ('ouverte', 'sans_suite')),
  source_kind TEXT NOT NULL DEFAULT 'saisie' CHECK (source_kind IN ('saisie', 'webhook')),
  is_test BOOLEAN NOT NULL DEFAULT false,
  anonymized_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT landing_conversations_lot_ck CHECK (kind <> 'lot' OR (contact_phone IS NULL AND contact_ref IS NULL AND lead_id IS NULL)),
  CONSTRAINT landing_conversations_indiv_ck CHECK (kind <> 'individuelle' OR conversation_count = 1)
);
CREATE INDEX landing_conversations_org_date_idx ON public.landing_conversations (organization_id, started_at);
CREATE INDEX landing_conversations_lead_idx ON public.landing_conversations (lead_id);
-- + RLS activée et forcée, REVOKE ALL, GRANT SELECT, INSERT, UPDATE à service_role, déclencheur landing_org_immutable
```
Fichiers à livrer avec elle : retour arrière (refusé si des lignes existent), contrôle `postcheck-0029` (5 vérifications), test PGlite.

## 4. Lots de l'étape 1
**1a. Saisie rapide et lecture (sans automatisme)** — priorité : l'équipe reçoit déjà beaucoup de messages.
- Page `/admin/conversations` : liste filtrable (période, canal, origine, campagne, étape déduite), cloisonnée par entreprise.
- **« Saisie du jour » (lot)** : canal, origine, campagne, nombre — 10 secondes, sans identité. Réponse au besoin actuel (« trop de messages »).
- **« Nouvelle conversation » (individuelle)** : canal, origine, téléphone facultatif ; bouton « créer le prospect » (réutilise la saisie manuelle de lead existante) ou « relier à un dossier » (recherche par téléphone).
- Depuis la fiche d'un lead : « ajouter une conversation ».
- Droits inchangés : un employé voit et modifie ses dossiers ; responsable et administrateur ceux de l'entreprise ; le Super Admin ne voit aucun contenu de lead.
**1b. Mesure** : indicateurs « conversations », « prospects issus de conversations », taux conversation → prospect → qualifié → vendu, coût par conversation (si dépenses saisies), délai de première réponse ; seuils de fiabilité déjà en place (jamais de taux sur un échantillon trop petit).
**1c. Rapprochement avec Meta** : saisie hebdomadaire (ou import CSV) du nombre de conversations déclaré par Meta ; alerte qualité « écart de saisie » (ex. Meta 20, CRM 3).
**1d. Automatismes (après l'étape 1, GO séparé)** : WhatsApp (webhook existant : crée ou met à jour la conversation, après publication de l'application), puis Messenger et Instagram (permissions Meta supplémentaires, examen d'application).

## 5. Définitions des indicateurs
- *Conversation* : un contact distinct ayant écrit ou appelé sur un canal, ou n conversations d'un lot ; une nouvelle conversation naît après 30 jours d'inactivité (à confirmer).
- *Prospect* : conversation reliée à un dossier. *Qualifié* : dossier au statut « qualifié » ou au-delà. *Vente* : dossier réservé ou gagné (montant obligatoire).
- Taux affichés seulement si l'échantillon atteint le seuil (5 réservations pour comparer, comme ailleurs).

## 6. Tests prévus
Migration (PGlite : contraintes lot/individuelle, valeurs contrôlées, jamais de DELETE, cloisonnement) ; fonctions pures de mesure (étape déduite, taux, fenêtre de 30 jours) ; actions serveur (droits par rôle, cloisonnement, anti-doublon d'une même conversation, anonymisation en cascade, tests exclus) ; e2e Playwright (saisie de lot, conversation puis prospect, mobile 390 px sans débordement) ; non-régression : leads, CRM, rentabilité, pages publiques inchangés.

## 7. Déploiement
Ordre : GO migration → lecture avant, application, `postcheck-0029` → GO fusion → déploiement → contrôle en production. Le code fonctionne **avant** la migration (page « migration non appliquée », jamais d'erreur 500). Retour arrière : déploiement précédent ; table conservée si elle contient des données.

## 8. Décisions à prendre par le propriétaire avant le code
1. **Saisie hybride** (lot du jour + conversations individuelles) : recommandée ; sinon une ligne par conversation, plus lourde.
2. **Fenêtre de nouvelle conversation** : 30 jours d'inactivité ?
3. **Qui saisit** : tous les conseillers ?
4. **Durée de conservation** des téléphones dans les conversations (proposé : 24 mois, puis anonymisation).
5. **Canaux** de départ : WhatsApp, Messenger, Instagram, commentaire Facebook, téléphone, autre.
6. **Rapprochement Meta** : saisie manuelle hebdomadaire ou import CSV.
