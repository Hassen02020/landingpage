-- =====================================================================
-- CONTRÔLE APRÈS la migration 0008 — LECTURE SEULE (aucune écriture).
-- Résultat : une ligne par contrôle ; la migration est saine si TOUS les statuts valent OK.
-- =====================================================================
SELECT n, controle, valeur, attendu, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS statut
FROM (
  SELECT 1 AS n, 'Une seule organisation : Easy2Book (active)' AS controle,
         (SELECT string_agg(slug || ':' || status, ',') FROM public.organizations) AS valeur, 'easy2book:active' AS attendu,
         (SELECT count(*) = 1 AND bool_and(slug = 'easy2book' AND status = 'active' AND id = '00000000-0000-4000-8000-0000000e2b01') FROM public.organizations) AS ok
  UNION ALL
  SELECT 2, 'Leads rattachés à Easy2Book = leads totaux',
         (SELECT count(*) FILTER (WHERE organization_id = '00000000-0000-4000-8000-0000000e2b01') || ' / ' || count(*) FROM public.landing_leads),
         'égaux', (SELECT count(*) FILTER (WHERE organization_id = '00000000-0000-4000-8000-0000000e2b01') = count(*) FROM public.landing_leads)
  UNION ALL
  SELECT 3, 'Historique rattaché à Easy2Book = historique total',
         (SELECT count(*) FILTER (WHERE organization_id = '00000000-0000-4000-8000-0000000e2b01') || ' / ' || count(*) FROM public.landing_lead_activities),
         'égaux', (SELECT count(*) FILTER (WHERE organization_id = '00000000-0000-4000-8000-0000000e2b01') = count(*) FROM public.landing_lead_activities)
  UNION ALL
  SELECT 4, 'Colonne organization_id NOT NULL sur les 13 tables',
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'organization_id' AND is_nullable = 'NO' AND table_name LIKE 'landing\_%')::text, '13',
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'organization_id' AND is_nullable = 'NO' AND table_name LIKE 'landing\_%') = 13
  UNION ALL
  SELECT 5, 'Membres = équipe actuelle (même nombre)',
         (SELECT count(*) FROM public.organization_members) || ' membres / ' || (SELECT count(*) FROM public.landing_staff) || ' équipe', 'égaux',
         (SELECT count(*) FROM public.organization_members) = (SELECT count(*) FROM public.landing_staff)
  UNION ALL
  SELECT 6, 'RLS activée ET forcée sur les 4 nouvelles tables',
         (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname IN ('organizations', 'organization_members', 'platform_admins', 'organization_audit') AND relrowsecurity AND relforcerowsecurity)::text, '4',
         (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname IN ('organizations', 'organization_members', 'platform_admins', 'organization_audit') AND relrowsecurity AND relforcerowsecurity) = 4
  UNION ALL
  SELECT 7, 'Politiques d''isolation présentes (leads, événements, historique, équipe, organisations, membres, Super Admin)',
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname IN ('landing_leads_org_read', 'landing_events_org_read', 'landing_activities_org_read', 'landing_staff_org_read', 'organizations_member_read', 'organization_members_read', 'platform_admins_self_read'))::text, '7',
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname IN ('landing_leads_org_read', 'landing_events_org_read', 'landing_activities_org_read', 'landing_staff_org_read', 'organizations_member_read', 'organization_members_read', 'platform_admins_self_read')) = 7
  UNION ALL
  SELECT 8, 'Anciennes politiques « toute l''équipe lit tout » supprimées',
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname IN ('landing_leads_staff_read', 'landing_events_staff_read', 'landing_activities_staff_read', 'landing_staff_self_or_staff'))::text, '0',
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname IN ('landing_leads_staff_read', 'landing_events_staff_read', 'landing_activities_staff_read', 'landing_staff_self_or_staff')) = 0
  UNION ALL
  SELECT 9, 'Aucune écriture possible par l''API sur Super Admin / membres / organisations (anon, comptes connectés, service_role)',
         (SELECT count(*) FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(role),
                 (VALUES ('platform_admins'), ('organization_members'), ('organizations')) t(tab),
                 (VALUES ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
          WHERE has_table_privilege(r.role, 'public.' || t.tab, p.priv))::text, '0',
         (SELECT count(*) FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(role),
                 (VALUES ('platform_admins'), ('organization_members'), ('organizations')) t(tab),
                 (VALUES ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
          WHERE has_table_privilege(r.role, 'public.' || t.tab, p.priv)) = 0
  UNION ALL
  SELECT 10, 'Rôle anonyme sans aucun accès aux nouvelles tables',
         (SELECT count(*) FROM (VALUES ('organizations'), ('organization_members'), ('platform_admins'), ('organization_audit')) t(tab) WHERE has_table_privilege('anon', 'public.' || t.tab, 'SELECT'))::text, '0',
         (SELECT count(*) FROM (VALUES ('organizations'), ('organization_members'), ('platform_admins'), ('organization_audit')) t(tab) WHERE has_table_privilege('anon', 'public.' || t.tab, 'SELECT')) = 0
  UNION ALL
  SELECT 11, 'Administrateurs plateforme enregistrés (information : 0 avant le script Super Admin)',
         (SELECT count(*) FROM public.platform_admins)::text, 'information', true
  UNION ALL
  SELECT 12, 'Au moins un administrateur actif dans l''organisation',
         (SELECT count(*) FROM public.organization_members WHERE role = 'admin' AND active)::text, '≥ 1',
         (SELECT count(*) FROM public.organization_members WHERE role = 'admin' AND active) >= 1
) c
ORDER BY n;
