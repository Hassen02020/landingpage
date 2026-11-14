-- =====================================================================
-- Easy2Book landing — 0025 : avis en étoiles des visiteurs (page /omra)
--   • landing_reviews : une note de 1 à 5, un prénom, un commentaire facultatif, laissés par un visiteur.
--   • AUCUN avis n'est affiché avant validation par l'équipe : statut « pending » par défaut, puis « published » ou « rejected ».
--     La moyenne et le nombre d'avis ne se calculent que sur les avis publiés.
--   • Le visiteur doit accepter la publication de son prénom et de son commentaire (case obligatoire, contrainte en base).
--   • Aucun e-mail, téléphone ni adresse IP n'est conservé. content_hash (empreinte du contenu) sert seulement à refuser un doublon.
--   • Cloisonné par entreprise (organization_id) ; accessible au serveur seulement ; après l'envoi, seul le statut peut changer (droit de modification limité à 3 colonnes).
-- Sans effet sur les tables existantes. À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0008. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0025_rollback.sql (refusé s'il existe des avis). Contrôle : supabase/scripts/postcheck-0025.sql.
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
  IF to_regclass('public.landing_reviews') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0025 a déjà été appliquée.';
  END IF;
END $$;

CREATE TABLE public.landing_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  page_key        TEXT NOT NULL CHECK (page_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(page_key) <= 60),
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  first_name      TEXT NOT NULL CHECK (char_length(first_name) BETWEEN 2 AND 60),
  comment         TEXT CHECK (char_length(comment) <= 600),
  lang            TEXT NOT NULL DEFAULT 'ar' CHECK (lang IN ('fr', 'ar', 'en')),
  publish_consent BOOLEAN NOT NULL CHECK (publish_consent),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  content_hash    TEXT NOT NULL CHECK (char_length(content_hash) = 64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  moderated_at    TIMESTAMPTZ,
  moderated_by    UUID,
  CHECK ((status = 'pending') = (moderated_at IS NULL)),
  UNIQUE (organization_id, page_key, content_hash)
);
CREATE INDEX landing_reviews_list_idx ON public.landing_reviews (organization_id, page_key, status, created_at DESC);

ALTER TABLE public.landing_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_reviews FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_reviews FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.landing_reviews TO service_role;
GRANT UPDATE (status, moderated_at, moderated_by) ON public.landing_reviews TO service_role;   -- la note et le texte ne peuvent plus être modifiés

CREATE TRIGGER landing_org_immutable BEFORE UPDATE OF organization_id ON public.landing_reviews
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable();

COMMIT;
