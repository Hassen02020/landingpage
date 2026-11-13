-- Retour arrière de 0018 : refusé tant que des pages ont une personnalisation (elle serait perdue : exportez-la ou videz-la d'abord).
-- Effet : les pages reprennent leur rendu par défaut ; aucune autre donnée n'est touchée.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_categories' AND column_name = 'design')
     AND EXISTS (SELECT 1 FROM public.landing_categories WHERE design IS NOT NULL) THEN
    RAISE EXCEPTION 'ARRÊT : des pages ont une personnalisation enregistrée. Exportez-la ou remettez design à NULL avant le retour arrière.';
  END IF;
END $$;
ALTER TABLE public.landing_categories DROP CONSTRAINT IF EXISTS landing_categories_design_check;
ALTER TABLE public.landing_categories DROP COLUMN IF EXISTS design;
COMMIT;
