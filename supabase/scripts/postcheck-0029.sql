-- Contrôle de 0029 (lecture seule). Attendu : 6 lignes OK.
SELECT '1. table landing_conversations présente avec sécurité par ligne activée et forcée' AS controle,
       CASE WHEN EXISTS (SELECT 1 FROM pg_class c WHERE c.oid = to_regclass('public.landing_conversations') AND c.relrowsecurity AND c.relforcerowsecurity)
            THEN 'OK' ELSE 'À CORRIGER' END AS resultat
UNION ALL
SELECT '2. aucune colonne de téléphone, de nom ni de texte de message',
       CASE WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_conversations'
                              AND (column_name ~* '(phone|tel|mobile|name|nom|email|message_text|body|text)$' AND column_name NOT IN ('contact_ref')))
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '3. contraintes lot (sans fiche ni identifiant) et individuelle (une seule conversation)',
       CASE WHEN (SELECT count(*) FROM pg_constraint WHERE conrelid = to_regclass('public.landing_conversations')
                   AND conname IN ('landing_conversations_lot_ck', 'landing_conversations_indiv_ck', 'landing_conversations_dates_ck')) = 3
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '4. aucun accès pour les comptes d''utilisateurs (anon, authenticated)',
       CASE WHEN NOT has_table_privilege('anon', 'public.landing_conversations', 'SELECT') AND NOT has_table_privilege('authenticated', 'public.landing_conversations', 'SELECT')
             AND NOT has_table_privilege('anon', 'public.landing_conversations', 'INSERT') AND NOT has_table_privilege('authenticated', 'public.landing_conversations', 'UPDATE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '5. le serveur peut lire, ajouter et modifier, mais JAMAIS supprimer',
       CASE WHEN has_table_privilege('service_role', 'public.landing_conversations', 'SELECT') AND has_table_privilege('service_role', 'public.landing_conversations', 'INSERT')
             AND has_table_privilege('service_role', 'public.landing_conversations', 'UPDATE') AND NOT has_table_privilege('service_role', 'public.landing_conversations', 'DELETE')
            THEN 'OK' ELSE 'À CORRIGER' END
UNION ALL
SELECT '6. table vide à l''application (aucune ligne créée par la migration)',
       CASE WHEN (SELECT count(*) FROM public.landing_conversations) = 0 THEN 'OK' ELSE 'À VÉRIFIER (des conversations ont pu être saisies depuis l''application)' END;
