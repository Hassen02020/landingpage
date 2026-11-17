-- =====================================================================
-- Easy2Book landing — 0028 : JOURNAL ET RELANCE DES CONVERSIONS ENVOYÉES À META (Lead, QualifiedLead, Purchase)
--   • landing_conversion_log : une ligne par conversion (réseau + identifiant d'évènement), avec son ÉTAT (pending / sent / failed / skipped / expired),
--     le nombre de tentatives, la prochaine tentative et la raison technique de l'échec.
--   • Sert à (1) prouver ce qui a été envoyé, (2) RELANCER une conversion perdue parce que Meta était indisponible (sans relance, une vente non
--     transmise ne l'est jamais : la date de réservation est posée une seule fois), (3) ne jamais envoyer deux fois le même évènement (unicité).
--   • AUCUNE donnée personnelle : ni nom, ni téléphone, ni e-mail, ni identifiant publicitaire. La charge utile est reconstruite à la relance depuis le lead.
--   • Cloisonné par entreprise (organization_id), accessible au serveur seulement. UPDATE autorisé (changement d'état), jamais DELETE.
-- Prérequis : 0001 à 0026 (indépendante de 0027, tranche d'âge). À exécuter UNIQUEMENT dans le projet Supabase des landing pages. JAMAIS dans EasyV4.
-- Le code fonctionne AVANT cette migration (aucun journal, comportement actuel) : ordre conseillé = migration, puis déploiement.
-- Retour arrière : supabase/rollback/0028_rollback.sql (refusé si le journal contient des lignes). Contrôle : supabase/scripts/postcheck-0028.sql.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_leads' AND column_name = 'is_test') THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0001 à 0026.';
  END IF;
  IF to_regclass('public.landing_conversion_log') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0028 a déjà été appliquée.';
  END IF;
END $$;

CREATE TABLE public.landing_conversion_log (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  lead_id         UUID REFERENCES public.landing_leads (id) ON DELETE SET NULL,
  network         TEXT NOT NULL CHECK (network IN ('meta')),
  event_name      TEXT NOT NULL CHECK (event_name IN ('Lead', 'QualifiedLead', 'Purchase')),
  event_id        TEXT NOT NULL CHECK (char_length(event_id) BETWEEN 8 AND 80),
  event_time      BIGINT NOT NULL CHECK (event_time > 0),                       -- secondes Unix : l'heure RÉELLE de l'évènement, conservée pour la relance
  value_tnd       NUMERIC(12, 3) CHECK (value_tnd >= 0),                        -- montant de la vente (Purchase seulement)
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped', 'expired')),
  attempts        INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  last_error      TEXT CHECK (char_length(last_error) <= 200),                  -- raison technique (jamais de donnée personnelle ni de jeton)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  next_retry_at   TIMESTAMPTZ,
  CONSTRAINT landing_conversion_log_event_uq UNIQUE (organization_id, network, event_id)
);
CREATE INDEX landing_conversion_log_retry_idx ON public.landing_conversion_log (status, next_retry_at) WHERE status IN ('pending', 'failed');
CREATE INDEX landing_conversion_log_lead_idx ON public.landing_conversion_log (lead_id);

ALTER TABLE public.landing_conversion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_conversion_log FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.landing_conversion_log FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.landing_conversion_log TO service_role;   -- changement d'état autorisé ; jamais de DELETE

CREATE TRIGGER landing_org_immutable BEFORE UPDATE OF organization_id ON public.landing_conversion_log
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable();

COMMENT ON TABLE public.landing_conversion_log IS 'Journal des conversions envoyées à Meta : preuve, relance, unicité. Aucune donnée personnelle.';

COMMIT;
