-- Contrôle de 0012 (lecture seule). Attendu : 4 lignes OK.
SELECT '1. fonction de création présente' AS controle,
       CASE WHEN to_regprocedure('public.landing_create_organization(text,text,text,uuid,uuid,text,text)') IS NOT NULL THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. fonction de statut présente',
       CASE WHEN to_regprocedure('public.landing_set_organization_status(uuid,text,uuid)') IS NOT NULL THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. exécution réservée à service_role (ni anon, ni authenticated, ni PUBLIC)',
       CASE WHEN to_regprocedure('public.landing_create_organization(text,text,text,uuid,uuid,text,text)') IS NOT NULL
             AND has_function_privilege('service_role', 'public.landing_create_organization(text,text,text,uuid,uuid,text,text)', 'EXECUTE')
             AND NOT has_function_privilege('anon', 'public.landing_create_organization(text,text,text,uuid,uuid,text,text)', 'EXECUTE')
             AND NOT has_function_privilege('authenticated', 'public.landing_create_organization(text,text,text,uuid,uuid,text,text)', 'EXECUTE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '4. service_role sans écriture directe sur organizations',
       CASE WHEN NOT has_table_privilege('service_role', 'public.organizations', 'INSERT')
             AND NOT has_table_privilege('service_role', 'public.organizations', 'UPDATE')
            THEN 'OK' ELSE 'À CORRIGER' END;
