-- Retour arrière de 0028 : refusé tant que le journal contient des lignes (preuve d'envoi : exportez-les d'abord).
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.landing_conversion_log') IS NOT NULL AND EXISTS (SELECT 1 FROM public.landing_conversion_log) THEN
    RAISE EXCEPTION 'ARRÊT : le journal des conversions contient des lignes. Exportez-les, puis videz la table avant le retour arrière.';
  END IF;
END $$;
DROP TABLE IF EXISTS public.landing_conversion_log;
COMMIT;
