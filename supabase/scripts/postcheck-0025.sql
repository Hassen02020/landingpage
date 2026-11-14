-- Contrôle de 0025 (lecture seule). Attendu : 5 lignes OK.
SELECT '1. table landing_reviews présente, sécurité par ligne activée et forcée' AS controle,
       CASE WHEN to_regclass('public.landing_reviews') IS NOT NULL
             AND (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.landing_reviews'))
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. service_role lit et ajoute ; anon et authenticated n''y accèdent pas',
       CASE WHEN to_regclass('public.landing_reviews') IS NOT NULL
             AND has_table_privilege('service_role', 'public.landing_reviews', 'SELECT')
             AND has_table_privilege('service_role', 'public.landing_reviews', 'INSERT')
             AND NOT has_table_privilege('anon', 'public.landing_reviews', 'SELECT')
             AND NOT has_table_privilege('authenticated', 'public.landing_reviews', 'SELECT')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. seul le statut peut être modifié (ni la note, ni le texte)',
       CASE WHEN to_regclass('public.landing_reviews') IS NOT NULL
             AND has_column_privilege('service_role', 'public.landing_reviews', 'status', 'UPDATE')
             AND NOT has_column_privilege('service_role', 'public.landing_reviews', 'rating', 'UPDATE')
             AND NOT has_column_privilege('service_role', 'public.landing_reviews', 'comment', 'UPDATE')
             AND NOT has_column_privilege('service_role', 'public.landing_reviews', 'first_name', 'UPDATE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '4. aucune suppression possible',
       CASE WHEN to_regclass('public.landing_reviews') IS NOT NULL
             AND NOT has_table_privilege('service_role', 'public.landing_reviews', 'DELETE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '5. l''entreprise d''un avis ne peut pas être modifiée (déclencheur)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('public.landing_reviews') AND tgname = 'landing_org_immutable' AND NOT tgisinternal)
            THEN 'OK' ELSE 'À CORRIGER' END;
