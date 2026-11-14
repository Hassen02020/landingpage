-- Contrôle de 0019 (lecture seule). Attendu : 3 lignes OK.
SELECT '1. la contrainte de langue accepte fr, ar et en' AS controle,
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.landing_categories'::regclass AND contype = 'c'
                          AND pg_get_constraintdef(oid) LIKE '%lang%' AND pg_get_constraintdef(oid) LIKE '%''en''%'
                          AND pg_get_constraintdef(oid) LIKE '%''fr''%' AND pg_get_constraintdef(oid) LIKE '%''ar''%')
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. valeur par défaut inchangée (fr)',
       CASE WHEN (SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_categories' AND column_name = 'lang') LIKE '%fr%'
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. aucune page existante modifiée (aucune page en anglais avant la première utilisation)',
       CASE WHEN (SELECT count(*) FROM public.landing_categories WHERE lang = 'en') = 0 THEN 'OK'
            ELSE 'INFO : ' || (SELECT count(*) FROM public.landing_categories WHERE lang = 'en') || ' page(s) en anglais (normal après usage)' END;
