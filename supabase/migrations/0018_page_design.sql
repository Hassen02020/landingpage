-- =====================================================================
-- Easy2Book landing — 0018 : personnalisation des pages du Créateur (couleurs, fond, bouton, ordre des sections, FAQ, témoignages, programme)
--   • UNE colonne ajoutée : landing_categories.design (JSONB, NULL par défaut) ;
--   • aucune page existante n'est modifiée (design = NULL → rendu actuel inchangé) ; aucune nouvelle table, aucun nouveau droit ;
--   • la validation fine (couleurs, longueurs, sections autorisées) reste côté serveur (lib/page-builder/design.ts) ;
--     la base garantit seulement : objet JSON, taille bornée.
-- Cloisonnement : la colonne appartient à la ligne de la catégorie, donc à son organisation (organization_id, RLS FORCÉE et droits
--   service_role de 0004 inchangés : seul le serveur lit et écrit).
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0008. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0018_rollback.sql (refusé si des personnalisations existent). Contrôle : supabase/scripts/postcheck-0018.sql.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_categories') IS NULL
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_categories' AND column_name = 'organization_id') THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0004 puis 0008 (landing_categories avec organization_id).';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_categories' AND column_name = 'design') THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0018 a déjà été appliquée.';
  END IF;
END $$;

ALTER TABLE public.landing_categories
  ADD COLUMN design JSONB
  CONSTRAINT landing_categories_design_check
  CHECK (design IS NULL OR (jsonb_typeof(design) = 'object' AND octet_length(design::text) <= 16000));

COMMENT ON COLUMN public.landing_categories.design IS 'Personnalisation de la page publique /p/<adresse> (JSON validé côté serveur). NULL = rendu par défaut du modèle.';

COMMIT;
