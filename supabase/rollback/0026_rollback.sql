-- Retour arrière de 0026 : refusé tant qu'une donnée de gouvernance existe (elle serait perdue : exportez-la d'abord).
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.landing_leads WHERE is_test OR lost_reason IS NOT NULL OR purchased_product IS NOT NULL) THEN
    RAISE EXCEPTION 'ARRÊT : des leads de test, motifs de perte ou produits achetés existent. Exportez-les, puis videz ces colonnes avant le retour arrière.';
  END IF;
END $$;
ALTER TABLE public.landing_leads DROP COLUMN IF EXISTS is_test, DROP COLUMN IF EXISTS lost_reason, DROP COLUMN IF EXISTS purchased_product;
COMMIT;
