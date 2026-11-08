-- =====================================================================
-- CONTRÔLE APRÈS la migration 0009 — LECTURE SEULE (aucune écriture).
-- Résultat : une ligne par contrôle ; la migration est saine si TOUS les statuts valent OK.
-- =====================================================================
SELECT n, controle, valeur, attendu, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS statut
FROM (
  SELECT 1 AS n, 'Leads : un employé voit tous les leads de son organisation (politique sans condition d''affectation)' AS controle,
         (SELECT (qual LIKE '%employee%' AND qual NOT LIKE '%assigned_to%')::text FROM pg_policies WHERE schemaname = 'public' AND policyname = 'landing_leads_org_read') AS valeur,
         'true' AS attendu,
         COALESCE((SELECT qual LIKE '%employee%' AND qual NOT LIKE '%assigned_to%' FROM pg_policies WHERE schemaname = 'public' AND policyname = 'landing_leads_org_read'), false) AS ok
  UNION ALL
  SELECT 2, 'Historique : même règle que les leads',
         (SELECT (qual LIKE '%employee%' AND qual NOT LIKE '%assigned_to%')::text FROM pg_policies WHERE schemaname = 'public' AND policyname = 'landing_activities_org_read'), 'true',
         COALESCE((SELECT qual LIKE '%employee%' AND qual NOT LIKE '%assigned_to%' FROM pg_policies WHERE schemaname = 'public' AND policyname = 'landing_activities_org_read'), false)
  UNION ALL
  SELECT 3, 'Événements de navigation : toujours réservés aux admin et manager (aucun employé)',
         (SELECT (qual NOT LIKE '%employee%')::text FROM pg_policies WHERE schemaname = 'public' AND policyname = 'landing_events_org_read'), 'true',
         COALESCE((SELECT qual NOT LIKE '%employee%' FROM pg_policies WHERE schemaname = 'public' AND policyname = 'landing_events_org_read'), false)
  UNION ALL
  SELECT 4, 'Les leads restent cloisonnés par organisation (la politique dépend de l''organisation de la ligne)',
         (SELECT (qual LIKE '%landing_member_role%organization_id%')::text FROM pg_policies WHERE schemaname = 'public' AND policyname = 'landing_leads_org_read'), 'true',
         COALESCE((SELECT qual LIKE '%landing_member_role%organization_id%' FROM pg_policies WHERE schemaname = 'public' AND policyname = 'landing_leads_org_read'), false)
  UNION ALL
  SELECT 5, 'Aucune écriture sur les leads pour les comptes connectés ni le rôle anonyme',
         (SELECT count(*) FROM (VALUES ('anon'), ('authenticated')) r(role), (VALUES ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
          WHERE has_table_privilege(r.role, 'public.landing_leads', p.priv))::text, '0',
         (SELECT count(*) FROM (VALUES ('anon'), ('authenticated')) r(role), (VALUES ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
          WHERE has_table_privilege(r.role, 'public.landing_leads', p.priv)) = 0
) c
ORDER BY n;
