-- Contrôle de 0020 (lecture seule). Attendu : 4 lignes OK.
SELECT '1. table landing_page_versions présente, sécurité par ligne activée et forcée' AS controle,
       CASE WHEN to_regclass('public.landing_page_versions') IS NOT NULL
             AND (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.landing_page_versions'))
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. service_role lit et ajoute ; anon n''y accède pas',
       CASE WHEN to_regclass('public.landing_page_versions') IS NOT NULL
             AND has_table_privilege('service_role', 'public.landing_page_versions', 'SELECT')
             AND has_table_privilege('service_role', 'public.landing_page_versions', 'INSERT')
             AND NOT has_table_privilege('anon', 'public.landing_page_versions', 'SELECT')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. registre à ajout seul : aucun droit de modification ni de suppression',
       CASE WHEN to_regclass('public.landing_page_versions') IS NOT NULL
             AND NOT has_table_privilege('service_role', 'public.landing_page_versions', 'UPDATE')
             AND NOT has_table_privilege('service_role', 'public.landing_page_versions', 'DELETE')
             AND NOT has_table_privilege('authenticated', 'public.landing_page_versions', 'DELETE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '4. aucune page existante modifiée (aucune version avant la première utilisation)',
       CASE WHEN to_regclass('public.landing_page_versions') IS NULL THEN 'À CORRIGER'
            WHEN (SELECT count(*) FROM public.landing_page_versions) = 0 THEN 'OK'
            ELSE 'INFO : ' || (SELECT count(*) FROM public.landing_page_versions) || ' version(s) (normal après usage)' END;
