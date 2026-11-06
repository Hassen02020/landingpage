-- =====================================================================
-- Easy2Book landing — 0007 : pipeline commercial à 10 statuts
-- NOUVEAU → À CONTACTER → CONTACTÉ → À QUALIFIER → QUALIFIÉ → DEVIS / PROPOSITION → EN NÉGOCIATION
-- → RÉSERVATION EFFECTUÉE → GAGNÉ (+ PERDU).
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0001 à 0006.
--
-- Compatibilité : les 5 statuts historiques gardent leur valeur (nouveau, contacte, qualifie,
-- reserve, perdu) ; aucun lead existant n'est modifié. « Réservation effectuée » = reserve.
-- GAGNÉ (gagne) est une étape finale APRÈS la réservation ; reserve ET gagne comptent comme
-- « vendu » (montant obligatoire, date de réservation posée une seule fois : une vente n'est
-- jamais comptée deux fois). La conservation des données traite gagne comme reserve (36 mois).
-- =====================================================================

-- ---------- 0. Garde-fous ----------
DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads' AND column_name = 'region') THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0001 à 0006 (0006_landing_qualification.sql).';
  END IF;
  IF pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'landing_leads_status_check' AND conrelid = 'public.landing_leads'::regclass)) LIKE '%gagne%' THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0007 a déjà été appliquée.';
  END IF;
END $$;

-- ---------- 1. Statuts acceptés ----------
ALTER TABLE public.landing_leads DROP CONSTRAINT landing_leads_status_check;
ALTER TABLE public.landing_leads ADD CONSTRAINT landing_leads_status_check
  CHECK (status IN ('nouveau', 'a_contacter', 'contacte', 'a_qualifier', 'qualifie', 'devis', 'negociation', 'reserve', 'gagne', 'perdu'));

ALTER TABLE public.landing_lead_activities DROP CONSTRAINT landing_lead_activities_from_status_check;
ALTER TABLE public.landing_lead_activities DROP CONSTRAINT landing_lead_activities_to_status_check;
ALTER TABLE public.landing_lead_activities ADD CONSTRAINT landing_lead_activities_from_status_check
  CHECK (from_status IN ('nouveau', 'a_contacter', 'contacte', 'a_qualifier', 'qualifie', 'devis', 'negociation', 'reserve', 'gagne', 'perdu'));
ALTER TABLE public.landing_lead_activities ADD CONSTRAINT landing_lead_activities_to_status_check
  CHECK (to_status IN ('nouveau', 'a_contacter', 'contacte', 'a_qualifier', 'qualifie', 'devis', 'negociation', 'reserve', 'gagne', 'perdu'));

-- Une vente (reserve OU gagne) a toujours sa date de réservation.
ALTER TABLE public.landing_leads DROP CONSTRAINT landing_leads_booking_consistency;
ALTER TABLE public.landing_leads ADD CONSTRAINT landing_leads_booking_consistency
  CHECK (status NOT IN ('reserve', 'gagne') OR booked_at IS NOT NULL);

-- ---------- 2. Vues d'analyse : « vendu » = reserve ou gagne ----------
CREATE OR REPLACE VIEW public.landing_campaign_performance WITH (security_invoker = true) AS
SELECT
  COALESCE(channel, 'inconnu')       AS channel,
  COALESCE(utm_campaign, '(aucune)') AS utm_campaign,
  product,
  COUNT(*)                                                                                                         AS leads,
  COUNT(*) FILTER (WHERE status NOT IN ('nouveau', 'a_contacter'))                                                 AS leads_traites,
  COUNT(*) FILTER (WHERE status IN ('reserve', 'gagne'))                                                           AS reservations,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('reserve', 'gagne')) / NULLIF(COUNT(*), 0), 1)                   AS taux_conversion_pct,
  COALESCE(SUM(booking_value) FILTER (WHERE status IN ('reserve', 'gagne')), 0)                                    AS chiffre_affaires_tnd
FROM public.landing_leads
GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW public.landing_niche_performance WITH (security_invoker = true) AS
WITH clics AS (
  SELECT product, COALESCE(niche, '(général)') AS niche,
         COUNT(*) AS clics_whatsapp, COUNT(DISTINCT visitor_id) AS visiteurs
  FROM public.landing_events WHERE event_name = 'Contact'
  GROUP BY 1, 2
), l AS (
  SELECT product, COALESCE(niche, '(général)') AS niche,
         COUNT(*) AS leads,
         COUNT(*) FILTER (WHERE status IN ('reserve', 'gagne')) AS reservations,
         COALESCE(SUM(booking_value) FILTER (WHERE status IN ('reserve', 'gagne')), 0) AS chiffre_affaires_tnd
  FROM public.landing_leads GROUP BY 1, 2
)
SELECT
  COALESCE(c.product, l.product) AS product,
  COALESCE(c.niche, l.niche)     AS niche,
  COALESCE(c.clics_whatsapp, 0)  AS clics_whatsapp,
  COALESCE(c.visiteurs, 0)       AS visiteurs_contact,
  COALESCE(l.leads, 0)           AS leads,
  COALESCE(l.reservations, 0)    AS reservations,
  COALESCE(l.chiffre_affaires_tnd, 0) AS chiffre_affaires_tnd
FROM clics c
FULL OUTER JOIN l ON l.product = c.product AND l.niche = c.niche;

-- ---------- 3. Conservation : un lead GAGNÉ est conservé comme un lead RÉSERVÉ (36 mois) ----------
-- Sans cette règle, un lead gagné serait anonymisé à 24 mois comme un lead non converti.
-- (fonction de 0006 reprise à l'identique, avec « reserve » → « reserve ou gagne »)
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
           destination = NULL, visitor_ref = NULL, email = NULL, region = NULL, marketing_consent = false, anonymized_at = now()
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
