-- =====================================================================
-- Easy2Book — base DÉDIÉE aux landing pages (projet Supabase séparé)
--
-- ⚠️ À exécuter UNIQUEMENT dans le projet Supabase des landing pages.
--    JAMAIS dans EasyV4 / EasyV4-preview (CRM) : le script s'arrête de
--    lui-même s'il détecte une base EasyV4 ou une table « leads » existante.
--
-- Accès : uniquement l'API Next.js avec la clé service_role (côté serveur).
-- Les rôles publics « anon » et « authenticated » n'ont AUCUN droit.
-- =====================================================================

-- ---------- 0. Garde-fous ----------
DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_leads') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la table landing_leads existe déjà (migration déjà appliquée).';
  END IF;
END $$;

-- ---------- 1. Leads ----------
CREATE TABLE public.landing_leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- jour (heure de Tunis) : sert à l'anti-doublon en base
  lead_day            DATE GENERATED ALWAYS AS ((created_at AT TIME ZONE 'Africa/Tunis')::date) STORED,

  -- identification de la demande
  ref                 TEXT NOT NULL CHECK (ref ~ '^E2B-[A-Z0-9]{6}$'),
  idempotency_key     TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 64),

  -- prospect
  first_name          TEXT NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 100),
  last_name           TEXT CHECK (char_length(last_name) <= 100),
  phone               TEXT NOT NULL CHECK (phone ~ '^[0-9]{9,15}$'),  -- international sans « + »

  -- demande
  product             TEXT NOT NULL CHECK (product IN ('omra', 'voyage', 'hotel', 'autre')),
  offer               TEXT CHECK (char_length(offer) <= 255),
  niche               TEXT CHECK (char_length(niche) <= 64),
  destination         TEXT CHECK (char_length(destination) <= 128),
  travel_date         DATE,
  travel_period       TEXT CHECK (char_length(travel_period) <= 64),
  adults              SMALLINT NOT NULL DEFAULT 1 CHECK (adults BETWEEN 1 AND 50),
  children            SMALLINT NOT NULL DEFAULT 0 CHECK (children BETWEEN 0 AND 20),
  budget              TEXT CHECK (char_length(budget) <= 64),
  trip_type           TEXT CHECK (char_length(trip_type) <= 64),
  message             TEXT CHECK (char_length(message) <= 1000),

  -- consentements (preuve : horodatage = created_at)
  contact_consent     BOOLEAN NOT NULL CHECK (contact_consent),  -- obligatoire pour enregistrer
  marketing_consent   BOOLEAN NOT NULL DEFAULT false,
  tracking_consent    BOOLEAN NOT NULL DEFAULT false,

  -- suivi commercial / validation des réservations
  status              TEXT NOT NULL DEFAULT 'nouveau'
                      CHECK (status IN ('nouveau', 'contacte', 'qualifie', 'reserve', 'perdu')),
  status_updated_at   TIMESTAMPTZ,
  booking_value       NUMERIC(12, 2) CHECK (booking_value >= 0),
  booked_at           TIMESTAMPTZ,
  notes               TEXT CHECK (char_length(notes) <= 2000),

  -- attribution publicitaire (données de campagne, sans identifiant personnel)
  channel             TEXT CHECK (char_length(channel) <= 32),
  utm_source          TEXT CHECK (char_length(utm_source) <= 255),
  utm_medium          TEXT CHECK (char_length(utm_medium) <= 255),
  utm_campaign        TEXT CHECK (char_length(utm_campaign) <= 255),
  utm_content         TEXT CHECK (char_length(utm_content) <= 255),
  utm_term            TEXT CHECK (char_length(utm_term) <= 255),
  campaign_id         TEXT CHECK (char_length(campaign_id) <= 64),
  adset_id            TEXT CHECK (char_length(adset_id) <= 64),
  ad_id               TEXT CHECK (char_length(ad_id) <= 64),
  first_channel       TEXT CHECK (char_length(first_channel) <= 32),
  first_utm_source    TEXT CHECK (char_length(first_utm_source) <= 255),
  first_utm_campaign  TEXT CHECK (char_length(first_utm_campaign) <= 255),
  landing_page        TEXT CHECK (char_length(landing_page) <= 255),

  -- identifiants publicitaires : renseignés UNIQUEMENT si tracking_consent = true
  visitor_id          TEXT CHECK (char_length(visitor_id) <= 64),
  fbclid              TEXT CHECK (char_length(fbclid) <= 500),
  ttclid              TEXT CHECK (char_length(ttclid) <= 500),
  fbp                 TEXT CHECK (char_length(fbp) <= 200),
  fbc                 TEXT CHECK (char_length(fbc) <= 500),
  ttp                 TEXT CHECK (char_length(ttp) <= 200),
  ip                  TEXT CHECK (char_length(ip) <= 64),
  user_agent          TEXT CHECK (char_length(user_agent) <= 500),

  CONSTRAINT landing_leads_ad_ids_need_consent CHECK (
    tracking_consent OR (visitor_id IS NULL AND fbclid IS NULL AND ttclid IS NULL
                         AND fbp IS NULL AND fbc IS NULL AND ttp IS NULL
                         AND ip IS NULL AND user_agent IS NULL)
  ),
  CONSTRAINT landing_leads_booking_consistency CHECK (
    status <> 'reserve' OR booked_at IS NOT NULL
  )
);

-- Anti-doublons garantis par la base
CREATE UNIQUE INDEX landing_leads_idempotency_key_uq ON public.landing_leads (idempotency_key);
CREATE UNIQUE INDEX landing_leads_phone_product_day_uq ON public.landing_leads (phone, product, lead_day);

-- Recherche et analyses
CREATE INDEX landing_leads_created_at_idx ON public.landing_leads (created_at DESC);
CREATE INDEX landing_leads_ref_idx ON public.landing_leads (ref);
CREATE INDEX landing_leads_status_idx ON public.landing_leads (status);
CREATE INDEX landing_leads_campaign_idx ON public.landing_leads (channel, utm_campaign);

COMMENT ON TABLE public.landing_leads IS
  'Leads des landing pages Easy2Book (projet séparé du CRM EasyV4). Écriture via API serveur uniquement.';

-- ---------- 2. Événements (clics WhatsApp, offres consultées) ----------
-- Alimentée uniquement pour les visiteurs ayant accepté les traceurs.
CREATE TABLE public.landing_events (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_name    TEXT NOT NULL CHECK (event_name IN ('Contact', 'ViewContent', 'CategoryView', 'HotelClick')),
  event_id      TEXT NOT NULL CHECK (char_length(event_id) BETWEEN 8 AND 64),
  visitor_id    TEXT CHECK (char_length(visitor_id) <= 64),
  ref           TEXT CHECK (ref ~ '^E2B-[A-Z0-9]{6}$'),
  product       TEXT CHECK (product IN ('omra', 'voyage', 'hotel', 'autre')),
  offer         TEXT CHECK (char_length(offer) <= 255),
  niche         TEXT CHECK (char_length(niche) <= 64),
  location      TEXT CHECK (char_length(location) <= 255),
  channel       TEXT CHECK (char_length(channel) <= 32),
  utm_source    TEXT CHECK (char_length(utm_source) <= 255),
  utm_campaign  TEXT CHECK (char_length(utm_campaign) <= 255),
  utm_content   TEXT CHECK (char_length(utm_content) <= 255),
  ad_id         TEXT CHECK (char_length(ad_id) <= 64)
);

CREATE UNIQUE INDEX landing_events_event_id_uq ON public.landing_events (event_id);
CREATE INDEX landing_events_created_at_idx ON public.landing_events (created_at DESC);
CREATE INDEX landing_events_name_product_idx ON public.landing_events (event_name, product, niche);

COMMENT ON TABLE public.landing_events IS
  'Interactions des visiteurs consentants (Contact = clic WhatsApp), pour tester les niches.';

-- ---------- 3. Sécurité ----------
ALTER TABLE public.landing_leads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_leads  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_events FORCE ROW LEVEL SECURITY;
-- Aucune politique (policy) : anon et authenticated ne voient et n'écrivent rien.
-- service_role (clé serveur) contourne la RLS par conception Supabase.

REVOKE ALL ON public.landing_leads, public.landing_events FROM PUBLIC;
REVOKE ALL ON public.landing_leads, public.landing_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.landing_leads TO service_role;
GRANT SELECT, INSERT ON public.landing_events TO service_role;
-- Pas de DELETE accordé à l'API : la suppression (droit à l'effacement) se fait
-- depuis l'éditeur SQL Supabase par un administrateur.

-- ---------- 4. Vues d'analyse (service_role uniquement) ----------
CREATE VIEW public.landing_campaign_performance WITH (security_invoker = true) AS
SELECT
  COALESCE(channel, 'inconnu')       AS channel,
  COALESCE(utm_campaign, '(aucune)') AS utm_campaign,
  product,
  COUNT(*)                                                             AS leads,
  COUNT(*) FILTER (WHERE status IN ('contacte', 'qualifie', 'reserve')) AS leads_traites,
  COUNT(*) FILTER (WHERE status = 'reserve')                           AS reservations,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'reserve') / NULLIF(COUNT(*), 0), 1) AS taux_conversion_pct,
  COALESCE(SUM(booking_value) FILTER (WHERE status = 'reserve'), 0)    AS chiffre_affaires_tnd
FROM public.landing_leads
GROUP BY 1, 2, 3;

CREATE VIEW public.landing_niche_performance WITH (security_invoker = true) AS
WITH clics AS (
  SELECT product, COALESCE(niche, '(général)') AS niche,
         COUNT(*) AS clics_whatsapp, COUNT(DISTINCT visitor_id) AS visiteurs
  FROM public.landing_events WHERE event_name = 'Contact'
  GROUP BY 1, 2
), l AS (
  SELECT product, COALESCE(niche, '(général)') AS niche,
         COUNT(*) AS leads,
         COUNT(*) FILTER (WHERE status = 'reserve') AS reservations,
         COALESCE(SUM(booking_value) FILTER (WHERE status = 'reserve'), 0) AS chiffre_affaires_tnd
  FROM public.landing_leads GROUP BY 1, 2
)
SELECT
  COALESCE(c.product, l.product) AS product,
  COALESCE(c.niche, l.niche)     AS niche,
  COALESCE(c.clics_whatsapp, 0)  AS clics_whatsapp,
  COALESCE(c.visiteurs, 0)       AS visiteurs_contact,
  COALESCE(l.leads, 0)           AS leads,
  COALESCE(l.reservations, 0)    AS reservations,
  COALESCE(l.chiffre_affaires_tnd, 0) AS chiffre_affaires_tnd
FROM clics c
FULL OUTER JOIN l ON l.product = c.product AND l.niche = c.niche;

REVOKE ALL ON public.landing_campaign_performance, public.landing_niche_performance FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.landing_campaign_performance, public.landing_niche_performance TO service_role;
