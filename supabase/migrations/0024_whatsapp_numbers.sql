-- =====================================================================
-- Easy2Book landing — 0024 : numéros WhatsApp Business rattachés à une entreprise (chantier 3 — WhatsApp entrant)
--   • landing_whatsapp_numbers : UN numéro WhatsApp Business (identifiant « phone_number_id » de Meta) appartient à UNE seule entreprise
--     (unique sur toute la plateforme). Sert à retrouver l'entreprise d'un message entrant AVANT de connaître son contexte :
--     lecture par le serveur seulement (service_role), jamais par un compte d'utilisateur. Aucun jeton n'y est stocké (réception seule).
--   • désactivé par défaut : rien n'est reçu tant que le propriétaire n'a pas activé le numéro.
-- Rien n'est modifié pour Easy2Book tant qu'aucun numéro n'est enregistré.
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0008. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0024_rollback.sql (refusé si un numéro est activé). Contrôle : supabase/scripts/postcheck-0024.sql.
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
  IF to_regclass('public.landing_whatsapp_numbers') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0024 a déjà été appliquée.';
  END IF;
END $$;

CREATE TABLE public.landing_whatsapp_numbers (
  phone_number_id TEXT PRIMARY KEY CHECK (phone_number_id ~ '^[0-9]{5,25}$'),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  display_phone   TEXT CHECK (char_length(display_phone) <= 30),
  enabled         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID
);
CREATE INDEX landing_whatsapp_numbers_org_idx ON public.landing_whatsapp_numbers (organization_id);

ALTER TABLE public.landing_whatsapp_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_whatsapp_numbers FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_whatsapp_numbers FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.landing_whatsapp_numbers TO service_role;

CREATE TRIGGER landing_org_immutable BEFORE UPDATE OF organization_id ON public.landing_whatsapp_numbers
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable();

COMMIT;
