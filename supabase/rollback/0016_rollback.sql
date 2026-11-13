-- Retour arrière de 0016 : refusé tant que des dépenses ou des commissions existent (données financières, elles seraient perdues).
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.landing_ad_spend) OR EXISTS (SELECT 1 FROM public.landing_commissions) THEN
    RAISE EXCEPTION 'ARRÊT : des dépenses ou des commissions sont enregistrées. Exportez-les avant le retour arrière.';
  END IF;
END $$;
DROP TABLE IF EXISTS public.landing_commissions;
DROP TABLE IF EXISTS public.landing_ad_spend;
DROP FUNCTION IF EXISTS public.landing_commissions_guard();
DROP FUNCTION IF EXISTS public.landing_ad_spend_check_void();
COMMIT;
