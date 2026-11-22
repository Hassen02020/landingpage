-- =====================================================================
-- Easy2Book landing — 0029 : CONVERSATIONS (étape 1 du chantier Growth & Marketing Intelligence)
--   • landing_conversations : une ligne = un fil de conversation individuel OU un lot anonyme du jour (« n conversations, tel canal »).
--   • Une conversation n'est pas un prospect ; un prospect n'est pas une vente. Un lot ne crée ni fiche ni vente.
--   • AUCUN téléphone, AUCUN nom, AUCUN texte de message : le numéro reste dans la fiche du lead (lead_id). contact_ref = identifiant technique
--     de plateforme facultatif (jamais un téléphone), effacé à l'anonymisation.
--   • Traçabilité : created_by / updated_by / updated_at. Correction par le statut « annulee » : JAMAIS de DELETE.
--   • Cloisonné par entreprise (organization_id), accessible au serveur seulement.
-- Prérequis : 0001 à 0026. À exécuter UNIQUEMENT dans le projet Supabase des landing pages. JAMAIS dans EasyV4.
-- Le code fonctionne AVANT cette migration (page « migration non appliquée »). Ordre : migration, puis déploiement.
-- Retour arrière : supabase/rollback/0029_rollback.sql (refusé si la table contient des lignes). Contrôle : supabase/scripts/postcheck-0029.sql.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads' AND column_name = 'is_test') THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0001 à 0026.';
  END IF;
  IF to_regclass('public.landing_conversations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0029 a déjà été appliquée.';
  END IF;
END $$;

CREATE TABLE public.landing_conversations (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id    UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  kind               TEXT NOT NULL CHECK (kind IN ('individuelle', 'lot')),
  channel            TEXT NOT NULL CHECK (channel IN ('whatsapp', 'messenger', 'instagram', 'facebook_commentaire', 'telephone', 'autre')),
  origin             TEXT NOT NULL DEFAULT 'inconnue' CHECK (origin IN ('annonce', 'organique', 'direct', 'inconnue')),
  campaign           TEXT CHECK (char_length(campaign) <= 255),
  ad_id              TEXT CHECK (char_length(ad_id) <= 64),
  niche              TEXT CHECK (char_length(niche) <= 64),
  conversation_count INTEGER NOT NULL DEFAULT 1 CHECK (conversation_count BETWEEN 1 AND 1000),
  lead_id            UUID REFERENCES public.landing_leads (id) ON DELETE SET NULL,   -- la fiche porte le numéro, pas la conversation
  contact_ref        TEXT CHECK (char_length(contact_ref) <= 100),                   -- identifiant technique (jamais un téléphone), automatismes futurs
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_reply_at     TIMESTAMPTZ,
  messages_in        INTEGER NOT NULL DEFAULT 0 CHECK (messages_in >= 0),
  messages_out       INTEGER NOT NULL DEFAULT 0 CHECK (messages_out >= 0),
  status             TEXT NOT NULL DEFAULT 'ouverte' CHECK (status IN ('ouverte', 'sans_suite', 'annulee')),
  source_kind        TEXT NOT NULL DEFAULT 'saisie' CHECK (source_kind IN ('saisie', 'webhook')),
  is_test            BOOLEAN NOT NULL DEFAULT false,
  anonymized_at      TIMESTAMPTZ,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         UUID,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT landing_conversations_lot_ck   CHECK (kind <> 'lot' OR (lead_id IS NULL AND contact_ref IS NULL)),
  CONSTRAINT landing_conversations_indiv_ck CHECK (kind <> 'individuelle' OR conversation_count = 1),
  CONSTRAINT landing_conversations_dates_ck CHECK (last_activity_at >= started_at)
);
CREATE INDEX landing_conversations_org_date_idx ON public.landing_conversations (organization_id, started_at);
CREATE INDEX landing_conversations_lead_idx ON public.landing_conversations (lead_id);

ALTER TABLE public.landing_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_conversations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_conversations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.landing_conversations TO service_role;   -- jamais de DELETE

CREATE TRIGGER landing_org_immutable BEFORE UPDATE OF organization_id ON public.landing_conversations
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable();

COMMENT ON TABLE public.landing_conversations IS 'Conversations (individuelles ou lots anonymes). Aucun téléphone, nom ni texte : le numéro reste dans la fiche.';

COMMIT;
