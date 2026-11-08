-- =====================================================================
-- RETOUR ARRIÈRE de 0009_employees_see_org_leads.sql : remet la règle de 0008
-- (employé : ses leads + les leads non affectés). Aucune donnée touchée.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0008 n''est pas appliquée.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'landing_leads'
             AND policyname = 'landing_leads_org_read' AND qual LIKE '%assigned_to%') THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0009 n''est pas appliquée (rien à annuler).';
  END IF;
END $$;

DROP POLICY landing_leads_org_read ON public.landing_leads;
CREATE POLICY landing_leads_org_read ON public.landing_leads
  FOR SELECT TO authenticated
  USING (public.landing_member_role(organization_id) IN ('admin', 'manager')
         OR (public.landing_member_role(organization_id) = 'employee' AND (assigned_to = auth.uid() OR assigned_to IS NULL)));

DROP POLICY landing_activities_org_read ON public.landing_lead_activities;
CREATE POLICY landing_activities_org_read ON public.landing_lead_activities
  FOR SELECT TO authenticated
  USING (public.landing_member_role(organization_id) IN ('admin', 'manager')
         OR (public.landing_member_role(organization_id) = 'employee'
             AND EXISTS (SELECT 1 FROM public.landing_leads l WHERE l.id = lead_id AND (l.assigned_to = auth.uid() OR l.assigned_to IS NULL))));

COMMIT;
