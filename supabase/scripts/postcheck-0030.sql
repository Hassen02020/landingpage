-- Contrôle de 0030 (lecture seule). Attendu : 10 lignes OK.
SELECT '1. table landing_duplicate_reviews présente, sécurité par ligne activée et forcée' AS controle,
       CASE WHEN EXISTS (SELECT 1 FROM pg_class c WHERE c.oid = to_regclass('public.landing_duplicate_reviews') AND c.relrowsecurity AND c.relforcerowsecurity)
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. colonnes duplicate_of et duplicate_confirmed_at sur landing_leads',
       CASE WHEN (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads' AND column_name IN ('duplicate_of', 'duplicate_confirmed_at')) = 2
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. contraintes : soi-même, cohérence, deux dossiers distincts, décision, double regard (D1)',
       CASE WHEN (SELECT count(*) FROM pg_constraint WHERE conname IN ('landing_leads_duplicate_self_ck', 'landing_leads_duplicate_pair_ck', 'landing_dup_reviews_distinct_ck', 'landing_dup_reviews_decision_ck', 'landing_dup_reviews_four_eyes_ck')) = 5
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '4. un seul signalement actif (signale ou confirme) par dossier candidat',
       CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'landing_dup_reviews_active_uq' AND indexdef ILIKE '%UNIQUE%')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '5. 5 déclencheurs présents (garde dossier, création, modification, synchronisation, entreprise immuable)',
       CASE WHEN (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('landing_dup_lead_guard', 'landing_dup_review_insert_guard', 'landing_dup_review_update_guard', 'landing_dup_review_sync')) = 4
             AND EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname = 'landing_org_immutable' AND tgrelid = to_regclass('public.landing_duplicate_reviews'))
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '6. types d''activité : les 4 types de doublon sont autorisés',
       CASE WHEN (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.landing_lead_activities'::regclass AND conname = 'landing_lead_activities_type_check') ~ 'duplicate_flagged.*duplicate_confirmed.*duplicate_rejected.*duplicate_reopened'
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '7. aucun accès pour les comptes d''utilisateurs (anon, authenticated)',
       CASE WHEN NOT has_table_privilege('anon', 'public.landing_duplicate_reviews', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.landing_duplicate_reviews', 'SELECT')
             AND NOT has_table_privilege('anon', 'public.landing_duplicate_reviews', 'INSERT') AND NOT has_table_privilege('authenticated', 'public.landing_duplicate_reviews', 'UPDATE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '8. le serveur peut lire, ajouter et modifier, mais JAMAIS supprimer',
       CASE WHEN has_table_privilege('service_role', 'public.landing_duplicate_reviews', 'SELECT') AND has_table_privilege('service_role', 'public.landing_duplicate_reviews', 'INSERT')
             AND has_table_privilege('service_role', 'public.landing_duplicate_reviews', 'UPDATE') AND NOT has_table_privilege('service_role', 'public.landing_duplicate_reviews', 'DELETE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '9. table vide à l''application (aucun signalement créé par la migration)',
       CASE WHEN (SELECT count(*) FROM public.landing_duplicate_reviews) = 0 THEN 'OK' ELSE 'À VÉRIFIER (des signalements ont pu être créés depuis l''application)' END
UNION ALL
SELECT '10. aucun dossier modifié par la migration (aucun doublon confirmé à l''application)',
       CASE WHEN (SELECT count(*) FROM public.landing_leads WHERE duplicate_of IS NOT NULL OR duplicate_confirmed_at IS NOT NULL) = 0 THEN 'OK' ELSE 'À VÉRIFIER (des doublons ont pu être confirmés depuis l''application)' END;
