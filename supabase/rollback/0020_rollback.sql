-- Retour arrière de 0020 : refusé tant que des versions existent (l'historique serait perdu : exportez-le d'abord).
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.landing_page_versions') IS NOT NULL AND EXISTS (SELECT 1 FROM public.landing_page_versions) THEN
    RAISE EXCEPTION 'ARRÊT : des versions de pages existent. Exportez-les avant le retour arrière.';
  END IF;
END $$;
DROP TABLE IF EXISTS public.landing_page_versions;
DROP FUNCTION IF EXISTS public.landing_page_versions_check_org();
COMMIT;
