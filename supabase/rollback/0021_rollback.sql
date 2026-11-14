-- Retour arrière de 0021 : refusé tant qu'une programmation existe (elle serait perdue : annulez-la d'abord dans le Créateur).
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_categories' AND column_name = 'publish_at')
     AND EXISTS (SELECT 1 FROM public.landing_categories WHERE publish_at IS NOT NULL OR unpublish_at IS NOT NULL) THEN
    RAISE EXCEPTION 'ARRÊT : des pages ont une programmation. Annulez-la avant le retour arrière.';
  END IF;
END $$;
DROP INDEX IF EXISTS public.landing_categories_schedule_idx;
ALTER TABLE public.landing_categories DROP CONSTRAINT IF EXISTS landing_categories_schedule_check;
ALTER TABLE public.landing_categories DROP COLUMN IF EXISTS publish_at, DROP COLUMN IF EXISTS unpublish_at;
COMMIT;
