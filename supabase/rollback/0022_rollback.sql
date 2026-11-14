-- Retour arrière de 0022 : refusé tant qu'une personnalisation dépasse 16 000 octets (elle violerait l'ancienne contrainte : raccourcissez-la d'abord).
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.landing_categories WHERE design IS NOT NULL AND octet_length(design::text) > 16000) THEN
    RAISE EXCEPTION 'ARRÊT : des personnalisations dépassent 16 000 octets. Raccourcissez-les (retirez des blocs) avant le retour arrière.';
  END IF;
END $$;
ALTER TABLE public.landing_categories DROP CONSTRAINT IF EXISTS landing_categories_design_check;
ALTER TABLE public.landing_categories
  ADD CONSTRAINT landing_categories_design_check
  CHECK (design IS NULL OR (jsonb_typeof(design) = 'object' AND octet_length(design::text) <= 16000));
COMMIT;
