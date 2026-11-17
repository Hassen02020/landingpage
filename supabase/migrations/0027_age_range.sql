-- =====================================================================
-- Easy2Book landing — 0027 : TRANCHE D'ÂGE DÉCLARÉE (facultative)
--   • age_range : tranche choisie librement par le visiteur dans le formulaire (18-24, 25-34, 35-44, 45-54, 55+) ; NULL = non renseignée
--     ou « je préfère ne pas répondre ». JAMAIS déduite d'un nom, d'une photo ou d'un autre signal ; JAMAIS envoyée à Meta / TikTok.
-- Aucune ligne existante n'est modifiée (colonne nullable, sans valeur par défaut). Le champ n'apparaît dans le formulaire que sur les pages où
-- le propriétaire l'active (désactivé par défaut) APRÈS validation du texte d'information.
-- Prérequis : 0001 à 0026. À exécuter UNIQUEMENT dans le projet Supabase des landing pages. JAMAIS dans EasyV4.
-- Le code fonctionne AVANT cette migration (la valeur est ignorée si la colonne manque) : ordre conseillé = migration, puis déploiement.
-- Retour arrière : supabase/rollback/0027_rollback.sql (refusé si des données existent). Contrôle : supabase/scripts/postcheck-0027.sql.
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
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads' AND column_name = 'age_range') THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0027 a déjà été appliquée.';
  END IF;
END $$;

ALTER TABLE public.landing_leads
  ADD COLUMN age_range TEXT
    CONSTRAINT landing_leads_age_range_check CHECK (age_range IN ('18-24', '25-34', '35-44', '45-54', '55+'));

COMMENT ON COLUMN public.landing_leads.age_range IS 'Tranche d''âge DÉCLARÉE par le visiteur (facultatif). Jamais déduite, jamais envoyée aux plateformes publicitaires.';

COMMIT;
