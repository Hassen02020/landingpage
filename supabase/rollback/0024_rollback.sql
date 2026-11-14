-- Retour arrière de 0024 : refusé tant qu'un numéro WhatsApp est ACTIVÉ (les messages entrants ne seraient plus rattachés).
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.landing_whatsapp_numbers') IS NOT NULL AND EXISTS (SELECT 1 FROM public.landing_whatsapp_numbers WHERE enabled) THEN
    RAISE EXCEPTION 'ARRÊT : des numéros WhatsApp sont activés. Désactivez-les avant le retour arrière.';
  END IF;
END $$;
DROP TABLE IF EXISTS public.landing_whatsapp_numbers;
COMMIT;
