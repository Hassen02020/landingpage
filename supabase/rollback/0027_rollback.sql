-- Retour arrière de 0027 : refusé tant qu'une tranche d'âge est enregistrée (elle serait perdue : exportez-la d'abord).
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.landing_leads WHERE age_range IS NOT NULL) THEN
    RAISE EXCEPTION 'ARRÊT : des tranches d''âge sont enregistrées. Exportez-les, puis videz la colonne avant le retour arrière.';
  END IF;
END $$;
ALTER TABLE public.landing_leads DROP COLUMN IF EXISTS age_range;
COMMIT;
