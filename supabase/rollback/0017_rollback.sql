-- Retour arrière de 0017 : refusé tant que des coûts variables existent (données financières).
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.landing_variable_costs) THEN
    RAISE EXCEPTION 'ARRÊT : des coûts variables sont enregistrés. Exportez-les avant le retour arrière.';
  END IF;
END $$;
DROP TABLE IF EXISTS public.landing_variable_costs;
DROP FUNCTION IF EXISTS public.landing_variable_costs_guard();
COMMIT;
