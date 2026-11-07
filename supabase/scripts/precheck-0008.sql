-- =====================================================================
-- CONTRÔLE AVANT la migration 0008 — LECTURE SEULE (aucune écriture).
-- À exécuter dans l'éditeur SQL du projet Supabase des landing pages (tdexdlukqciolslvjmhd), jamais EasyV4.
-- Résultat : une ligne par contrôle ; la migration peut être appliquée si TOUS les statuts valent OK.
-- =====================================================================
SELECT n, controle, valeur, attendu, CASE WHEN ok THEN 'OK' ELSE 'À CORRIGER' END AS statut
FROM (
  SELECT 1 AS n, 'Base EasyV4 absente (agencies / crm_conversations / reservations)' AS controle,
         (to_regclass('public.agencies') IS NOT NULL OR to_regclass('public.crm_conversations') IS NOT NULL OR to_regclass('public.reservations') IS NOT NULL)::text AS valeur,
         'false' AS attendu,
         NOT (to_regclass('public.agencies') IS NOT NULL OR to_regclass('public.crm_conversations') IS NOT NULL OR to_regclass('public.reservations') IS NOT NULL) AS ok
  UNION ALL
  SELECT 2, 'Migration 0006 appliquée (colonne region)',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads' AND column_name = 'region')::text, 'true',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads' AND column_name = 'region')
  UNION ALL
  SELECT 3, 'Migration 0007 appliquée (statut gagne)',
         COALESCE((SELECT pg_get_constraintdef(oid) LIKE '%gagne%' FROM pg_constraint WHERE conname = 'landing_leads_status_check' AND conrelid = 'public.landing_leads'::regclass), false)::text, 'true',
         COALESCE((SELECT pg_get_constraintdef(oid) LIKE '%gagne%' FROM pg_constraint WHERE conname = 'landing_leads_status_check' AND conrelid = 'public.landing_leads'::regclass), false)
  UNION ALL
  SELECT 4, 'Migration 0008 pas encore appliquée (table organizations absente)',
         (to_regclass('public.organizations') IS NOT NULL)::text, 'false', to_regclass('public.organizations') IS NULL
  UNION ALL
  SELECT 5, 'Aucune colonne organization_id déjà présente',
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'organization_id')::text, '0',
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'organization_id') = 0
  UNION ALL
  SELECT 6, 'Membres de l''équipe actuelle (landing_staff)', (SELECT count(*) FROM public.landing_staff)::text, '≥ 1', (SELECT count(*) FROM public.landing_staff) >= 1
  UNION ALL
  SELECT 7, 'Au moins un administrateur actif dans l''équipe',
         (SELECT count(*) FROM public.landing_staff WHERE role = 'admin' AND active)::text, '≥ 1', (SELECT count(*) FROM public.landing_staff WHERE role = 'admin' AND active) >= 1
  UNION ALL
  SELECT 8, 'Comptes de l''équipe présents dans l''authentification (doit être 0 manquant)',
         (SELECT count(*) FROM public.landing_staff s WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id))::text, '0',
         (SELECT count(*) FROM public.landing_staff s WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id)) = 0
  UNION ALL
  SELECT 9, 'Leads existants (information : seront tous rattachés à Easy2Book)', (SELECT count(*) FROM public.landing_leads)::text, 'information', true
  UNION ALL
  SELECT 10, 'Lignes d''historique (information : conservées intactes)', (SELECT count(*) FROM public.landing_lead_activities)::text, 'information', true
) c
ORDER BY n;

-- Compte propriétaire désigné (lecture seule) : doit exister, avoir une adresse CONFIRMÉE et ne pas être suspendu
-- pour que le script provision-super-admin.sql puisse lui accorder le rôle.
SELECT id, email, (email_confirmed_at IS NOT NULL) AS email_confirme, (banned_until IS NOT NULL AND banned_until > now()) AS suspendu,
       created_at, last_sign_in_at
FROM auth.users
WHERE lower(email) = lower('Tarhouni.Hassene@gmail.com');
