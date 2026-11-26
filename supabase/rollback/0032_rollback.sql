-- Retour arrière de 0032 (L7b). Refusé si des confirmations, conditions de paiement ou références de commission ont été saisies.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.landing_booking_confirmations') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0032 n''est pas appliquée.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.landing_booking_confirmations)
     OR EXISTS (SELECT 1 FROM public.landing_offers WHERE payment_terms_defined OR deposit_kind IS NOT NULL OR payment_terms_note IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.landing_commissions WHERE confirmation_ref IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.landing_lead_activities WHERE type = 'booking_confirmation_changed') THEN
    RAISE EXCEPTION 'ARRÊT : des données L7b existent ; exportez-les puis décidez avec le propriétaire avant tout retour arrière.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.landing_commissions_guard() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE lead_org UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT organization_id INTO lead_org FROM public.landing_leads WHERE id = NEW.lead_id;
    IF lead_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'commission refusée : le lead appartient à une autre entreprise';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'provisoire' OR NEW.status <> 'confirme' THEN
    RAISE EXCEPTION 'seule la confirmation (provisoire vers confirmé) est permise, une seule fois';
  END IF;
  IF (NEW.id, NEW.organization_id, NEW.lead_id, NEW.line_key, NEW.external_ref, NEW.kind, NEW.amount_tnd, NEW.event_date, NEW.source, NEW.import_batch, NEW.created_at, NEW.created_by)
     IS DISTINCT FROM (OLD.id, OLD.organization_id, OLD.lead_id, OLD.line_key, OLD.external_ref, OLD.kind, OLD.amount_tnd, OLD.event_date, OLD.source, OLD.import_batch, OLD.created_at, OLD.created_by) THEN
    RAISE EXCEPTION 'une commission enregistrée ne se modifie pas : ajoutez une ligne d''annulation ou de remboursement';
  END IF;
  RETURN NEW;
END $$;

ALTER TABLE public.landing_lead_activities DROP CONSTRAINT landing_lead_activities_type_check;
ALTER TABLE public.landing_lead_activities ADD CONSTRAINT landing_lead_activities_type_check
  CHECK (type IN ('created', 'status_change', 'note', 'assignment', 'follow_up', 'marketing_withdrawn', 'anonymized', 'wa_in', 'wa_out',
                  'duplicate_flagged', 'duplicate_confirmed', 'duplicate_rejected', 'duplicate_reopened'));
REVOKE UPDATE (confirmation_ref) ON public.landing_commissions FROM service_role;
ALTER TABLE public.landing_commissions DROP COLUMN confirmation_ref;
DROP TABLE public.landing_booking_confirmations;
DROP FUNCTION public.landing_booking_confirmations_guard();
ALTER TABLE public.landing_offers
  DROP CONSTRAINT landing_offers_terms_defined_coherent, DROP CONSTRAINT landing_offers_deposit_coherent,
  DROP COLUMN payment_terms_defined, DROP COLUMN deposit_kind, DROP COLUMN deposit_value, DROP COLUMN deposit_due_date,
  DROP COLUMN payment_terms_note, DROP COLUMN payment_terms_updated_by, DROP COLUMN payment_terms_updated_at;
DROP FUNCTION public.landing_short_note_ok(TEXT);
COMMIT;
