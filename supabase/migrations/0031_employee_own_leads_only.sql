-- =====================================================================
-- Easy2Book landing — 0031 : un EMPLOYÉ ne lit que les leads qui lui sont ACTUELLEMENT affectés (accès par jeton / RLS)
-- (décision Q8-A du propriétaire, 26/11/2026, qui remplace celles des 07/11 et 08/11/2026 ; même règle que le lot L3 appliqué par le serveur).
-- Corrige la limite des politiques RLS : avec la 0009, un employé qui interrogeait la base directement avec son propre jeton lisait TOUTE son
-- organisation ; avec la 0008 seule il lisait ses leads ET les leads non affectés. Après 0031 : seulement les siens, dans les deux cas.
-- Inchangé : admin et manager voient toute leur organisation ; aucune lecture entre organisations ; événements de navigation réservés
-- aux admin et manager ; aucune écriture par l'API ; le serveur du site (clé de service, qui ignore la RLS) fonctionne comme avant, y compris
-- la détection des doublons ; aucune donnée modifiée (l'historique des réaffectations reste en base ; seule sa LECTURE par jeton suit le lead).
-- Rejouable (sans effet la seconde fois). À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0008 (0009 facultative).
-- JAMAIS dans EasyV4. Retour arrière : supabase/rollback/0031_rollback.sql. Contrôle : supabase/scripts/postcheck-0031.sql.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.organizations') IS NULL OR to_regprocedure('public.landing_member_role(uuid)') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0008 (0008_multitenant_foundation.sql).';
  END IF;
END $$;

-- Leads : admin et manager de l'organisation voient tout ; un employé voit UNIQUEMENT les leads dont il est le responsable actuel.
DROP POLICY IF EXISTS landing_leads_org_read ON public.landing_leads;
CREATE POLICY landing_leads_org_read ON public.landing_leads
  FOR SELECT TO authenticated
  USING (public.landing_member_role(organization_id) IN ('admin', 'manager')
         OR (public.landing_member_role(organization_id) = 'employee' AND assigned_to = auth.uid()));

-- Historique : suit la visibilité du lead (un lead réaffecté sort de la lecture de l'ancien employé, l'historique reste en base).
DROP POLICY IF EXISTS landing_activities_org_read ON public.landing_lead_activities;
CREATE POLICY landing_activities_org_read ON public.landing_lead_activities
  FOR SELECT TO authenticated
  USING (public.landing_member_role(organization_id) IN ('admin', 'manager')
         OR (public.landing_member_role(organization_id) = 'employee'
             AND EXISTS (SELECT 1 FROM public.landing_leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid())));

COMMIT;
