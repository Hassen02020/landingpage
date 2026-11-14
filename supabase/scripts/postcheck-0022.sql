-- Contrôle de 0022 (lecture seule). Attendu : 3 lignes OK.
SELECT '1. contrainte de taille relevée à 64 000 octets (objet JSON ou NULL)' AS controle,
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_categories_design_check' AND conrelid = 'public.landing_categories'::regclass
                          AND pg_get_constraintdef(oid) LIKE '%64000%' AND pg_get_constraintdef(oid) LIKE '%jsonb_typeof%')
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. aucune personnalisation existante modifiée ni invalidée',
       CASE WHEN (SELECT count(*) FROM public.landing_categories WHERE design IS NOT NULL AND octet_length(design::text) > 64000) = 0 THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. colonne design toujours nullable, sans valeur par défaut',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_categories'
                          AND column_name = 'design' AND data_type = 'jsonb' AND is_nullable = 'YES' AND column_default IS NULL)
            THEN 'OK' ELSE 'À CORRIGER' END;
