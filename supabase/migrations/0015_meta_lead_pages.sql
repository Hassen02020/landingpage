-- =====================================================================
-- Easy2Book landing — 0015 : pages Facebook rattachées à une entreprise (Meta Lead Ads, lot 2 des leads multicanaux)
--   • landing_meta_pages : UNE page Facebook appartient à UNE seule entreprise (page_id unique sur toute la plateforme) ;
--     elle porte le jeton d'accès de la Page (chiffré par le serveur) et la confirmation du propriétaire que le
--     formulaire instantané demande bien l'accord d'être recontacté (sans cette confirmation, aucun lead n'est enregistré).
-- Cette table sert à retrouver l'entreprise d'un événement entrant AVANT de connaître son contexte : elle n'est donc pas
-- filtrée par organisation côté serveur ; seul le serveur (service_role) y accède, jamais un compte d'utilisateur.
-- Rien n'est modifié pour Easy2Book tant qu'aucune page n'est enregistrée.
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0008. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0015_rollback.sql. Contrôle : supabase/scripts/postcheck-0015.sql.
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
  IF to_regclass('public.landing_meta_pages') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0015 a déjà été appliquée.';
  END IF;
END $$;

CREATE TABLE public.landing_meta_pages (
  page_id           TEXT PRIMARY KEY CHECK (page_id ~ '^[0-9]{5,25}$'),
  organization_id   UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  page_name         TEXT CHECK (char_length(page_name) <= 200),
  enabled           BOOLEAN NOT NULL DEFAULT false,
  -- le propriétaire confirme que le formulaire instantané demande l'accord d'être recontacté
  consent_confirmed BOOLEAN NOT NULL DEFAULT false,
  -- jeton d'accès de la Page, chiffré par le serveur du site (format v1:iv:tag:données, base64url)
  token_ciphertext  TEXT NOT NULL CHECK (token_ciphertext ~ '^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
  token_last4       TEXT NOT NULL CHECK (char_length(token_last4) BETWEEN 1 AND 4),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID
);
CREATE INDEX landing_meta_pages_org_idx ON public.landing_meta_pages (organization_id);

ALTER TABLE public.landing_meta_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_meta_pages FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_meta_pages FROM PUBLIC, anon, authenticated, service_role;
-- aucun droit pour un compte d'utilisateur (le jeton chiffré n'est lisible que par le serveur) ; pas de suppression
GRANT SELECT, INSERT, UPDATE ON public.landing_meta_pages TO service_role;

CREATE TRIGGER landing_org_immutable BEFORE UPDATE OF organization_id ON public.landing_meta_pages
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable();

COMMIT;
