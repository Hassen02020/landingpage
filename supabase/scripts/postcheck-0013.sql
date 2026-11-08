-- Contrôle de 0013 (lecture seule). Attendu : 2 lignes OK.
SELECT '1. landing_staff accepte le rôle manager' AS controle,
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                          WHERE t.relname = 'landing_staff' AND c.contype = 'c' AND pg_get_constraintdef(c.oid) LIKE '%manager%')
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. la recopie vers organization_members traduit manager → manager',
       CASE WHEN pg_get_functiondef('public.landing_staff_mirror_member()'::regprocedure) LIKE '%WHEN ''manager'' THEN ''manager''%'
            THEN 'OK' ELSE 'À CORRIGER' END;
