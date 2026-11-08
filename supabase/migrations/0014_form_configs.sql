-- =====================================================================
-- Easy2Book landing — 0014 : formulaire configurable par entreprise + champs personnalisés (chantier 05 B)
--   • landing_form_configs : UNE configuration de formulaire par organisation (champs affichés / obligatoires, champs personnalisés) ;
--   • landing_leads.custom_fields : réponses aux champs personnalisés (objet JSON borné) ;
--   • landing_purge_personal_data : l'anonymisation efface aussi custom_fields (ce sont des données personnelles).
-- Rien n'est modifié pour Easy2Book tant qu'aucune configuration n'existe (le formulaire actuel reste inchangé).
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0008. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0014_rollback.sql (refusé si des réponses personnalisées existent). Contrôle : supabase/scripts/postcheck-0014.sql.
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
  IF to_regclass('public.landing_form_configs') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0014 a déjà été appliquée.';
  END IF;
END $$;

-- ---------- 1. Réponses aux champs personnalisés ----------
ALTER TABLE public.landing_leads
  ADD COLUMN custom_fields JSONB
  CHECK (custom_fields IS NULL OR (jsonb_typeof(custom_fields) = 'object' AND octet_length(custom_fields::text) <= 4000));

-- ---------- 2. Configuration du formulaire, une par organisation ----------
CREATE TABLE public.landing_form_configs (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations (id) ON DELETE RESTRICT,
  config          JSONB NOT NULL CHECK (jsonb_typeof(config) = 'object' AND octet_length(config::text) <= 8000),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID
);
ALTER TABLE public.landing_form_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_form_configs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_form_configs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.landing_form_configs TO service_role;
GRANT SELECT ON public.landing_form_configs TO authenticated;
CREATE POLICY landing_form_configs_member_read ON public.landing_form_configs
  FOR SELECT TO authenticated USING (public.landing_member_role(organization_id) IS NOT NULL);
CREATE TRIGGER landing_org_immutable BEFORE UPDATE OF organization_id ON public.landing_form_configs
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable();

-- ---------- 3. Anonymisation : custom_fields effacé avec le reste ----------
CREATE OR REPLACE FUNCTION public.landing_purge_personal_data() RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  n_ids int; n_events int; n_leads int;
BEGIN
  -- autorise les mises à jour de purge malgré les règles métier (triggers), pour cette transaction seulement
  PERFORM set_config('landing.purge', 'on', true);

  UPDATE landing_leads
     SET visitor_id = NULL, fbclid = NULL, ttclid = NULL, fbp = NULL, fbc = NULL, ttp = NULL,
         ip = NULL, user_agent = NULL
   WHERE created_at < now() - interval '90 days'
     AND (visitor_id IS NOT NULL OR fbclid IS NOT NULL OR ttclid IS NOT NULL OR fbp IS NOT NULL
          OR fbc IS NOT NULL OR ttp IS NOT NULL OR ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS n_ids = ROW_COUNT;

  UPDATE landing_events SET visitor_id = NULL
   WHERE created_at < now() - interval '90 days' AND visitor_id IS NOT NULL;

  DELETE FROM landing_events WHERE created_at < now() - interval '13 months';
  GET DIAGNOSTICS n_events = ROW_COUNT;

  -- texte libre de l'historique (notes, commentaires) des leads à anonymiser
  UPDATE landing_lead_activities a SET body = NULL
    FROM landing_leads l
   WHERE a.lead_id = l.id AND a.body IS NOT NULL AND l.anonymized_at IS NULL
     AND ((l.status NOT IN ('reserve', 'gagne') AND l.last_activity_at < now() - interval '24 months')
       OR (l.status IN ('reserve', 'gagne') AND greatest(l.last_activity_at, l.booked_at) < now() - interval '36 months'));

  WITH anonymized AS (
    UPDATE landing_leads
       SET first_name = 'Anonymisé', last_name = NULL, phone = NULL, message = NULL, notes = NULL,
           destination = NULL, visitor_ref = NULL, email = NULL, region = NULL, custom_fields = NULL, marketing_consent = false, anonymized_at = now()
     WHERE anonymized_at IS NULL
       AND ((status NOT IN ('reserve', 'gagne') AND last_activity_at < now() - interval '24 months')
         OR (status IN ('reserve', 'gagne') AND greatest(last_activity_at, booked_at) < now() - interval '36 months'))
    RETURNING id
  )
  INSERT INTO landing_lead_activities (lead_id, actor_label, type, body)
  SELECT id, 'système', 'anonymized', 'Anonymisation automatique (durée de conservation atteinte)' FROM anonymized;
  GET DIAGNOSTICS n_leads = ROW_COUNT;

  PERFORM set_config('landing.purge', 'off', true);
  RETURN jsonb_build_object('identifiants_effaces', n_ids, 'evenements_supprimes', n_events, 'leads_anonymises', n_leads);
END $$;

COMMIT;
