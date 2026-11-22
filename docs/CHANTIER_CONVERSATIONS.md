# Chantier « Growth & Marketing Intelligence » — Étape 1 : les conversations

**Version finale pour examen — 22/11/2026.**
Statut : **DOCUMENTATION ET PRÉPARATION UNIQUEMENT.** Aucun code, aucune migration, aucune application en base, aucune modification de production. Le SQL ci-dessous est dans ce document et **pas** dans `supabase/migrations/`. Un GO distinct du propriétaire est requis après examen (d'abord la migration, puis chaque lot de code).

## 0. Périmètre et système visé (point à confirmer)
Le propriétaire demande de vérifier que le chantier concerne le CRM EasyV4 et sa base, sans dépendance ni écriture dans le projet Landing Page / Growth OS.

**Constat vérifié le 22/11/2026 :**
- Le seul projet de base accessible depuis cet environnement est `LandingpageEasy2Book` (`tdexdlukqciolslvjmhd`). Aucun projet, dépôt ou base EasyV4 n'est accessible ici.
- Tout le CRM construit jusqu'ici (leads, ventes, entonnoir, journal de conversions, WhatsApp entrant, Centre d'intelligence) vit dans ce projet Landing / Growth OS. Cette spécification est écrite pour ce projet : `landing_conversations` s'ajoute à côté de `landing_leads`.
- Les garde-fous des migrations Landing **refusent de s'exécuter** si des tables EasyV4 (`agencies`, `crm_conversations`, `reservations`) existent dans la base cible ; Landing n'écrit jamais dans EasyV4 (import contrôlé uniquement).

**Décision du propriétaire (22/11/2026) : « on est sur le bon projet Landing Page » → option A retenue.** Le chantier est hébergé dans Landing / Growth OS ; EasyV4 n'est ni lu ni modifié.

**Conséquence (avant cette décision) :** la demande « concerne EasyV4, sans écriture dans Landing / Growth OS » ne peut être ni vérifiée ni appliquée telle quelle. Deux options, **à trancher par le propriétaire avant tout GO** :
- **Option A (spécification actuelle)** : héberger les conversations dans Growth OS / Landing, là où vivent déjà les leads. Aucun contact avec EasyV4.
- **Option B** : héberger dans le CRM EasyV4. Cela exige l'accès à son dépôt et à sa base (non fournis), sa propre spécification et ses propres garde-fous ; Landing / Growth OS ne serait alors ni modifié ni lu.
Aucune requête ni écriture n'a été faite vers EasyV4. Les modèles de données et règles ci-dessous sont indépendants de l'hôte ; seul le SQL (§4) vise Landing.

## 1. Principe
Easy2Book mesure des **conversations, prospects et ventes**, pas des visites. Trois objets distincts :
- **Conversation** : un fil d'échange sur un canal (ou un lot anonyme du jour). **Une conversation n'est pas un prospect.**
- **Prospect** : un dossier (fiche) d'une personne identifiée. **Un prospect n'est pas une vente.**
- **Vente** : dossier réservé ou gagné, avec montant.
- Plusieurs conversations peuvent être rattachées au même prospect (la fiche reste unique).
- **Un lot quotidien anonyme ne crée aucun prospect et aucune vente fictive.**
L'étape est déduite, jamais stockée : *conversation seule* → *prospect* → *qualifié* → *devis* → *vendu* / *perdu*.

Idée directrice : Easy2Book garde le « cahier des ventes » du client (historique commercial) sans afficher son numéro privé sur chaque page.

## 2. Protection des données (règles acceptées)
1. **Aucune audience publicitaire sur données sensibles ou leur déduction** : « a demandé l'Omra » est un indicateur de religion → segment à usage interne seulement, aucun export vers Meta ou audience similaire sans validation écrite du propriétaire.
2. **Consentement marketing** requis pour tout export ; jamais le simple consentement de contact.
3. **Données minimales** : une conversation ne stocke ni texte de message ni nom.
4. **Un seul numéro de téléphone par fiche client.** Le téléphone reste **uniquement** dans la fiche Prospect ; il n'est **jamais copié** dans la conversation. Une conversation individuelle est reliée à la fiche (`lead_id`) ; sans fiche, elle ne porte aucun numéro.
5. **Accès au numéro limité aux employés autorisés** : le numéro n'est lisible que via la fiche, avec les droits existants (voir §5). La page Conversations et les exports d'indicateurs **n'affichent jamais de numéro**.
6. **Conservation définie, vérifiée juridiquement, avec anonymisation à l'expiration** (§7).
7. **Aucune activation sans validation humaine.**

## 3. Modèle de données
Table `landing_conversations` (une ligne = un fil de conversation individuel **ou** un lot du jour).

| Colonne | Rôle |
|---|---|
| `id`, `organization_id` | cloisonnement par entreprise (comme `landing_conversion_log`) |
| `kind` | `individuelle` ou `lot` |
| `channel` | `whatsapp`, `messenger`, `instagram`, `facebook_commentaire`, `telephone`, `autre` |
| `origin` | `annonce`, `organique`, `direct`, `inconnue` |
| `campaign`, `ad_id`, `niche` | rattachement (vides si inconnus) |
| `conversation_count` | 1 pour individuelle ; n pour un lot |
| `lead_id` | fiche reliée (nullable ; **toujours nul pour un lot**) ; porte le numéro, pas la conversation |
| `contact_ref` | identifiant technique de plateforme (BSUID/PSID/IGSID), **facultatif, réservé aux automatismes futurs**, jamais un téléphone ; effacé à l'anonymisation ; nul pour un lot |
| `started_at`, `last_activity_at`, `first_reply_at` | dates (la nouvelle conversation naît après 30 jours sans échange) |
| `messages_in`, `messages_out` | compteurs, sans texte |
| `status` | `ouverte`, `sans_suite`, `annulee` |
| `source_kind` | `saisie` ou `webhook` |
| `is_test`, `anonymized_at` | gouvernance |
| `created_by`, `created_at`, `updated_by`, `updated_at` | **traçabilité de l'auteur** |

Règles : valeurs contrôlées ; lot ⇒ ni fiche, ni `contact_ref` ; individuelle ⇒ `conversation_count = 1` ; **jamais de DELETE** (service : SELECT, INSERT, UPDATE) ; une erreur de saisie se corrige par `annulee` (la ligne reste, exclue des indicateurs), pas par suppression ; sécurité par ligne forcée ; service seul ; `organization_id` immuable.

## 4. SQL proposé — migration 0029 (NON appliquée)
Prérequis : migrations 0001 à 0028 (dont `landing_org_immutable`, `is_test`).
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
  lead_id UUID REFERENCES public.landing_leads (id) ON DELETE SET NULL,
  contact_ref TEXT CHECK (char_length(contact_ref) <= 100),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_reply_at TIMESTAMPTZ,
  messages_in INTEGER NOT NULL DEFAULT 0 CHECK (messages_in >= 0),
  messages_out INTEGER NOT NULL DEFAULT 0 CHECK (messages_out >= 0),
  status TEXT NOT NULL DEFAULT 'ouverte' CHECK (status IN ('ouverte', 'sans_suite', 'annulee')),
  source_kind TEXT NOT NULL DEFAULT 'saisie' CHECK (source_kind IN ('saisie', 'webhook')),
  is_test BOOLEAN NOT NULL DEFAULT false,
  anonymized_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT landing_conversations_lot_ck
    CHECK (kind <> 'lot' OR (lead_id IS NULL AND contact_ref IS NULL)),
  CONSTRAINT landing_conversations_indiv_ck
    CHECK (kind <> 'individuelle' OR conversation_count = 1),
  CONSTRAINT landing_conversations_dates_ck
    CHECK (last_activity_at >= started_at)
);
-- Aucune colonne de téléphone, de nom ni de texte : volontairement.
CREATE INDEX landing_conversations_org_date_idx ON public.landing_conversations (organization_id, started_at);
CREATE INDEX landing_conversations_lead_idx ON public.landing_conversations (lead_id);

ALTER TABLE public.landing_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_conversations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_conversations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.landing_conversations TO service_role;  -- pas de DELETE

CREATE TRIGGER landing_conversations_org_immutable
  BEFORE UPDATE ON public.landing_conversations
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable();
```
À livrer avec la migration (au GO, pas avant) : fichier de retour arrière, contrôle `postcheck-0029` (table, RLS forcée, absence de DELETE, absence de colonne téléphone, contraintes lot/individuelle), test PGlite, garde « refuse sur base EasyV4 ».

**Retour arrière** (aucune donnée perdue ailleurs : rien d'autre ne dépend de cette table) :
```sql
-- Refusé s'il existe des lignes : les exporter ou les annuler d'abord.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.landing_conversations) THEN
    RAISE EXCEPTION 'Retour arrière refusé : la table contient des conversations';
  END IF;
END $$;
DROP TABLE public.landing_conversations;
```
Retour arrière du code : retirer la page et les actions ; la page « migration non appliquée » existe déjà ; aucun autre module ne lit cette table.

## 5. Permissions (inchangées, testées côté serveur)
| Action | Qui | Règle serveur |
|---|---|---|
| Lire les conversations (sans numéro) | rôles ayant `leads.view_all` (employé, responsable, administrateur) | cloisonné par `organization_id` ; le numéro n'est jamais dans la réponse |
| Voir le numéro | uniquement via la fiche, droits existants de la fiche | aucune copie ailleurs |
| Créer/modifier une conversation individuelle reliée à une fiche | `canModifyLead` (employé : ses fiches ; responsable/administrateur : l'entreprise) | contrôlé côté serveur, pas seulement dans l'interface |
| Saisie d'un lot du jour | tout conseiller actif de l'entreprise | donnée agrégée, sans donnée personnelle |
| Super Admin | supervision sans contenu | ne voit aucun contenu de lead ni de conversation |
Traçabilité : `created_by`/`updated_by` renseignés par le serveur (jamais par le client) ; chaque création, correction ou annulation écrit une entrée dans `landing_admin_log` (auteur, zone « conversations », résumé sans donnée personnelle).

## 6. Anonymisation
- Quand une fiche est anonymisée (mécanisme existant `anonymized_at`), ses conversations sont anonymisées en cascade : `contact_ref` effacé, `lead_id` conservé ou délié selon décision, compteurs et dates **gardés** (historique commercial sans donnée personnelle), `anonymized_at` renseigné.
- Une conversation reliée à une fiche anonymisée devient non modifiable (comme les fiches).
- Les lots n'ont aucune donnée personnelle : rien à anonymiser.

## 7. Conservation
- **Décision du propriétaire (22/11/2026) :** les clients fidèles sont conservés ; le propriétaire indique que la loi permet jusqu'à 10 ans. **Règle retenue : 10 ans maximum après la dernière activité commerciale, puis anonymisation** de la fiche (numéros compris) et de ses conversations. « À vie » n'est pas retenu : il dépasse le plafond cité.
- **Base légale à consigner par écrit** (non vérifiée par Claude) : le délai de 10 ans correspond en général aux pièces comptables et contractuelles (devis, factures, réservations), pas automatiquement aux données de contact et de conversation. À confirmer par votre comptable ou conseil juridique, et à inscrire dans la politique de confidentialité avec la finalité (suivi client, fidélité).
- Garde-fous maintenus quelle que soit la durée : le retrait du consentement marketing arrête tout usage promotionnel ; une demande d'effacement d'un client est traitée par l'anonymisation existante ; aucun export publicitaire sur donnée sensible (§2).
- Étape 1 : **aucune purge automatique**. Anonymisation à la demande avec l'outil existant ; un traitement planifié à l'expiration sera proposé séparément (GO distinct).

## 8. Lots de l'étape 1 (chacun avec son GO)
**1a. Saisie et lecture** : page `/admin/conversations` (liste filtrable, sans numéro) ; « Saisie du jour » (lot) en 10 secondes ; « Nouvelle conversation » reliée à une fiche existante ou créée via la saisie manuelle de lead ; « ajouter une conversation » depuis la fiche ; annulation avec raison.
**1b. Mesure** : conversations, prospects issus de conversations, taux conversation → prospect → qualifié → vendu, coût par conversation, délai de première réponse ; seuils d'échantillon comme ailleurs (5 réservations).
**1c. Rapprochement Meta** : saisie manuelle hebdomadaire du nombre déclaré par Meta, alerte d'écart ; import CSV **ultérieur**.
**1d. Automatismes** (hors étape 1, GO séparé) : WhatsApp via le webhook existant, puis Messenger / Instagram.

## 9. Tests prévus
- Migration (PGlite) : contraintes lot/individuelle, valeurs contrôlées, **aucune colonne téléphone**, jamais de DELETE, cloisonnement, `organization_id` immuable.
- Fonctions pures : étape déduite, fenêtre de 30 jours, taux avec seuil.
- Actions serveur : droits par rôle (employé sur fiche non assignée refusé, Super Admin sans contenu), cloisonnement entre entreprises, `created_by` imposé par le serveur, aucune réponse contenant un téléphone, annulation sans suppression.
- Anonymisation en cascade ; fiche anonymisée non modifiable.
- e2e (faux Supabase) : saisie d'un lot, conversation reliée, pages /c inchangées, aucun événement Meta artificiel.

## 10. Déploiement (après GO)
GO migration → lecture avant, application, `postcheck-0029` → code → CI verte → GO fusion → déploiement → contrôle en production. Le code fonctionne avant la migration (page « migration non appliquée »).

## 11. Décisions
Confirmées le 22/11/2026 : (1) saisie hybride OUI ; (2) nouvelle conversation après 30 jours sans échange OUI ; (3) saisie par tous les conseillers dans leurs droits, avec traçabilité ; (4) conservation 10 ans maximum après la dernière activité puis anonymisation (décision du propriétaire, base légale à consigner), téléphone **uniquement** dans la fiche ; (5) canaux : WhatsApp, Messenger, Instagram, commentaire Facebook, téléphone, autre ; (6) rapprochement Meta : saisie hebdomadaire, import CSV plus tard.
**Confirmé :** hébergement option A (projet Landing Page / Growth OS).
**En attente :** consignation écrite de la base légale des 10 ans (§7) ; GO migration ; GO de chaque lot.
