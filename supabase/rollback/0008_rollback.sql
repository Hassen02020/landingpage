-- =====================================================================
-- RETOUR ARRIÈRE de 0008_multitenant_foundation.sql
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS une sauvegarde,
-- et SEULEMENT tant qu'Easy2Book est la seule organisation (sinon l'isolation serait perdue).
-- Remet le schéma exactement dans l'état 0007 (politiques « équipe » d'origine comprises).
-- =====================================================================
BEGIN; -- tout ou rien

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0008 n''est pas appliquée (rien à annuler).';
  END IF;
  IF (SELECT count(*) FROM public.organizations) > 1 THEN
    RAISE EXCEPTION 'ARRÊT : plusieurs organisations existent. Le retour arrière mélangerait leurs données : interdit.';
  END IF;
END $$;

-- 1. Politiques d'isolation → politiques d'origine
DROP POLICY landing_leads_org_read ON public.landing_leads;
DROP POLICY landing_events_org_read ON public.landing_events;
DROP POLICY landing_activities_org_read ON public.landing_lead_activities;
DROP POLICY landing_staff_org_read ON public.landing_staff;
CREATE POLICY landing_leads_staff_read ON public.landing_leads
  FOR SELECT TO authenticated USING (public.landing_is_staff());
CREATE POLICY landing_events_staff_read ON public.landing_events
  FOR SELECT TO authenticated USING (public.landing_is_staff());
CREATE POLICY landing_activities_staff_read ON public.landing_lead_activities
  FOR SELECT TO authenticated USING (public.landing_is_staff());
CREATE POLICY landing_staff_self_or_staff ON public.landing_staff
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.landing_is_staff());

-- 2. Triggers et fonctions du socle
DROP TRIGGER landing_staff_mirror_member ON public.landing_staff;
DROP TRIGGER landing_leads_assignee_same_org ON public.landing_leads;
DROP TRIGGER landing_activity_inherit_org ON public.landing_lead_activities;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'landing_leads', 'landing_events', 'landing_staff', 'landing_integrations', 'landing_blocklist',
    'landing_categories', 'landing_offers', 'landing_promo_codes', 'landing_message_templates'
  ] LOOP
    EXECUTE format('DROP TRIGGER landing_org_immutable ON public.%I', t);
  END LOOP;
END $$;
DROP FUNCTION public.landing_staff_mirror_member();
DROP FUNCTION public.landing_leads_assignee_same_org();
DROP FUNCTION public.landing_activity_inherit_org();
DROP FUNCTION public.landing_org_immutable();

-- 3. Colonnes organization_id (les clés étrangères et index partent avec elles)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'landing_leads', 'landing_events', 'landing_lead_activities', 'landing_staff',
    'landing_integrations', 'landing_integration_changes', 'landing_admin_log',
    'landing_protection', 'landing_blocklist', 'landing_categories', 'landing_offers',
    'landing_promo_codes', 'landing_message_templates'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I DROP COLUMN organization_id', t);
  END LOOP;
END $$;

-- 4. Tables du socle (le journal d'audit est supprimé AVEC les autres : l'exporter avant si besoin)
DROP TABLE public.organization_audit;
DROP TABLE public.platform_admins;
DROP TABLE public.organization_members;
DROP TABLE public.organizations;
DROP FUNCTION public.landing_org_audit();
DROP FUNCTION public.landing_org_audit_immutable();
DROP FUNCTION public.landing_members_keep_admin();
DROP FUNCTION public.landing_member_role(UUID);
DROP FUNCTION public.landing_is_platform_admin();

COMMIT;
