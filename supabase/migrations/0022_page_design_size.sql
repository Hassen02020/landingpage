-- =====================================================================
-- Easy2Book landing — 0022 : TAILLE de la personnalisation relevée à 64 000 octets (lot B : blocs personnalisés)
--   • la contrainte de 0018 (16 000 octets) est remplacée par la même règle avec 64 000 octets ;
--   • aucune donnée n'est modifiée : tout ce qui est stocké aujourd'hui reste valide ; la règle « objet JSON ou NULL » est inchangée.
-- Le serveur continue de valider chaque personnalisation (blocs, textes, adresses d'images) et limite sa taille à 60 000 octets (forme PostgreSQL).
-- Prérequis : 0018. À exécuter UNIQUEMENT dans le projet Supabase des landing pages. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0022_rollback.sql (refusé si une personnalisation dépasse 16 000 octets). Contrôle : supabase/scripts/postcheck-0022.sql.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_categories_design_check' AND conrelid = to_regclass('public.landing_categories')) THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0018 (colonne design et sa contrainte).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_categories_design_check' AND conrelid = to_regclass('public.landing_categories')
              AND pg_get_constraintdef(oid) LIKE '%64000%') THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0022 a déjà été appliquée.';
  END IF;
END $$;

ALTER TABLE public.landing_categories DROP CONSTRAINT landing_categories_design_check;
ALTER TABLE public.landing_categories
  ADD CONSTRAINT landing_categories_design_check
  CHECK (design IS NULL OR (jsonb_typeof(design) = 'object' AND octet_length(design::text) <= 64000));

COMMIT;
