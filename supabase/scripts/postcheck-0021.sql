-- Contrôle de 0021 (lecture seule). Attendu : 3 lignes OK.
SELECT '1. colonnes publish_at et unpublish_at présentes (horodatage, NULL autorisé, sans valeur par défaut)' AS controle,
       CASE WHEN (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_categories'
                   AND column_name IN ('publish_at', 'unpublish_at') AND data_type = 'timestamp with time zone' AND is_nullable = 'YES' AND column_default IS NULL) = 2
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. contrainte « masquage après publication » présente',
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_categories_schedule_check' AND conrelid = 'public.landing_categories'::regclass)
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. aucune page existante modifiée (aucune programmation avant la première utilisation)',
       CASE WHEN (SELECT count(*) FROM public.landing_categories WHERE publish_at IS NOT NULL OR unpublish_at IS NOT NULL) = 0 THEN 'OK'
            ELSE 'INFO : ' || (SELECT count(*) FROM public.landing_categories WHERE publish_at IS NOT NULL OR unpublish_at IS NOT NULL) || ' page(s) programmée(s) (normal après usage)' END;
