-- =====================================================================
-- Easy2Book landing — 0032 (L7b) : confirmation des réservations + référence justificative de commission
-- (décisions du propriétaire du 26/11/2026 : Q2-A saisie manuelle structurée, Q3 puis option C, Q9-A inchangé).
-- Une réservation n'est « confirmée » que si : confirmation du fournisseur enregistrée ET conditions de paiement de l'offre DÉFINIES
-- ET dossier marqué « conditions de paiement respectées » (règle calculée par le serveur, lib/booking-confirmation.ts).
--   A. landing_offers  : colonnes FACULTATIVES de conditions de paiement (acompte, date limite, mention courte).
--   B. landing_booking_confirmations : une ligne par dossier (lead_id unique), organisation immuable, jamais de suppression.
--   C. landing_commissions.confirmation_ref : référence justificative FACULTATIVE, posée UNIQUEMENT lors de la transition provisoire → confirmé.
-- Aucune ligne existante modifiée, aucun import, aucun document, aucune donnée personnelle ajoutée. Les dossiers existants restent « Non renseigné ».
-- Lecture par jeton : un employé ne lit que la confirmation de SES dossiers (même règle que 0031) ; admin et manager : toute l'organisation ;
-- aucune écriture par jeton (le serveur, clé de service, écrit).
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0016 et 0031. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0032_rollback.sql (refusé si des confirmations existent). Contrôle : supabase/scripts/postcheck-0032.sql.
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
  IF to_regclass('public.landing_commissions') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0016 (0016_ad_economics.sql).';
  END IF;
  IF to_regclass('public.landing_booking_confirmations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0032 a déjà été appliquée.';
  END IF;
END $$;

-- Mention courte : 140 caractères au plus, ni e-mail, ni lien, ni numéro de téléphone (mêmes refus que les notes du lot L2).
CREATE FUNCTION public.landing_short_note_ok(t TEXT) RETURNS boolean
  LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  SELECT t IS NULL OR (char_length(t) <= 140
    AND t !~ '@'
    AND t !~* '(https?:|www\.|\.(com|net|org|tn|fr)\M)'
    AND t !~ '(\+|00)?[0-9][0-9 .()-]{6,}[0-9]')
$$;

-- ---------- A. Conditions de paiement par offre (facultatives) ----------
ALTER TABLE public.landing_offers
  ADD COLUMN payment_terms_defined    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN deposit_kind             TEXT CHECK (deposit_kind IN ('aucun', 'pourcentage', 'montant')),
  ADD COLUMN deposit_value            NUMERIC(12, 3) CHECK (deposit_value >= 0),
  ADD COLUMN deposit_due_date         DATE,
  ADD COLUMN payment_terms_note       TEXT CHECK (public.landing_short_note_ok(payment_terms_note)),
  ADD COLUMN payment_terms_updated_by UUID,
  ADD COLUMN payment_terms_updated_at TIMESTAMPTZ,
  ADD CONSTRAINT landing_offers_deposit_coherent CHECK (
    (deposit_kind IS NULL OR deposit_kind = 'aucun') AND deposit_value IS NULL
    OR deposit_kind = 'pourcentage' AND deposit_value IS NOT NULL AND deposit_value <= 100
    OR deposit_kind = 'montant' AND deposit_value IS NOT NULL AND deposit_value <= 100000000),
  -- « définies » n'est vrai que si le type d'acompte est choisi
  ADD CONSTRAINT landing_offers_terms_defined_coherent CHECK (NOT payment_terms_defined OR deposit_kind IS NOT NULL);

-- ---------- B. Confirmation par dossier ----------
CREATE TABLE public.landing_booking_confirmations (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id      UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  lead_id              UUID NOT NULL UNIQUE REFERENCES public.landing_leads (id) ON DELETE RESTRICT,
  supplier_confirmed   TEXT CHECK (supplier_confirmed IN ('oui', 'non')),
  supplier_confirmed_on DATE CHECK (supplier_confirmed_on BETWEEN DATE '2020-01-01' AND DATE '2100-12-31'),
  supplier_proof_note  TEXT CHECK (public.landing_short_note_ok(supplier_proof_note)),
  payment_respected    TEXT CHECK (payment_respected IN ('oui', 'non')),
  payment_respected_on DATE CHECK (payment_respected_on BETWEEN DATE '2020-01-01' AND DATE '2100-12-31'),
  entered_by           UUID,
  updated_by           UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (supplier_confirmed IS DISTINCT FROM 'oui' OR supplier_confirmed_on IS NOT NULL),
  CHECK (payment_respected IS DISTINCT FROM 'oui' OR payment_respected_on IS NOT NULL)
);
CREATE INDEX landing_booking_confirmations_org_idx ON public.landing_booking_confirmations (organization_id);

-- La ligne appartient à l'entreprise de son dossier ; dates jamais dans le futur ; le dossier ne change jamais.
CREATE FUNCTION public.landing_booking_confirmations_guard() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE lead_org UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT organization_id INTO lead_org FROM public.landing_leads WHERE id = NEW.lead_id;
    IF lead_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'confirmation refusée : le dossier appartient à une autre entreprise';
    END IF;
  ELSIF NEW.lead_id <> OLD.lead_id THEN
    RAISE EXCEPTION 'une confirmation ne change pas de dossier';
  END IF;
  IF NEW.supplier_confirmed_on > CURRENT_DATE + 1 OR NEW.payment_respected_on > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'une date de confirmation ne peut pas être dans le futur';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER landing_booking_confirmations_guard BEFORE INSERT OR UPDATE ON public.landing_booking_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.landing_booking_confirmations_guard();
CREATE TRIGGER landing_org_immutable BEFORE UPDATE OF organization_id ON public.landing_booking_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable();

ALTER TABLE public.landing_booking_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_booking_confirmations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_booking_confirmations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.landing_booking_confirmations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.landing_booking_confirmations TO service_role;  -- jamais de DELETE
CREATE POLICY landing_booking_confirmations_read ON public.landing_booking_confirmations
  FOR SELECT TO authenticated
  USING (public.landing_member_role(organization_id) IN ('admin', 'manager')
         OR (public.landing_member_role(organization_id) = 'employee'
             AND EXISTS (SELECT 1 FROM public.landing_leads l WHERE l.id = lead_id AND l.assigned_to = auth.uid())));

-- ---------- C. Référence justificative de commission (facultative, posée à la seule confirmation) ----------
ALTER TABLE public.landing_commissions
  ADD COLUMN confirmation_ref TEXT CHECK (public.landing_short_note_ok(confirmation_ref));
GRANT UPDATE (confirmation_ref) ON public.landing_commissions TO service_role;

CREATE OR REPLACE FUNCTION public.landing_commissions_guard() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE lead_org UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT organization_id INTO lead_org FROM public.landing_leads WHERE id = NEW.lead_id;
    IF lead_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'commission refusée : le lead appartient à une autre entreprise';
    END IF;
    IF NEW.confirmation_ref IS NOT NULL THEN
      RAISE EXCEPTION 'la référence justificative se pose uniquement lors de la confirmation';
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE
  IF OLD.status <> 'provisoire' OR NEW.status <> 'confirme' THEN
    RAISE EXCEPTION 'seule la confirmation (provisoire vers confirmé) est permise, une seule fois';
  END IF;
  IF (NEW.id, NEW.organization_id, NEW.lead_id, NEW.line_key, NEW.external_ref, NEW.kind, NEW.amount_tnd, NEW.event_date, NEW.source, NEW.import_batch, NEW.created_at, NEW.created_by)
     IS DISTINCT FROM (OLD.id, OLD.organization_id, OLD.lead_id, OLD.line_key, OLD.external_ref, OLD.kind, OLD.amount_tnd, OLD.event_date, OLD.source, OLD.import_batch, OLD.created_at, OLD.created_by) THEN
    RAISE EXCEPTION 'une commission enregistrée ne se modifie pas : ajoutez une ligne d''annulation ou de remboursement';
  END IF;
  RETURN NEW;
END $$;

-- ---------- D. Traçabilité : nouveau type d'historique « confirmation de réservation modifiée » (libellé court, sans texte libre) ----------
ALTER TABLE public.landing_lead_activities DROP CONSTRAINT landing_lead_activities_type_check;
ALTER TABLE public.landing_lead_activities ADD CONSTRAINT landing_lead_activities_type_check
  CHECK (type IN ('created', 'status_change', 'note', 'assignment', 'follow_up', 'marketing_withdrawn', 'anonymized', 'wa_in', 'wa_out',
                  'duplicate_flagged', 'duplicate_confirmed', 'duplicate_rejected', 'duplicate_reopened', 'booking_confirmation_changed'));

COMMIT;
