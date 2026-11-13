-- Contrôle de 0017 (lecture seule). Attendu : 4 lignes OK.
SELECT '1. table landing_variable_costs présente, RLS activée et forcée' AS controle,
       CASE WHEN to_regclass('public.landing_variable_costs') IS NOT NULL
             AND (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.landing_variable_costs'))
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. service_role lit et ajoute seulement ; ni anon ni authenticated',
       CASE WHEN to_regclass('public.landing_variable_costs') IS NOT NULL
             AND has_table_privilege('service_role', 'public.landing_variable_costs', 'SELECT') AND has_table_privilege('service_role', 'public.landing_variable_costs', 'INSERT')
             AND NOT has_table_privilege('service_role', 'public.landing_variable_costs', 'UPDATE') AND NOT has_table_privilege('service_role', 'public.landing_variable_costs', 'DELETE')
             AND NOT has_table_privilege('anon', 'public.landing_variable_costs', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.landing_variable_costs', 'SELECT')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. garde (entreprise de la réservation, annulation exacte) : déclencheur présent',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.landing_variable_costs') AND tgname = 'landing_variable_costs_guard' AND NOT tgisinternal) THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '4. anti double comptage : contrainte réservation OU campagne',
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('public.landing_variable_costs') AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%lead_id IS NULL%network IS NULL%') THEN 'OK' ELSE 'À CORRIGER' END;
