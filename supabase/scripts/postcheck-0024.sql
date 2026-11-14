-- Contrôle de 0024 (lecture seule). Attendu : 4 lignes OK.
SELECT '1. table landing_whatsapp_numbers présente, sécurité par ligne activée et forcée' AS controle,
       CASE WHEN to_regclass('public.landing_whatsapp_numbers') IS NOT NULL
             AND (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.landing_whatsapp_numbers'))
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. service_role lit et écrit ; ni anon ni authenticated n''y accèdent',
       CASE WHEN to_regclass('public.landing_whatsapp_numbers') IS NOT NULL
             AND has_table_privilege('service_role', 'public.landing_whatsapp_numbers', 'SELECT')
             AND has_table_privilege('service_role', 'public.landing_whatsapp_numbers', 'INSERT')
             AND has_table_privilege('service_role', 'public.landing_whatsapp_numbers', 'UPDATE')
             AND NOT has_table_privilege('anon', 'public.landing_whatsapp_numbers', 'SELECT')
             AND NOT has_table_privilege('authenticated', 'public.landing_whatsapp_numbers', 'SELECT')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. aucun droit de suppression',
       CASE WHEN to_regclass('public.landing_whatsapp_numbers') IS NOT NULL
             AND NOT has_table_privilege('service_role', 'public.landing_whatsapp_numbers', 'DELETE')
             AND NOT has_table_privilege('authenticated', 'public.landing_whatsapp_numbers', 'DELETE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '4. l''entreprise d''un numéro ne peut pas être modifiée (déclencheur)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.landing_whatsapp_numbers') AND tgname = 'landing_org_immutable' AND NOT tgisinternal)
            THEN 'OK' ELSE 'À CORRIGER' END;
