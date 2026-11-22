-- Retour arrière de 0029 : refusé tant que la table contient des lignes (exportez ou annulez-les d'abord). Aucun autre module ne dépend de cette table.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.landing_conversations') IS NOT NULL AND EXISTS (SELECT 1 FROM public.landing_conversations) THEN
    RAISE EXCEPTION 'ARRÊT : landing_conversations contient des lignes. Exportez-les, puis videz la table avant le retour arrière.';
  END IF;
END $$;
DROP TABLE IF EXISTS public.landing_conversations;
COMMIT;
