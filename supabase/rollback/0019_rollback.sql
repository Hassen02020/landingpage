-- Retour arrière de 0019 : refusé tant qu'une page est en anglais (le retour casserait la contrainte).
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.landing_categories WHERE lang = 'en') THEN
    RAISE EXCEPTION 'ARRÊT : des pages sont en anglais. Changez leur langue avant le retour arrière.';
  END IF;
END $$;
ALTER TABLE public.landing_categories DROP CONSTRAINT IF EXISTS landing_categories_lang_check;
ALTER TABLE public.landing_categories ADD CONSTRAINT landing_categories_lang_check CHECK (lang IN ('fr', 'ar'));
COMMIT;
