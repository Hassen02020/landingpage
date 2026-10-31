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
  ADD COLUMN anonymized_at          TIMESTAMPTZ,
  -- dernière interaction (création, statut, note, relance…) : point de départ des durées de conservation
  ADD COLUMN last_activity_at       TIMESTAMPTZ;
UPDATE public.landing_leads SET last_activity_at = created_at;
ALTER TABLE public.landing_leads
  ALTER COLUMN last_activity_at SET DEFAULT now(),
  ALTER COLUMN last_activity_at SET NOT NULL;

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

-- Règles métier imposées par la base, quel que soit le rôle (service_role et postgres compris) :
--   * un lead anonymisé ne peut plus être modifié (sauf par la purge) — l'effacement (DELETE) reste possible ;
--   * la date de réservation (booked_at), une fois posée, ne change plus : une vente n'est jamais comptée deux fois.
CREATE FUNCTION public.landing_leads_guard() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_setting('landing.purge', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF OLD.anonymized_at IS NOT NULL THEN
    RAISE EXCEPTION 'lead % anonymisé : modification interdite', OLD.ref;
  END IF;
  IF OLD.booked_at IS NOT NULL AND NEW.booked_at IS DISTINCT FROM OLD.booked_at THEN
    RAISE EXCEPTION 'lead % : la date de réservation ne peut plus être modifiée', OLD.ref;
  END IF;
  IF NEW.anonymized_at IS NOT NULL THEN
    RAISE EXCEPTION 'l''anonymisation est réservée à landing_purge_personal_data()';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_leads_guard BEFORE UPDATE ON public.landing_leads
  FOR EACH ROW EXECUTE FUNCTION public.landing_leads_guard();

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

-- L'historique ne se modifie ni ne se supprime (même par l'API). Seules exceptions :
--   * suppression en cascade d'un lead (droit à l'effacement) ;
--   * effacement du texte (body) par landing_purge_personal_data() lors d'une anonymisation.
CREATE FUNCTION public.landing_activities_immutable() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND current_setting('landing.purge', true) = 'on'
     AND NEW.body IS NULL
     AND (NEW.id, NEW.created_at, NEW.lead_id, NEW.actor_id, NEW.actor_label, NEW.type, NEW.from_status, NEW.to_status)
         IS NOT DISTINCT FROM
         (OLD.id, OLD.created_at, OLD.lead_id, OLD.actor_id, OLD.actor_label, OLD.type, OLD.from_status, OLD.to_status) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'landing_lead_activities est en ajout seul';
END $$;
CREATE TRIGGER landing_lead_activities_no_update BEFORE UPDATE OR DELETE ON public.landing_lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.landing_activities_immutable();

-- TRUNCATE ne déclenche pas les triggers ligne par ligne : il est interdit séparément (tous rôles).
CREATE FUNCTION public.landing_activities_no_truncate() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'landing_lead_activities est en ajout seul (TRUNCATE interdit)';
END $$;
CREATE TRIGGER landing_lead_activities_no_truncate BEFORE TRUNCATE ON public.landing_lead_activities
  FOR EACH STATEMENT EXECUTE FUNCTION public.landing_activities_no_truncate();

-- Chaque activité (hors anonymisation) met à jour la dernière interaction du lead.
CREATE FUNCTION public.landing_activity_touch_lead() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.type <> 'anonymized' THEN
    UPDATE public.landing_leads
       SET last_activity_at = greatest(last_activity_at, NEW.created_at)
     WHERE id = NEW.lead_id AND anonymized_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_lead_activities_touch_lead AFTER INSERT ON public.landing_lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.landing_activity_touch_lead();

-- ---------- 4. Sécurité ----------
ALTER TABLE public.landing_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_staff FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landing_lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_lead_activities FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.landing_staff, public.landing_lead_activities FROM PUBLIC, anon, authenticated;

-- service_role (clé serveur du site) : Supabase lui accorde par défaut TOUS les droits, y compris
-- DELETE et TRUNCATE. On les retire, y compris sur les tables de 0001, et on ne rend que le strict
-- nécessaire au code du site. Effacements et gestion de l'équipe : éditeur SQL (rôle postgres).
REVOKE ALL ON public.landing_leads, public.landing_events, public.landing_staff, public.landing_lead_activities,
              public.landing_campaign_performance, public.landing_niche_performance FROM service_role;
GRANT SELECT, INSERT, UPDATE ON public.landing_leads TO service_role;
GRANT SELECT, INSERT ON public.landing_events TO service_role;
GRANT SELECT, INSERT ON public.landing_lead_activities TO service_role;
GRANT SELECT ON public.landing_staff TO service_role;
GRANT SELECT ON public.landing_campaign_performance, public.landing_niche_performance TO service_role;

-- Défense en profondeur : un compte connecté MEMBRE ACTIF de l'équipe peut seulement LIRE.
-- Toute modification passe par le serveur du site (clé service_role), qui écrit l'historique :
-- aucune modification directe par l'API Supabase ne peut contourner la traçabilité.
GRANT SELECT ON public.landing_leads TO authenticated;
GRANT SELECT ON public.landing_events TO authenticated;
GRANT SELECT ON public.landing_lead_activities TO authenticated;
GRANT SELECT ON public.landing_staff TO authenticated;

CREATE POLICY landing_leads_staff_read ON public.landing_leads
  FOR SELECT TO authenticated USING (public.landing_is_staff());
CREATE POLICY landing_events_staff_read ON public.landing_events
  FOR SELECT TO authenticated USING (public.landing_is_staff());
CREATE POLICY landing_activities_staff_read ON public.landing_lead_activities
  FOR SELECT TO authenticated USING (public.landing_is_staff());
CREATE POLICY landing_staff_self_or_staff ON public.landing_staff
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.landing_is_staff());

-- ---------- 5. Conservation des données ----------
-- Durées (à valider par Easy2Book) :
--   * identifiants publicitaires et techniques (IP, navigateur, cookies, clics, identifiant visiteur) : 90 jours
--   * événements de navigation (landing_events) : 13 mois
--   * leads non convertis (nouveau, contacte, qualifie, perdu) : anonymisés 24 mois après la DERNIÈRE interaction
--   * leads réservés : anonymisés 36 mois après la dernière interaction ou la réservation (la plus récente)
CREATE FUNCTION public.landing_purge_personal_data() RETURNS jsonb
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
     AND ((l.status <> 'reserve' AND l.last_activity_at < now() - interval '24 months')
       OR (l.status = 'reserve' AND greatest(l.last_activity_at, l.booked_at) < now() - interval '36 months'));

  WITH anonymized AS (
    UPDATE landing_leads
       SET first_name = 'Anonymisé', last_name = NULL, phone = NULL, message = NULL, notes = NULL,
           destination = NULL, visitor_ref = NULL, marketing_consent = false, anonymized_at = now()
     WHERE anonymized_at IS NULL
       AND ((status <> 'reserve' AND last_activity_at < now() - interval '24 months')
         OR (status = 'reserve' AND greatest(last_activity_at, booked_at) < now() - interval '36 months'))
    RETURNING id
  )
  INSERT INTO landing_lead_activities (lead_id, actor_label, type, body)
  SELECT id, 'système', 'anonymized', 'Anonymisation automatique (durée de conservation atteinte)' FROM anonymized;
  GET DIAGNOSTICS n_leads = ROW_COUNT;

  PERFORM set_config('landing.purge', 'off', true);
  RETURN jsonb_build_object('identifiants_effaces', n_ids, 'evenements_supprimes', n_events, 'leads_anonymises', n_leads);
END $$;
REVOKE ALL ON FUNCTION public.landing_purge_personal_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_purge_personal_data() TO service_role;

-- Planification : VOLONTAIREMENT ABSENTE tant que les durées ci-dessus ne sont pas validées.
-- Après validation, activer pg_cron (Dashboard > Database > Extensions) puis exécuter :
--   SELECT cron.schedule('landing-purge-personal-data', '15 3 * * *', 'SELECT public.landing_purge_personal_data()');
