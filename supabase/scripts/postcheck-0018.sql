-- Contrôle de 0018 (lecture seule). Attendu : 4 lignes OK.
SELECT '1. colonne landing_categories.design présente (JSONB, NULL autorisé, sans valeur par défaut)' AS controle,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_categories'
                          AND column_name = 'design' AND data_type = 'jsonb' AND is_nullable = 'YES' AND column_default IS NULL)
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. contrainte de forme et de taille présente',
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_categories_design_check' AND conrelid = 'public.landing_categories'::regclass)
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. aucune page existante modifiée (aucune personnalisation avant la première utilisation)',
       CASE WHEN (SELECT count(*) FROM public.landing_categories WHERE design IS NOT NULL) = 0 THEN 'OK'
            ELSE 'INFO : ' || (SELECT count(*) FROM public.landing_categories WHERE design IS NOT NULL) || ' page(s) personnalisée(s) (normal après usage)' END
UNION ALL
SELECT '4. cloisonnement inchangé : RLS forcée, anon sans accès, service_role lit et modifie',
       CASE WHEN (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.landing_categories'::regclass)
             AND NOT has_table_privilege('anon', 'public.landing_categories', 'SELECT')
             AND has_table_privilege('service_role', 'public.landing_categories', 'SELECT')
             AND has_table_privilege('service_role', 'public.landing_categories', 'UPDATE')
            THEN 'OK' ELSE 'À CORRIGER' END;
