-- Contrôle de 0027 (lecture seule). Attendu : 3 lignes OK.
SELECT '1. colonne age_range : texte, nullable, sans valeur par défaut' AS controle,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads' AND column_name = 'age_range'
                          AND data_type = 'text' AND is_nullable = 'YES' AND column_default IS NULL)
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. valeurs contrôlées (18-24, 25-34, 35-44, 45-54, 55+)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_leads_age_range_check' AND conrelid = 'public.landing_leads'::regclass
                          AND pg_get_constraintdef(oid) LIKE '%18-24%' AND pg_get_constraintdef(oid) LIKE '%55+%')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. aucune tranche d''âge enregistrée par la migration elle-même (rien n''a été modifié)',
       CASE WHEN (SELECT count(*) FROM public.landing_leads WHERE age_range IS NOT NULL) = 0 THEN 'OK' ELSE 'À VÉRIFIER (des tranches ont pu être saisies depuis l''application)' END;
