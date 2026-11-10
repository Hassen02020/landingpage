-- Contrôle de 0015 (lecture seule). Attendu : 4 lignes OK.
SELECT '1. table landing_meta_pages présente, RLS activée et forcée' AS controle,
       CASE WHEN to_regclass('public.landing_meta_pages') IS NOT NULL
             AND (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.landing_meta_pages'))
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. service_role lit et écrit ; ni anon ni authenticated n''y accèdent',
       CASE WHEN to_regclass('public.landing_meta_pages') IS NOT NULL
             AND has_table_privilege('service_role', 'public.landing_meta_pages', 'SELECT')
             AND has_table_privilege('service_role', 'public.landing_meta_pages', 'INSERT')
             AND has_table_privilege('service_role', 'public.landing_meta_pages', 'UPDATE')
             AND NOT has_table_privilege('anon', 'public.landing_meta_pages', 'SELECT')
             AND NOT has_table_privilege('authenticated', 'public.landing_meta_pages', 'SELECT')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. aucun droit de suppression (service_role, authenticated, anon)',
       CASE WHEN to_regclass('public.landing_meta_pages') IS NOT NULL
             AND NOT has_table_privilege('service_role', 'public.landing_meta_pages', 'DELETE')
             AND NOT has_table_privilege('authenticated', 'public.landing_meta_pages', 'DELETE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '4. l''entreprise d''une page ne peut pas être modifiée (déclencheur)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.landing_meta_pages') AND tgname = 'landing_org_immutable' AND NOT tgisinternal)
            THEN 'OK' ELSE 'À CORRIGER' END;
