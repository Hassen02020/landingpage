-- Retour arrière de 0023 : refusé tant que le journal contient des lignes (exportez-les d'abord).
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.landing_inbound_events') IS NOT NULL AND EXISTS (SELECT 1 FROM public.landing_inbound_events) THEN
    RAISE EXCEPTION 'ARRÊT : le journal des événements entrants contient des lignes. Exportez-les avant le retour arrière.';
  END IF;
END $$;
DROP TABLE IF EXISTS public.landing_inbound_events;
COMMIT;
