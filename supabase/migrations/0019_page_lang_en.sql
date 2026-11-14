-- =====================================================================
-- Easy2Book landing — 0019 : langue ANGLAISE pour les pages du Créateur (lot E)
--   • landing_categories.lang accepte désormais 'en' (en plus de 'fr' et 'ar') ;
--   • aucune donnée n'est modifiée ; les pages existantes gardent leur langue ; valeur par défaut inchangée ('fr').
-- Prérequis : 0004. À exécuter UNIQUEMENT dans le projet Supabase des landing pages. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0019_rollback.sql (refusé si une page est en anglais). Contrôle : supabase/scripts/postcheck-0019.sql.
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
  IF EXISTS (SELECT 1 FROM pg_constraint con JOIN pg_class t ON t.oid = con.conrelid
              WHERE t.relname = 'landing_categories' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%''en''%') THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0019 a déjà été appliquée.';
  END IF;
END $$;

-- l'ancienne contrainte (nom automatique, quel qu'il soit) est retrouvée par sa définition
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN SELECT con.conname FROM pg_constraint con JOIN pg_class t ON t.oid = con.conrelid
            WHERE t.relname = 'landing_categories' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%lang%' LOOP
    EXECUTE format('ALTER TABLE public.landing_categories DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.landing_categories ADD CONSTRAINT landing_categories_lang_check CHECK (lang IN ('fr', 'ar', 'en'));

COMMIT;
