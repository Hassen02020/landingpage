-- =====================================================================
-- Easy2Book landing — 0002 : mini-CRM (équipe, historique, suivi, conservation)
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0001.
-- =====================================================================

-- ---------- 0. Garde-fous ----------
DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_leads') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0001_landing_leads.sql.';
  END IF;
  IF to_regclass('public.landing_staff') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0002 a déjà été appliquée.';
  END IF;
END $$;

-- ---------- 1. Équipe ----------
-- Un compte Supabase Auth n'a accès à /admin que s'il figure ici et est actif.
CREATE TABLE public.landing_staff (
  user_id     UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email       TEXT NOT NULL CHECK (char_length(email) <= 320),
  full_name   TEXT CHECK (char_length(full_name) <= 120),
  role        TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE FUNCTION public.landing_is_staff() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.landing_staff WHERE user_id = auth.uid() AND active)
$$;
REVOKE ALL ON FUNCTION public.landing_is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.landing_is_staff() TO authenticated, service_role;

-- ---------- 2. Suivi commercial sur les leads ----------
ALTER TABLE public.landing_leads
  ADD COLUMN source                 TEXT NOT NULL DEFAULT 'form'
                                    CHECK (source IN ('form', 'whatsapp', 'phone', 'manual')),
  ADD COLUMN assigned_to            UUID REFERENCES public.landing_staff (user_id) ON DELETE SET NULL,
  ADD COLUMN next_follow_up_at      TIMESTAMPTZ,
  ADD COLUMN updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN consent_text_version   TEXT CHECK (char_length(consent_text_version) <= 32),
  ADD COLUMN marketing_withdrawn_at TIMESTAMPTZ,
  ADD COLUMN anonymized_at          TIMESTAMPTZ;

-- Anonymisation : le téléphone peut être effacé, mais uniquement sur un lead anonymisé
ALTER TABLE public.landing_leads ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.landing_leads ADD CONSTRAINT landing_leads_phone_unless_anonymized
  CHECK (phone IS NOT NULL OR anonymized_at IS NOT NULL);
ALTER TABLE public.landing_leads ADD CONSTRAINT landing_leads_withdrawn_means_no_marketing
  CHECK (marketing_withdrawn_at IS NULL OR marketing_consent = false);

CREATE INDEX landing_leads_follow_up_idx ON public.landing_leads (next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX landing_leads_assigned_idx ON public.landing_leads (assigned_to);

CREATE FUNCTION public.landing_touch_updated_at() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER landing_leads_touch BEFORE UPDATE ON public.landing_leads
  FOR EACH ROW EXECUTE FUNCTION public.landing_touch_updated_at();

-- ---------- 3. Historique (ajout uniquement) ----------
CREATE TABLE public.landing_lead_activities (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_id      UUID NOT NULL REFERENCES public.landing_leads (id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES public.landing_staff (user_id) ON DELETE SET NULL,
  actor_label  TEXT NOT NULL CHECK (char_length(actor_label) <= 320),   -- e-mail, « système », « API »
  type         TEXT NOT NULL CHECK (type IN ('created', 'status_change', 'note', 'assignment',
                                             'follow_up', 'marketing_withdrawn', 'anonymized')),
  from_status  TEXT CHECK (from_status IN ('nouveau', 'contacte', 'qualifie', 'reserve', 'perdu')),
  to_status    TEXT CHECK (to_status IN ('nouveau', 'contacte', 'qualifie', 'reserve', 'perdu')),
  body         TEXT CHECK (char_length(body) <= 2000)
);
CREATE INDEX landing_lead_activities_lead_idx ON public.landing_lead_activities (lead_id, created_at DESC);

-- L'historique ne se modifie ni ne se supprime (même par l'API)
CREATE FUNCTION public.landing_activities_immutable() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;   -- suppression en cascade d'un lead (droit à l'effacement)
  END IF;
  RAISE EXCEPTION 'landing_lead_activities est en ajout seul';
END $$;
CREATE TRIGGER landing_lead_activities_no_update BEFORE UPDATE OR DELETE ON public.landing_lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.landing_activities_immutable();

-- ---------- 4. Sécurité ----------
ALTER TABLE public.landing_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_staff FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landing_lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_lead_activities FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.landing_staff, public.landing_lead_activities FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.landing_staff TO service_role;
GRANT SELECT, INSERT ON public.landing_lead_activities TO service_role;

-- Défense en profondeur : un compte connecté MEMBRE ACTIF de l'équipe peut lire et
-- traiter les leads (le site passe par le serveur, mais la base l'impose aussi).
GRANT SELECT, UPDATE ON public.landing_leads TO authenticated;
GRANT SELECT ON public.landing_events TO authenticated;
GRANT SELECT, INSERT ON public.landing_lead_activities TO authenticated;
GRANT SELECT ON public.landing_staff TO authenticated;

CREATE POLICY landing_leads_staff_read ON public.landing_leads
  FOR SELECT TO authenticated USING (public.landing_is_staff());
CREATE POLICY landing_leads_staff_update ON public.landing_leads
  FOR UPDATE TO authenticated USING (public.landing_is_staff()) WITH CHECK (public.landing_is_staff());
CREATE POLICY landing_events_staff_read ON public.landing_events
  FOR SELECT TO authenticated USING (public.landing_is_staff());
CREATE POLICY landing_activities_staff_read ON public.landing_lead_activities
  FOR SELECT TO authenticated USING (public.landing_is_staff());
CREATE POLICY landing_activities_staff_insert ON public.landing_lead_activities
  FOR INSERT TO authenticated WITH CHECK (public.landing_is_staff() AND actor_id = auth.uid());
CREATE POLICY landing_staff_self_or_staff ON public.landing_staff
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.landing_is_staff());

-- ---------- 5. Conservation des données ----------
-- Durées (à valider par Easy2Book) :
--   * identifiants publicitaires et techniques (IP, navigateur, cookies, clics) : 90 jours
--   * événements de navigation (landing_events) : 13 mois
--   * leads non convertis (nouveau, contacte, qualifie, perdu) : anonymisés après 24 mois
--   * leads réservés : anonymisés après 36 mois
CREATE FUNCTION public.landing_purge_personal_data() RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  n_ids int; n_events int; n_leads int;
BEGIN
  UPDATE landing_leads
     SET visitor_id = NULL, fbclid = NULL, ttclid = NULL, fbp = NULL, fbc = NULL, ttp = NULL,
         ip = NULL, user_agent = NULL
   WHERE created_at < now() - interval '90 days'
     AND (visitor_id IS NOT NULL OR fbclid IS NOT NULL OR ttclid IS NOT NULL OR fbp IS NOT NULL
          OR fbc IS NOT NULL OR ttp IS NOT NULL OR ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS n_ids = ROW_COUNT;

  DELETE FROM landing_events WHERE created_at < now() - interval '13 months';
  GET DIAGNOSTICS n_events = ROW_COUNT;

  WITH anonymized AS (
    UPDATE landing_leads
       SET first_name = 'Anonymisé', last_name = NULL, phone = NULL, message = NULL, notes = NULL,
           destination = NULL, visitor_ref = NULL, marketing_consent = false, anonymized_at = now()
     WHERE anonymized_at IS NULL
       AND ((status <> 'reserve' AND created_at < now() - interval '24 months')
         OR (status = 'reserve' AND created_at < now() - interval '36 months'))
    RETURNING id
  )
  INSERT INTO landing_lead_activities (lead_id, actor_label, type, body)
  SELECT id, 'système', 'anonymized', 'Anonymisation automatique (durée de conservation atteinte)' FROM anonymized;
  GET DIAGNOSTICS n_leads = ROW_COUNT;

  RETURN jsonb_build_object('identifiants_effaces', n_ids, 'evenements_supprimes', n_events, 'leads_anonymises', n_leads);
END $$;
REVOKE ALL ON FUNCTION public.landing_purge_personal_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_purge_personal_data() TO service_role;

-- Planification quotidienne (03:15, heure UTC) si l'extension pg_cron est disponible.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.schedule('landing-purge-personal-data', '15 3 * * *', 'SELECT public.landing_purge_personal_data()');
  ELSE
    RAISE NOTICE 'pg_cron indisponible : lancer SELECT public.landing_purge_personal_data(); chaque jour.';
  END IF;
END $$;
