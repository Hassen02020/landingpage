-- Contrôle de 0026 (lecture seule). Attendu : 4 lignes OK.
SELECT '1. colonne is_test : booléen, NOT NULL, défaut faux' AS controle,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads' AND column_name = 'is_test'
                          AND data_type = 'boolean' AND is_nullable = 'NO' AND column_default = 'false')
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. colonnes lost_reason et purchased_product : texte, nullables, contrôlées',
       CASE WHEN (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads'
                   AND column_name IN ('lost_reason', 'purchased_product') AND data_type = 'text' AND is_nullable = 'YES') = 2
             AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_leads_lost_reason_check' AND conrelid = 'public.landing_leads'::regclass)
             AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_leads_purchased_product_check' AND conrelid = 'public.landing_leads'::regclass)
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. aucun lead existant marqué test, avec motif ou produit acheté (rien n''a été modifié)',
       CASE WHEN (SELECT count(*) FROM public.landing_leads WHERE is_test OR lost_reason IS NOT NULL OR purchased_product IS NOT NULL) = 0 THEN 'OK' ELSE 'À VÉRIFIER (des marquages ont pu être faits depuis l''application)' END
UNION ALL
SELECT '4. aucun accès direct ouvert aux comptes d''utilisateurs sur la table des leads',
       CASE WHEN NOT has_table_privilege('anon', 'public.landing_leads', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.landing_leads', 'UPDATE')
            THEN 'OK' ELSE 'À CORRIGER' END;
