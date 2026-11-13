-- =====================================================================
-- Easy2Book landing — 0017 : coûts variables (marge nette réellement conservée)
--   • landing_variable_costs : coûts variables AUTRES que la publicité (frais de paiement, prime du conseiller, messagerie,
--     geste commercial, autre). À AJOUT SEUL : une erreur se corrige par une annulation (montant négatif, voids_id).
--   • Anti double comptage : un coût est rattaché soit à UNE RÉSERVATION (lead_id), soit à UNE CAMPAGNE (réseau + campagne),
--     soit à rien (« non attribué ») — jamais à deux à la fois (contrainte). La publicité n'est pas une catégorie (elle a sa
--     table landing_ad_spend) et le remboursement client non plus : il passe par le registre des commissions (ligne négative,
--     déjà déduite de la commission nette). Seul le « geste commercial » hors commission se saisit ici.
-- Cloisonné par entreprise ; serveur seulement. À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0016. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0017_rollback.sql (refusé si des données existent). Contrôle : supabase/scripts/postcheck-0017.sql.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_ad_spend') IS NULL OR to_regclass('public.landing_commissions') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0016 (0016_ad_economics.sql).';
  END IF;
  IF to_regclass('public.landing_variable_costs') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0017 a déjà été appliquée.';
  END IF;
END $$;

CREATE TABLE public.landing_variable_costs (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  cost_date       DATE NOT NULL CHECK (cost_date BETWEEN DATE '2020-01-01' AND DATE '2100-12-31'),
  category        TEXT NOT NULL CHECK (category IN ('frais_paiement', 'prime_conseiller', 'messagerie', 'geste_commercial', 'autre')),
  amount_tnd      NUMERIC(12, 3) NOT NULL CHECK (amount_tnd <> 0 AND abs(amount_tnd) <= 100000000),
  -- rattachement : une réservation OU une campagne OU rien
  lead_id         UUID REFERENCES public.landing_leads (id) ON DELETE RESTRICT,
  network         TEXT CHECK (network IN ('meta', 'tiktok')),
  campaign        TEXT CHECK (char_length(btrim(campaign)) BETWEEN 1 AND 255),
  campaign_key    TEXT GENERATED ALWAYS AS (lower(regexp_replace(btrim(campaign), '\s+', ' ', 'g'))) STORED,
  voids_id        BIGINT REFERENCES public.landing_variable_costs (id) ON DELETE RESTRICT,
  reference       TEXT CHECK (char_length(reference) <= 200),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  CHECK ((voids_id IS NULL AND amount_tnd > 0) OR (voids_id IS NOT NULL AND amount_tnd < 0)),
  CHECK ((network IS NULL) = (campaign IS NULL)),
  CHECK (lead_id IS NULL OR network IS NULL)   -- jamais réservation ET campagne : sinon double comptage
);
CREATE UNIQUE INDEX landing_variable_costs_voids_uq ON public.landing_variable_costs (voids_id) WHERE voids_id IS NOT NULL;
CREATE INDEX landing_variable_costs_org_date_idx ON public.landing_variable_costs (organization_id, cost_date);
CREATE INDEX landing_variable_costs_org_lead_idx ON public.landing_variable_costs (organization_id, lead_id) WHERE lead_id IS NOT NULL;

CREATE FUNCTION public.landing_variable_costs_guard() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE o public.landing_variable_costs%ROWTYPE; lead_org UUID;
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    SELECT organization_id INTO lead_org FROM public.landing_leads WHERE id = NEW.lead_id;
    IF lead_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'coût refusé : la réservation appartient à une autre entreprise';
    END IF;
  END IF;
  IF NEW.voids_id IS NOT NULL THEN
    SELECT * INTO o FROM public.landing_variable_costs WHERE id = NEW.voids_id;
    IF NOT FOUND OR o.voids_id IS NOT NULL THEN
      RAISE EXCEPTION 'annulation invalide : le coût à annuler est introuvable ou est lui-même une annulation';
    END IF;
    IF o.organization_id <> NEW.organization_id OR o.category <> NEW.category OR o.cost_date <> NEW.cost_date OR o.amount_tnd <> -NEW.amount_tnd
       OR o.lead_id IS DISTINCT FROM NEW.lead_id OR o.network IS DISTINCT FROM NEW.network
       OR o.campaign_key IS DISTINCT FROM lower(regexp_replace(btrim(NEW.campaign), '\s+', ' ', 'g')) THEN
      RAISE EXCEPTION 'annulation invalide : elle doit reprendre exactement le coût annulé (rattachement, catégorie, date, montant opposé)';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_variable_costs_guard BEFORE INSERT ON public.landing_variable_costs
  FOR EACH ROW EXECUTE FUNCTION public.landing_variable_costs_guard();

ALTER TABLE public.landing_variable_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_variable_costs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_variable_costs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.landing_variable_costs TO service_role;
CREATE TRIGGER landing_org_immutable BEFORE UPDATE OF organization_id ON public.landing_variable_costs
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable();

COMMIT;
