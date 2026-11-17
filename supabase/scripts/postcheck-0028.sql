-- Contrôle de 0028 (lecture seule). Attendu : 5 lignes OK.
SELECT '1. table landing_conversion_log présente avec sécurité par ligne activée et forcée' AS controle,
       CASE WHEN EXISTS (SELECT 1 FROM pg_class c WHERE c.oid = to_regclass('public.landing_conversion_log') AND c.relrowsecurity AND c.relforcerowsecurity)
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. unicité (entreprise, réseau, identifiant d''évènement)',
       CASE WHEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_conversion_log_event_uq' AND conrelid = to_regclass('public.landing_conversion_log') AND contype = 'u')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. aucun accès pour les comptes d''utilisateurs (anon, authenticated)',
       CASE WHEN NOT has_table_privilege('anon', 'public.landing_conversion_log', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.landing_conversion_log', 'SELECT')
             AND NOT has_table_privilege('anon', 'public.landing_conversion_log', 'INSERT') AND NOT has_table_privilege('authenticated', 'public.landing_conversion_log', 'UPDATE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '4. le serveur peut lire, ajouter et changer l''état, mais JAMAIS supprimer',
       CASE WHEN has_table_privilege('service_role', 'public.landing_conversion_log', 'SELECT') AND has_table_privilege('service_role', 'public.landing_conversion_log', 'INSERT')
             AND has_table_privilege('service_role', 'public.landing_conversion_log', 'UPDATE') AND NOT has_table_privilege('service_role', 'public.landing_conversion_log', 'DELETE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '5. journal vide à l''application (aucune ligne créée par la migration)',
       CASE WHEN (SELECT count(*) FROM public.landing_conversion_log) = 0 THEN 'OK' ELSE 'À VÉRIFIER (des conversions ont pu être journalisées depuis l''application)' END;
