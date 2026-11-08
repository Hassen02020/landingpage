-- Retour arrière de 0014 : refusé tant que des réponses personnalisées existent (elles seraient perdues).
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.landing_leads WHERE custom_fields IS NOT NULL) THEN
    RAISE EXCEPTION 'ARRÊT : des leads contiennent des réponses personnalisées. Exportez-les ou effacez-les avant le retour arrière.';
  END IF;
END $$;
DROP TABLE IF EXISTS public.landing_form_configs;
ALTER TABLE public.landing_leads DROP COLUMN IF EXISTS custom_fields;
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
COMMIT;
