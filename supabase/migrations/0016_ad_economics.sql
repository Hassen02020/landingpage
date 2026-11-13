-- =====================================================================
-- Easy2Book landing — 0016 : rentabilité publicitaire (dépenses publicitaires + commissions nettes)
--   • landing_ad_spend    : dépenses publicitaires par réseau (meta / tiktok), campagne et date. SAISIE MANUELLE aujourd'hui
--                           (source = 'manuel'), API demain (source = 'api_meta' / 'api_tiktok') sans toucher à l'historique.
--                           À AJOUT SEUL : une erreur se corrige par une écriture d'annulation (montant négatif, voids_id), jamais en modifiant.
--   • landing_commissions : registre à ajout seul des commissions nettes IMPORTÉES depuis EasyV4 (référence financière).
--                           Landing ne se connecte jamais à la base d'EasyV4 : import contrôlé uniquement. Une annulation ou un remboursement
--                           ajoute une ligne négative ; la commission nette d'un dossier = somme de ses lignes. Chaque ligne est
--                           « provisoire » jusqu'à confirmation par un administrateur (provisoire → confirmé, une seule fois).
-- Les deux tables sont cloisonnées par entreprise (organization_id) ; seul le serveur (service_role) y accède, aucun compte
-- d'utilisateur n'a de droit direct (données financières).
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0008. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0016_rollback.sql (refusé si des données existent). Contrôle : supabase/scripts/postcheck-0016.sql.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0008 (0008_multitenant_foundation.sql).';
  END IF;
  IF to_regclass('public.landing_ad_spend') IS NOT NULL OR to_regclass('public.landing_commissions') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0016 a déjà été appliquée.';
  END IF;
END $$;

-- ---------- 1. Dépenses publicitaires (à ajout seul) ----------
CREATE TABLE public.landing_ad_spend (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  spend_date      DATE NOT NULL CHECK (spend_date BETWEEN DATE '2020-01-01' AND DATE '2100-12-31'),
  network         TEXT NOT NULL CHECK (network IN ('meta', 'tiktok')),
  campaign        TEXT NOT NULL CHECK (char_length(btrim(campaign)) BETWEEN 1 AND 255),
  -- nom normalisé (minuscules, espaces simplifiés) : sert à rattacher la dépense aux leads (utm_campaign)
  campaign_key    TEXT GENERATED ALWAYS AS (lower(regexp_replace(btrim(campaign), '\s+', ' ', 'g'))) STORED,
  amount_tnd      NUMERIC(12, 3) NOT NULL CHECK (amount_tnd <> 0 AND abs(amount_tnd) <= 100000000),
  -- écriture d'annulation : pointe la dépense annulée (montant exactement opposé)
  voids_id        BIGINT REFERENCES public.landing_ad_spend (id) ON DELETE RESTRICT,
  reference       TEXT CHECK (char_length(reference) <= 200),
  source          TEXT NOT NULL DEFAULT 'manuel' CHECK (source IN ('manuel', 'api_meta', 'api_tiktok')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  CHECK ((voids_id IS NULL AND amount_tnd > 0) OR (voids_id IS NOT NULL AND amount_tnd < 0))
);
CREATE UNIQUE INDEX landing_ad_spend_voids_uq ON public.landing_ad_spend (voids_id) WHERE voids_id IS NOT NULL;
CREATE INDEX landing_ad_spend_org_date_idx ON public.landing_ad_spend (organization_id, spend_date);
CREATE INDEX landing_ad_spend_org_campaign_idx ON public.landing_ad_spend (organization_id, network, campaign_key);

-- Une annulation reprend EXACTEMENT la dépense annulée (même entreprise, réseau, campagne, date, montant opposé), une seule fois.
CREATE FUNCTION public.landing_ad_spend_check_void() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE o public.landing_ad_spend%ROWTYPE;
BEGIN
  IF NEW.voids_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO o FROM public.landing_ad_spend WHERE id = NEW.voids_id;
  IF NOT FOUND OR o.voids_id IS NOT NULL THEN
    RAISE EXCEPTION 'annulation invalide : la dépense à annuler est introuvable ou est elle-même une annulation';
  END IF;
  IF o.organization_id <> NEW.organization_id OR o.network <> NEW.network OR o.campaign_key <> lower(regexp_replace(btrim(NEW.campaign), '\s+', ' ', 'g'))
     OR o.spend_date <> NEW.spend_date OR o.amount_tnd <> -NEW.amount_tnd THEN
    RAISE EXCEPTION 'annulation invalide : elle doit reprendre exactement la dépense annulée (entreprise, réseau, campagne, date, montant opposé)';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_ad_spend_void BEFORE INSERT ON public.landing_ad_spend
  FOR EACH ROW EXECUTE FUNCTION public.landing_ad_spend_check_void();

-- ---------- 2. Commissions nettes importées d'EasyV4 (registre à ajout seul) ----------
CREATE TABLE public.landing_commissions (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  lead_id         UUID NOT NULL REFERENCES public.landing_leads (id) ON DELETE RESTRICT,
  -- clé d'idempotence : réimporter le même fichier ne crée jamais de doublon (ex. « RES-2041|commission|1 »)
  line_key        TEXT NOT NULL CHECK (char_length(line_key) BETWEEN 3 AND 200),
  -- référence de la réservation chez EasyV4 (référence financière)
  external_ref    TEXT NOT NULL CHECK (char_length(external_ref) BETWEEN 1 AND 100),
  kind            TEXT NOT NULL CHECK (kind IN ('commission', 'annulation', 'remboursement')),
  amount_tnd      NUMERIC(12, 3) NOT NULL CHECK (abs(amount_tnd) <= 100000000
                    AND ((kind = 'commission' AND amount_tnd > 0) OR (kind <> 'commission' AND amount_tnd < 0))),
  status          TEXT NOT NULL DEFAULT 'provisoire' CHECK (status IN ('provisoire', 'confirme')),
  event_date      DATE NOT NULL CHECK (event_date BETWEEN DATE '2020-01-01' AND DATE '2100-12-31'),
  source          TEXT NOT NULL DEFAULT 'import_csv' CHECK (source IN ('import_csv', 'api_easyv4')),
  import_batch    TEXT CHECK (char_length(import_batch) <= 100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID,
  confirmed_at    TIMESTAMPTZ,
  confirmed_by    UUID,
  CHECK ((status = 'confirme') = (confirmed_at IS NOT NULL))
);
CREATE UNIQUE INDEX landing_commissions_org_line_uq ON public.landing_commissions (organization_id, line_key);
CREATE INDEX landing_commissions_org_lead_idx ON public.landing_commissions (organization_id, lead_id);

-- La ligne appartient à l'entreprise de son lead ; seule la confirmation (provisoire → confirmé, une fois) est modifiable.
CREATE FUNCTION public.landing_commissions_guard() RETURNS trigger
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
CREATE TRIGGER landing_commissions_guard BEFORE INSERT OR UPDATE ON public.landing_commissions
  FOR EACH ROW EXECUTE FUNCTION public.landing_commissions_guard();

-- ---------- 3. Droits : serveur seulement, ajout seul ----------
ALTER TABLE public.landing_ad_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_ad_spend FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landing_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_commissions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_ad_spend, public.landing_commissions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.landing_ad_spend TO service_role;
GRANT SELECT, INSERT ON public.landing_commissions TO service_role;
GRANT UPDATE (status, confirmed_at, confirmed_by) ON public.landing_commissions TO service_role;

CREATE TRIGGER landing_org_immutable BEFORE UPDATE OF organization_id ON public.landing_ad_spend
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable();
CREATE TRIGGER landing_org_immutable BEFORE UPDATE OF organization_id ON public.landing_commissions
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable();

COMMIT;
