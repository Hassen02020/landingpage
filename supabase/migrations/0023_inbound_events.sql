-- =====================================================================
-- Easy2Book landing — 0023 : journal des événements entrants (chantier 3 — acquisition automatique des leads)
--   • landing_inbound_events : une ligne par événement reçu d'un canal externe (Facebook, Instagram, TikTok, WhatsApp) et par tentative,
--     avec son ISSUE : created / duplicate / ignored / dropped / retry, et un code de raison.
--   • AUCUNE donnée personnelle : ni nom, ni téléphone, ni e-mail, ni texte de message. Seulement la plateforme, l'identifiant externe
--     (leadgen_id, wamid…), la page ou le numéro, l'état et le code de raison. Sert à constater qu'un lead n'a pas été perdu en silence.
--   • Registre à AJOUT SEUL, cloisonné par entreprise (organization_id), accessible au serveur seulement (aucun droit pour les comptes d'utilisateur).
-- Sans effet sur les tables existantes. À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0008. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0023_rollback.sql (refusé si le journal contient des lignes). Contrôle : supabase/scripts/postcheck-0023.sql.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0008 (0008_multitenant_foundation.sql).';
  END IF;
  IF to_regclass('public.landing_inbound_events') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0023 a déjà été appliquée.';
  END IF;
END $$;

CREATE TABLE public.landing_inbound_events (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  platform        TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'whatsapp')),
  external_id     TEXT NOT NULL CHECK (char_length(external_id) BETWEEN 1 AND 100),
  source_ref      TEXT CHECK (char_length(source_ref) <= 40),   -- identifiant de page ou de numéro (jamais un jeton)
  status          TEXT NOT NULL CHECK (status IN ('created', 'duplicate', 'ignored', 'dropped', 'retry')),
  reason          TEXT CHECK (char_length(reason) <= 120),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX landing_inbound_events_org_idx ON public.landing_inbound_events (organization_id, created_at DESC);
CREATE INDEX landing_inbound_events_org_platform_idx ON public.landing_inbound_events (organization_id, platform, created_at DESC);

ALTER TABLE public.landing_inbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_inbound_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_inbound_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.landing_inbound_events TO service_role;   -- ajout seul : ni UPDATE ni DELETE

CREATE TRIGGER landing_org_immutable BEFORE UPDATE OF organization_id ON public.landing_inbound_events
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable();

COMMIT;
