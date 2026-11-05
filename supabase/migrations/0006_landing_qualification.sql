-- =====================================================================
-- Easy2Book landing — 0006 : qualification commerciale (e-mail, région, canal de contact)
-- et suppression des valeurs inventées (voyageurs).
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0001 à 0005.
--
-- Décisions du propriétaire : le premier formulaire reste court (prénom, téléphone, produit,
-- offre) ; l'e-mail est facultatif ; la région est demandée pendant la qualification ; le budget
-- (déjà présent) est une DÉCLARATION commerciale, jamais une dépense réelle.
-- =====================================================================

-- ---------- 0. Garde-fous ----------
DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_message_templates') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0001 à 0005 (0005_landing_team_templates.sql).';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads' AND column_name = 'region') THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0006 a déjà été appliquée.';
  END IF;
END $$;

-- ---------- 1. Nouvelles données de qualification ----------
ALTER TABLE public.landing_leads
  ADD COLUMN email           TEXT CHECK (char_length(email) <= 254 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  ADD COLUMN region          TEXT CHECK (region IN ('Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte', 'Béja', 'Jendouba', 'Le Kef', 'Siliana', 'Sousse', 'Monastir', 'Mahdia', 'Sfax', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Gabès', 'Médenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kébili', 'Étranger')),
  ADD COLUMN contact_channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (contact_channel IN ('whatsapp', 'phone', 'email')),
  ADD COLUMN form_page       TEXT CHECK (char_length(form_page) <= 255);

COMMENT ON COLUMN public.landing_leads.email IS 'Facultatif. Donnée personnelle : effacée à l''anonymisation.';
COMMENT ON COLUMN public.landing_leads.region IS 'Gouvernorat déclaré, demandé pendant la qualification (jamais au premier contact).';
COMMENT ON COLUMN public.landing_leads.form_page IS 'Page (chemin, sans paramètres) où le formulaire a été envoyé ; landing_page = page d''arrivée de la visite.';
COMMENT ON COLUMN public.landing_leads.budget IS 'Budget DÉCLARÉ par le prospect (déclaration commerciale, jamais une dépense réelle).';

-- ---------- 2. Plus de valeurs inventées ----------
-- Quand le visiteur n'indique pas le nombre de voyageurs, la base garde « inconnu » (NULL)
-- au lieu de « 1 adulte, 0 enfant ». Les leads existants ne sont pas modifiés.
ALTER TABLE public.landing_leads ALTER COLUMN adults DROP NOT NULL, ALTER COLUMN adults DROP DEFAULT;
ALTER TABLE public.landing_leads ALTER COLUMN children DROP NOT NULL, ALTER COLUMN children DROP DEFAULT;

-- ---------- 2 bis. Échanges WhatsApp enregistrés par l'équipe ----------
-- « Message reçu » / « message envoyé » : saisis par le conseiller (aucune API WhatsApp n'est connectée).
-- Ils permettent de compter les conversations suivies sans les confondre avec de simples clics.
ALTER TABLE public.landing_lead_activities DROP CONSTRAINT landing_lead_activities_type_check;
ALTER TABLE public.landing_lead_activities ADD CONSTRAINT landing_lead_activities_type_check
  CHECK (type IN ('created', 'status_change', 'note', 'assignment', 'follow_up', 'marketing_withdrawn', 'anonymized', 'wa_in', 'wa_out'));

-- ---------- 3. Conservation : l'e-mail et la région sont effacés à l'anonymisation ----------
-- (fonction de 0002 reprise à l'identique, avec email et region en plus)
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
     AND ((l.status <> 'reserve' AND l.last_activity_at < now() - interval '24 months')
       OR (l.status = 'reserve' AND greatest(l.last_activity_at, l.booked_at) < now() - interval '36 months'));

  WITH anonymized AS (
    UPDATE landing_leads
       SET first_name = 'Anonymisé', last_name = NULL, phone = NULL, message = NULL, notes = NULL,
           destination = NULL, visitor_ref = NULL, email = NULL, region = NULL, marketing_consent = false, anonymized_at = now()
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
