-- =====================================================================
-- CONTRÔLE APRÈS la migration 0031 — LECTURE SEULE (aucune écriture).
-- Résultat : une ligne par contrôle ; la migration est saine si TOUS les statuts valent OK.
-- =====================================================================
WITH p AS (
  SELECT policyname, qual FROM pg_policies WHERE schemaname = 'public' AND policyname IN ('landing_leads_org_read', 'landing_activities_org_read', 'landing_events_org_read')
)
SELECT n, controle, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS statut
FROM (
  SELECT 1 AS n, 'Leads : l''employé ne lit que ses leads (assigned_to = auth.uid(), sans « non affecté »)' AS controle,
         COALESCE((SELECT qual LIKE '%employee%' AND qual LIKE '%assigned_to = auth.uid()%' AND qual NOT LIKE '%IS NULL%' FROM p WHERE policyname = 'landing_leads_org_read'), false) AS ok
  UNION ALL
  SELECT 2, 'Historique : même règle que les leads',
         COALESCE((SELECT qual LIKE '%employee%' AND qual LIKE '%assigned_to = auth.uid()%' AND qual NOT LIKE '%IS NULL%' FROM p WHERE policyname = 'landing_activities_org_read'), false)
  UNION ALL
  SELECT 3, 'Admin et manager : toujours toute leur organisation',
         COALESCE((SELECT qual LIKE '%admin%manager%' FROM p WHERE policyname = 'landing_leads_org_read'), false)
           AND COALESCE((SELECT qual LIKE '%admin%manager%' FROM p WHERE policyname = 'landing_activities_org_read'), false)
  UNION ALL
  SELECT 4, 'Cloisonnement par organisation conservé (la politique dépend de l''organisation de la ligne)',
         COALESCE((SELECT qual LIKE '%landing_member_role%organization_id%' FROM p WHERE policyname = 'landing_leads_org_read'), false)
  UNION ALL
  SELECT 5, 'Événements de navigation : toujours réservés aux admin et manager',
         COALESCE((SELECT qual NOT LIKE '%employee%' FROM p WHERE policyname = 'landing_events_org_read'), false)
  UNION ALL
  SELECT 6, 'Aucune écriture sur les leads pour les comptes connectés ni le rôle anonyme',
         (SELECT count(*) FROM (VALUES ('anon'), ('authenticated')) r(role), (VALUES ('INSERT'), ('UPDATE'), ('DELETE')) pr(priv)
          WHERE has_table_privilege(r.role, 'public.landing_leads', pr.priv)) = 0
) c
ORDER BY n;
