-- Retour arrière de 0025 : refusé tant qu'il existe des avis (exportez-les d'abord).
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.landing_reviews') IS NOT NULL AND EXISTS (SELECT 1 FROM public.landing_reviews) THEN
    RAISE EXCEPTION 'ARRÊT : des avis existent. Exportez-les avant le retour arrière.';
  END IF;
END $$;
DROP TABLE IF EXISTS public.landing_reviews;
COMMIT;
