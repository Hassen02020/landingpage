-- Retour arrière de 0015 : refusé tant qu'une page est ACTIVÉE (les leads Facebook ne seraient plus rattachés).
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.landing_meta_pages WHERE enabled) THEN
    RAISE EXCEPTION 'ARRÊT : des pages Facebook sont activées. Désactivez-les avant le retour arrière.';
  END IF;
END $$;
DROP TABLE IF EXISTS public.landing_meta_pages;
COMMIT;
