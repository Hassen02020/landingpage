-- Contrôle de 0014 (lecture seule). Attendu : 5 lignes OK.
SELECT '1. table landing_form_configs présente, RLS activée et forcée' AS controle,
       CASE WHEN to_regclass('public.landing_form_configs') IS NOT NULL
             AND (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.landing_form_configs'))
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. colonne landing_leads.custom_fields présente',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads' AND column_name = 'custom_fields')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. service_role lit et écrit la configuration ; anon n''y accède pas',
       CASE WHEN to_regclass('public.landing_form_configs') IS NOT NULL
             AND has_table_privilege('service_role', 'public.landing_form_configs', 'INSERT')
             AND has_table_privilege('service_role', 'public.landing_form_configs', 'UPDATE')
             AND NOT has_table_privilege('anon', 'public.landing_form_configs', 'SELECT')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '4. aucun droit de suppression sur la configuration (service_role, authenticated, anon)',
       CASE WHEN to_regclass('public.landing_form_configs') IS NOT NULL
             AND NOT has_table_privilege('service_role', 'public.landing_form_configs', 'DELETE')
             AND NOT has_table_privilege('authenticated', 'public.landing_form_configs', 'DELETE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '5. l''anonymisation efface aussi custom_fields',
       CASE WHEN pg_get_functiondef('public.landing_purge_personal_data()'::regprocedure) LIKE '%custom_fields = NULL%'
            THEN 'OK' ELSE 'À CORRIGER' END;
