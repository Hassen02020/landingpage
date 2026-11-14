-- Contrôle de 0023 (lecture seule). Attendu : 4 lignes OK.
SELECT '1. table landing_inbound_events présente, sécurité par ligne activée et forcée' AS controle,
       CASE WHEN to_regclass('public.landing_inbound_events') IS NOT NULL
             AND (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.landing_inbound_events'))
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. service_role lit et ajoute ; anon et authenticated n''y accèdent pas',
       CASE WHEN to_regclass('public.landing_inbound_events') IS NOT NULL
             AND has_table_privilege('service_role', 'public.landing_inbound_events', 'SELECT')
             AND has_table_privilege('service_role', 'public.landing_inbound_events', 'INSERT')
             AND NOT has_table_privilege('anon', 'public.landing_inbound_events', 'SELECT')
             AND NOT has_table_privilege('authenticated', 'public.landing_inbound_events', 'SELECT')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. registre à ajout seul : aucun droit de modification ni de suppression',
       CASE WHEN to_regclass('public.landing_inbound_events') IS NOT NULL
             AND NOT has_table_privilege('service_role', 'public.landing_inbound_events', 'UPDATE')
             AND NOT has_table_privilege('service_role', 'public.landing_inbound_events', 'DELETE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '4. l''entreprise d''une ligne ne peut pas être modifiée (déclencheur)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.landing_inbound_events') AND tgname = 'landing_org_immutable' AND NOT tgisinternal)
            THEN 'OK' ELSE 'À CORRIGER' END;
