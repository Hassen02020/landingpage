-- =====================================================================
-- Easy2Book landing — 0009 : un EMPLOYÉ voit TOUS les leads de SON organisation
-- (décision du propriétaire, 08/11/2026 : « tous les employés voient tous les leads de leur propre entreprise ;
--  aucun employé ne voit les leads des autres entreprises »).
-- Remplace la règle de 0008 (employé : ses leads + les non affectés) pour les leads et leur historique.
-- Inchangé : admin et manager voient toute leur organisation ; les événements de navigation (identifiants visiteurs)
-- restent réservés aux admin et manager ; aucune écriture par l'API ; isolation entre organisations intacte.
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0008. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0009_rollback.sql. Contrôle : supabase/scripts/postcheck-0009.sql.
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
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0008 (0008_multitenant_foundation.sql).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'landing_leads'
                 AND policyname = 'landing_leads_org_read' AND qual LIKE '%assigned_to%') THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0009 a déjà été appliquée (ou la politique de 0008 est absente).';
  END IF;
END $$;

DROP POLICY landing_leads_org_read ON public.landing_leads;
CREATE POLICY landing_leads_org_read ON public.landing_leads
  FOR SELECT TO authenticated
  USING (public.landing_member_role(organization_id) IN ('admin', 'manager', 'employee'));

DROP POLICY landing_activities_org_read ON public.landing_lead_activities;
CREATE POLICY landing_activities_org_read ON public.landing_lead_activities
  FOR SELECT TO authenticated
  USING (public.landing_member_role(organization_id) IN ('admin', 'manager', 'employee'));

COMMIT;
