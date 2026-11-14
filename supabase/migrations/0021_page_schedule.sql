-- =====================================================================
-- Easy2Book landing — 0021 : PUBLICATION PROGRAMMÉE des pages du Créateur (lot D)
--   • landing_categories.publish_at   : instant où une page MASQUÉE doit être publiée ;
--   • landing_categories.unpublish_at : instant où une page PUBLIÉE doit être masquée ;
--   • deux colonnes NULL par défaut : aucune page existante n'est modifiée, aucune programmation n'existe avant la première utilisation.
-- La base ne publie rien toute seule : c'est le serveur (route protégée par secret, ou bouton de l'équipe) qui applique les programmations échues,
-- avec les MÊMES contrôles de complétude que la publication manuelle.
-- Prérequis : 0004. À exécuter UNIQUEMENT dans le projet Supabase des landing pages. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0021_rollback.sql (refusé si une programmation existe). Contrôle : supabase/scripts/postcheck-0021.sql.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_categories') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0004 (landing_categories).';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_categories' AND column_name IN ('publish_at', 'unpublish_at')) THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0021 a déjà été appliquée.';
  END IF;
END $$;

ALTER TABLE public.landing_categories
  ADD COLUMN publish_at   TIMESTAMPTZ,
  ADD COLUMN unpublish_at TIMESTAMPTZ,
  ADD CONSTRAINT landing_categories_schedule_check CHECK (publish_at IS NULL OR unpublish_at IS NULL OR unpublish_at > publish_at);

-- le serveur ne cherche que les pages programmées : index partiel, minuscule
CREATE INDEX landing_categories_schedule_idx ON public.landing_categories (publish_at, unpublish_at)
  WHERE publish_at IS NOT NULL OR unpublish_at IS NOT NULL;

COMMENT ON COLUMN public.landing_categories.publish_at   IS 'Publication programmée (page masquée) : appliquée par le serveur, jamais par la base.';
COMMENT ON COLUMN public.landing_categories.unpublish_at IS 'Masquage programmé (page publiée) : appliqué par le serveur, jamais par la base.';

COMMIT;
