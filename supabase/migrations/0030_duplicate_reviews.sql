-- =====================================================================
-- Easy2Book landing — 0030 : SIGNALEMENT, CONFIRMATION ET REJET DES DOUBLONS DE DOSSIERS
--   • landing_duplicate_reviews : un signalement = un dossier candidat + son dossier principal, avec statut (signale / confirme / rejete),
--     auteur, date, motif. « Non examiné » n'est pas une ligne : c'est un candidat détecté par calcul, sans signalement.
--   • landing_leads.duplicate_of / duplicate_confirmed_at : renseignés UNIQUEMENT à la confirmation (par déclencheur, de façon atomique) ;
--     servent à exclure les doublons confirmés des ventes, du chiffre d'affaires, de la conversion et de Purchase. Le STATUT du dossier ne change JAMAIS.
--   • Règles imposées par la base (en plus du code) : le signaleur ne confirme jamais son propre signalement (décision D1) ; même entreprise ;
--     même téléphone ; pas de chaîne de doublons ; jamais de DELETE ; seul un signalement « signale » peut être décidé ; une décision se rouvre en « signale ».
--   • Aucune donnée personnelle : seuls des identifiants de dossiers, des catégories et des textes courts (motif, note de décision).
--   • Cloisonné par entreprise (organization_id), accessible au serveur seulement.
-- Prérequis : 0001 à 0029. À exécuter UNIQUEMENT dans le projet Supabase des landing pages. JAMAIS dans EasyV4.
-- Le code fonctionne AVANT cette migration (colonnes absentes tolérées). Ordre conseillé : migration, puis déploiement.
-- Retour arrière : supabase/rollback/0030_rollback.sql (refusé s'il existe des signalements, des doublons confirmés ou des activités de doublon).
-- Contrôle : supabase/scripts/postcheck-0030.sql.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_conversations') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0001 à 0029.';
  END IF;
  IF to_regprocedure('public.landing_org_immutable()') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : fonction landing_org_immutable absente (migration 0008 requise).';
  END IF;
  IF to_regclass('public.landing_duplicate_reviews') IS NOT NULL
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads' AND column_name = 'duplicate_of') THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0030 a déjà été appliquée.';
  END IF;
END $$;

-- ---------- 1. Colonnes sur les dossiers (renseignées à la confirmation seulement) ----------
ALTER TABLE public.landing_leads
  ADD COLUMN duplicate_of UUID REFERENCES public.landing_leads (id) ON DELETE SET NULL,
  ADD COLUMN duplicate_confirmed_at TIMESTAMPTZ,
  ADD CONSTRAINT landing_leads_duplicate_self_ck CHECK (duplicate_of IS NULL OR duplicate_of <> id),
  ADD CONSTRAINT landing_leads_duplicate_pair_ck CHECK ((duplicate_of IS NULL) = (duplicate_confirmed_at IS NULL));
CREATE INDEX landing_leads_duplicate_of_idx ON public.landing_leads (duplicate_of) WHERE duplicate_of IS NOT NULL;

-- Un doublon confirmé : même entreprise, même téléphone, jamais de chaîne (le principal n'est pas un doublon, le candidat n'est pas déjà principal).
CREATE FUNCTION public.landing_dup_lead_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tgt RECORD;
BEGIN
  IF NEW.duplicate_of IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.duplicate_of IS NOT DISTINCT FROM OLD.duplicate_of THEN RETURN NEW; END IF;
  SELECT organization_id, phone, duplicate_of INTO tgt FROM public.landing_leads WHERE id = NEW.duplicate_of;
  IF NOT FOUND THEN RAISE EXCEPTION 'doublon : dossier principal introuvable'; END IF;
  IF tgt.organization_id <> NEW.organization_id THEN RAISE EXCEPTION 'doublon : dossier principal d''une autre entreprise'; END IF;
  IF tgt.duplicate_of IS NOT NULL THEN RAISE EXCEPTION 'doublon : le dossier principal est lui-même un doublon (pas de chaîne)'; END IF;
  IF tgt.phone IS NULL OR NEW.phone IS NULL OR tgt.phone <> NEW.phone THEN RAISE EXCEPTION 'doublon : les deux dossiers doivent avoir le même téléphone'; END IF;
  IF EXISTS (SELECT 1 FROM public.landing_leads WHERE duplicate_of = NEW.id) THEN RAISE EXCEPTION 'doublon : ce dossier est déjà le principal d''un autre doublon (pas de chaîne)'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_dup_lead_guard BEFORE INSERT OR UPDATE OF duplicate_of ON public.landing_leads
  FOR EACH ROW EXECUTE FUNCTION public.landing_dup_lead_guard();

-- ---------- 2. Types d'activité : traçabilité des décisions (liste de 0006 + 4 types) ----------
ALTER TABLE public.landing_lead_activities DROP CONSTRAINT landing_lead_activities_type_check;
ALTER TABLE public.landing_lead_activities ADD CONSTRAINT landing_lead_activities_type_check
  CHECK (type IN ('created', 'status_change', 'note', 'assignment', 'follow_up', 'marketing_withdrawn', 'anonymized', 'wa_in', 'wa_out',
                  'duplicate_flagged', 'duplicate_confirmed', 'duplicate_rejected', 'duplicate_reopened'));

-- ---------- 3. Signalements ----------
CREATE TABLE public.landing_duplicate_reviews (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id  UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  lead_id          UUID NOT NULL REFERENCES public.landing_leads (id) ON DELETE RESTRICT,   -- dossier candidat (le doublon présumé)
  primary_lead_id  UUID NOT NULL REFERENCES public.landing_leads (id) ON DELETE RESTRICT,   -- dossier principal
  rule             TEXT NOT NULL CHECK (rule IN ('technique_15min', 'commerciale_30j', 'reservation', 'manuel')),
  confidence       TEXT NOT NULL CHECK (confidence IN ('elevee', 'faible')),                 -- faible : offre ou départ non comparables
  status           TEXT NOT NULL DEFAULT 'signale' CHECK (status IN ('signale', 'confirme', 'rejete')),
  reason           TEXT CHECK (char_length(reason) <= 200),                                  -- catégorie ou texte court, sans donnée personnelle
  reported_by      UUID NOT NULL,
  reported_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by       UUID,
  decided_at       TIMESTAMPTZ,
  decision_note    TEXT CHECK (char_length(decision_note) <= 300),
  purchase_state   TEXT CHECK (purchase_state IN ('aucun', 'retenu', 'envoye')),            -- état de Purchase du candidat au moment de la décision
  CONSTRAINT landing_dup_reviews_distinct_ck CHECK (lead_id <> primary_lead_id),
  CONSTRAINT landing_dup_reviews_decision_ck CHECK (
    (status = 'signale' AND decided_by IS NULL AND decided_at IS NULL)
    OR (status IN ('confirme', 'rejete') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)),
  CONSTRAINT landing_dup_reviews_four_eyes_ck CHECK (decided_by IS NULL OR decided_by <> reported_by)   -- D1 : jamais son propre signalement
);
CREATE UNIQUE INDEX landing_dup_reviews_active_uq ON public.landing_duplicate_reviews (lead_id) WHERE status IN ('signale', 'confirme');
CREATE INDEX landing_dup_reviews_org_status_idx ON public.landing_duplicate_reviews (organization_id, status);
CREATE INDEX landing_dup_reviews_primary_idx ON public.landing_duplicate_reviews (primary_lead_id);

ALTER TABLE public.landing_duplicate_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_duplicate_reviews FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_duplicate_reviews FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.landing_duplicate_reviews TO service_role;   -- jamais de DELETE

CREATE TRIGGER landing_org_immutable BEFORE UPDATE OF organization_id ON public.landing_duplicate_reviews
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable();

-- À la création : toujours « signale » ; les deux dossiers existent, sont de la même entreprise et du même téléphone ;
-- le principal n'est pas un doublon confirmé ; le candidat n'est pas déjà un doublon confirmé.
CREATE FUNCTION public.landing_dup_review_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cand RECORD; prim RECORD;
BEGIN
  IF NEW.status <> 'signale' THEN RAISE EXCEPTION 'signalement : un signalement naît toujours à l''état « signale »'; END IF;
  SELECT organization_id, phone, duplicate_of INTO cand FROM public.landing_leads WHERE id = NEW.lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'signalement : dossier candidat introuvable'; END IF;
  SELECT organization_id, phone, duplicate_of INTO prim FROM public.landing_leads WHERE id = NEW.primary_lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'signalement : dossier principal introuvable'; END IF;
  IF cand.organization_id <> NEW.organization_id OR prim.organization_id <> NEW.organization_id THEN RAISE EXCEPTION 'signalement : les deux dossiers doivent appartenir à la même entreprise'; END IF;
  IF cand.phone IS NULL OR prim.phone IS NULL OR cand.phone <> prim.phone THEN RAISE EXCEPTION 'signalement : les deux dossiers doivent avoir le même téléphone'; END IF;
  IF prim.duplicate_of IS NOT NULL THEN RAISE EXCEPTION 'signalement : le dossier principal est lui-même un doublon confirmé'; END IF;
  IF cand.duplicate_of IS NOT NULL THEN RAISE EXCEPTION 'signalement : le dossier candidat est déjà un doublon confirmé'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_dup_review_insert_guard BEFORE INSERT ON public.landing_duplicate_reviews
  FOR EACH ROW EXECUTE FUNCTION public.landing_dup_review_insert_guard();

-- À la modification : l'identité du signalement est figée ; transitions autorisées seulement :
-- signale → confirme | rejete (décision) ; confirme | rejete → signale (réouverture). Jamais confirme ↔ rejete directement.
CREATE FUNCTION public.landing_dup_review_update_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lead_id <> OLD.lead_id OR NEW.primary_lead_id <> OLD.primary_lead_id OR NEW.rule <> OLD.rule
     OR NEW.reported_by <> OLD.reported_by OR NEW.reported_at <> OLD.reported_at THEN
    RAISE EXCEPTION 'signalement : l''identité du signalement (dossiers, règle, auteur, date) ne peut pas être modifiée';
  END IF;
  IF NEW.status <> OLD.status AND NOT ((OLD.status = 'signale' AND NEW.status IN ('confirme', 'rejete')) OR (OLD.status IN ('confirme', 'rejete') AND NEW.status = 'signale')) THEN
    RAISE EXCEPTION 'signalement : transition % → % interdite', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_dup_review_update_guard BEFORE UPDATE ON public.landing_duplicate_reviews
  FOR EACH ROW EXECUTE FUNCTION public.landing_dup_review_update_guard();

-- Synchronisation atomique : la confirmation pose duplicate_of sur le dossier candidat ; la réouverture l'efface.
CREATE FUNCTION public.landing_dup_review_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'confirme' AND OLD.status <> 'confirme' THEN
    UPDATE public.landing_leads SET duplicate_of = NEW.primary_lead_id, duplicate_confirmed_at = NEW.decided_at WHERE id = NEW.lead_id;
  ELSIF OLD.status = 'confirme' AND NEW.status <> 'confirme' THEN
    UPDATE public.landing_leads SET duplicate_of = NULL, duplicate_confirmed_at = NULL WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_dup_review_sync AFTER UPDATE OF status ON public.landing_duplicate_reviews
  FOR EACH ROW EXECUTE FUNCTION public.landing_dup_review_sync();

COMMENT ON TABLE public.landing_duplicate_reviews IS 'Signalements de doublons de dossiers : signale / confirme / rejete. Aucune donnée personnelle. Jamais de suppression.';
COMMENT ON COLUMN public.landing_leads.duplicate_of IS 'Dossier principal, renseigné seulement quand le doublon est CONFIRMÉ (le statut du dossier ne change pas).';

COMMIT;
