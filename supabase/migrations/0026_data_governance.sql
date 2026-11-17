-- =====================================================================
-- Easy2Book landing — 0026 : GOUVERNANCE DES DONNÉES (Intelligence Center, Phase 1)
--   • is_test           : marque un lead de TEST (exclu des analyses) ; défaut faux, donc tout lead existant reste un vrai lead ;
--   • lost_reason       : motif de perte (liste contrôlée), facultatif ;
--   • purchased_product : produit réellement ACHETÉ (peut différer du produit demandé), facultatif.
-- Aucune ligne existante n'est modifiée. Aucune donnée personnelle ajoutée. Le trigger de garde des leads ne touche pas ces colonnes.
-- Prérequis : 0001 à 0025. À exécuter UNIQUEMENT dans le projet Supabase des landing pages. JAMAIS dans EasyV4.
-- Le code fonctionne AVANT cette migration (contrôles « indisponibles ») : ordre conseillé = migration, puis déploiement.
-- Retour arrière : supabase/rollback/0026_rollback.sql (refusé si des données existent). Contrôle : supabase/scripts/postcheck-0026.sql.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_leads') IS NULL OR to_regclass('public.landing_reviews') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0001 à 0025.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads'
              AND column_name IN ('is_test', 'lost_reason', 'purchased_product')) THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0026 a déjà été appliquée (au moins une colonne existe).';
  END IF;
END $$;

ALTER TABLE public.landing_leads
  ADD COLUMN is_test BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN lost_reason TEXT
    CONSTRAINT landing_leads_lost_reason_check CHECK (lost_reason IN ('prix', 'disponibilite', 'delai_reponse', 'concurrence', 'pas_de_suivi', 'injoignable', 'plus_interesse', 'hors_zone', 'autre')),
  ADD COLUMN purchased_product TEXT
    CONSTRAINT landing_leads_purchased_product_check CHECK (purchased_product IN ('omra', 'voyage', 'hotel', 'autre'));

COMMENT ON COLUMN public.landing_leads.is_test IS 'Lead de TEST (essai de formulaire, démonstration) : exclu des statistiques, de la rentabilité, des clients et de l''export. Visible dans la liste des leads.';
COMMENT ON COLUMN public.landing_leads.lost_reason IS 'Motif de perte, facultatif (liste contrôlée). Effacé si le lead quitte le statut « perdu ».';
COMMENT ON COLUMN public.landing_leads.purchased_product IS 'Produit réellement acheté (peut différer du produit demandé), renseigné à la réservation.';

COMMIT;
