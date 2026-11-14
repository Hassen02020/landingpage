-- =====================================================================
-- Easy2Book landing — 0020 : HISTORIQUE DES VERSIONS des pages du Créateur (lot C)
--   • landing_page_versions : un instantané (contenu, offres sans coût ni places vendues, personnalisation) à chaque enregistrement,
--     publication, désactivation ou restauration. REGISTRE À AJOUT SEUL : aucune modification ni suppression possible.
--   • aucune page existante n'est modifiée ; aucun lien existant ne change ; seul le serveur (service_role) lit et écrit.
-- Cloisonnement par entreprise (organization_id), sécurité par ligne forcée, comme les autres tables.
-- Prérequis : 0004 et 0008. À exécuter UNIQUEMENT dans le projet Supabase des landing pages. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0020_rollback.sql (refusé si des versions existent). Contrôle : supabase/scripts/postcheck-0020.sql.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_categories') IS NULL OR to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0004 puis 0008.';
  END IF;
  IF to_regclass('public.landing_page_versions') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0020 a déjà été appliquée.';
  END IF;
END $$;

CREATE TABLE public.landing_page_versions (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  category_id     UUID NOT NULL REFERENCES public.landing_categories (id) ON DELETE RESTRICT,
  version_number  INTEGER NOT NULL CHECK (version_number >= 1),
  reason          TEXT NOT NULL CHECK (reason IN ('enregistrement', 'personnalisation', 'publication', 'desactivation', 'restauration')),
  note            TEXT CHECK (char_length(note) <= 200),
  snapshot        JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object' AND octet_length(snapshot::text) <= 100000),
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, version_number)
);
CREATE INDEX landing_page_versions_org_cat_idx ON public.landing_page_versions (organization_id, category_id, version_number DESC);

ALTER TABLE public.landing_page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_page_versions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_page_versions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.landing_page_versions TO service_role;   -- ajout seul : ni UPDATE ni DELETE

-- une version appartient à l'entreprise de sa page
CREATE FUNCTION public.landing_page_versions_check_org() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.landing_categories c WHERE c.id = NEW.category_id AND c.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'version refusée : la page n''appartient pas à cette entreprise';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_page_versions_org BEFORE INSERT ON public.landing_page_versions
  FOR EACH ROW EXECUTE FUNCTION public.landing_page_versions_check_org();

COMMIT;
