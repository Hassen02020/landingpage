-- Contrôle de 0016 (lecture seule). Attendu : 6 lignes OK.
SELECT '1. tables landing_ad_spend et landing_commissions présentes, RLS activée et forcée' AS controle,
       CASE WHEN to_regclass('public.landing_ad_spend') IS NOT NULL AND to_regclass('public.landing_commissions') IS NOT NULL
             AND (SELECT bool_and(relrowsecurity AND relforcerowsecurity) FROM pg_class WHERE oid IN (to_regclass('public.landing_ad_spend'), to_regclass('public.landing_commissions')))
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. service_role lit et ajoute ; ni anon ni authenticated n''y accèdent',
       CASE WHEN to_regclass('public.landing_ad_spend') IS NOT NULL AND to_regclass('public.landing_commissions') IS NOT NULL
             AND has_table_privilege('service_role', 'public.landing_ad_spend', 'SELECT') AND has_table_privilege('service_role', 'public.landing_ad_spend', 'INSERT')
             AND has_table_privilege('service_role', 'public.landing_commissions', 'SELECT') AND has_table_privilege('service_role', 'public.landing_commissions', 'INSERT')
             AND NOT has_table_privilege('anon', 'public.landing_ad_spend', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.landing_ad_spend', 'SELECT')
             AND NOT has_table_privilege('anon', 'public.landing_commissions', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.landing_commissions', 'SELECT')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. ajout seul : aucune modification ni suppression des dépenses ; commissions : seule la confirmation',
       CASE WHEN to_regclass('public.landing_ad_spend') IS NOT NULL AND to_regclass('public.landing_commissions') IS NOT NULL
             AND NOT has_table_privilege('service_role', 'public.landing_ad_spend', 'UPDATE') AND NOT has_table_privilege('service_role', 'public.landing_ad_spend', 'DELETE')
             AND NOT has_table_privilege('service_role', 'public.landing_commissions', 'DELETE')
             AND NOT has_column_privilege('service_role', 'public.landing_commissions', 'amount_tnd', 'UPDATE')
             AND has_column_privilege('service_role', 'public.landing_commissions', 'status', 'UPDATE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '4. contrôle des annulations de dépenses (déclencheur)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.landing_ad_spend') AND tgname = 'landing_ad_spend_void' AND NOT tgisinternal) THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '5. garde des commissions : entreprise du lead et confirmation unique (déclencheur)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.landing_commissions') AND tgname = 'landing_commissions_guard' AND NOT tgisinternal) THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '6. idempotence : clé unique (entreprise, line_key) sur les commissions',
       CASE WHEN to_regclass('public.landing_commissions_org_line_uq') IS NOT NULL THEN 'OK' ELSE 'À CORRIGER' END;
