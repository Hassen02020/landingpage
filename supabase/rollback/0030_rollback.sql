-- Retour arrière de 0030. REFUSÉ tant qu'il existe des signalements, des doublons confirmés ou des activités de doublon :
-- ces données sont une preuve de décision. Exportez-les d'abord, puis traitez-les avant le retour arrière.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.landing_duplicate_reviews') IS NOT NULL AND EXISTS (SELECT 1 FROM public.landing_duplicate_reviews) THEN
    RAISE EXCEPTION 'ARRÊT : landing_duplicate_reviews contient des signalements. Exportez-les avant le retour arrière.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads' AND column_name = 'duplicate_of')
     AND EXISTS (SELECT 1 FROM public.landing_leads WHERE duplicate_of IS NOT NULL) THEN
    RAISE EXCEPTION 'ARRÊT : des dossiers sont confirmés comme doublons (duplicate_of renseigné). Rouvrez ou traitez ces décisions avant le retour arrière.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.landing_lead_activities WHERE type IN ('duplicate_flagged', 'duplicate_confirmed', 'duplicate_rejected', 'duplicate_reopened')) THEN
    RAISE EXCEPTION 'ARRÊT : des activités de doublon existent dans l''historique des dossiers. Exportez-les avant le retour arrière.';
  END IF;
END $$;

DROP TABLE IF EXISTS public.landing_duplicate_reviews;
DROP TRIGGER IF EXISTS landing_dup_lead_guard ON public.landing_leads;
ALTER TABLE public.landing_leads DROP COLUMN IF EXISTS duplicate_confirmed_at, DROP COLUMN IF EXISTS duplicate_of;
DROP FUNCTION IF EXISTS public.landing_dup_lead_guard();
DROP FUNCTION IF EXISTS public.landing_dup_review_insert_guard();
DROP FUNCTION IF EXISTS public.landing_dup_review_update_guard();
DROP FUNCTION IF EXISTS public.landing_dup_review_sync();

ALTER TABLE public.landing_lead_activities DROP CONSTRAINT landing_lead_activities_type_check;
ALTER TABLE public.landing_lead_activities ADD CONSTRAINT landing_lead_activities_type_check
  CHECK (type IN ('created', 'status_change', 'note', 'assignment', 'follow_up', 'marketing_withdrawn', 'anonymized', 'wa_in', 'wa_out'));
COMMIT;
