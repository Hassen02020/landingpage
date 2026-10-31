-- =====================================================================
-- Easy2Book — base leads & événements des landing pages
-- À exécuter dans Supabase > SQL Editor. Le script est ré-exécutable :
-- il crée les tables si besoin et ajoute les colonnes manquantes.
-- =====================================================================

-- ---------- LEADS ----------
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  destination TEXT,
  travel_date DATE,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  trip_type TEXT,
  budget TEXT,
  source TEXT DEFAULT 'landing_easy2book',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE leads
  -- demande
  ADD COLUMN IF NOT EXISTS ref TEXT,
  ADD COLUMN IF NOT EXISTS product TEXT,            -- omra | voyage | hotel | autre
  ADD COLUMN IF NOT EXISTS offer TEXT,              -- package / voyage / hôtel choisi
  ADD COLUMN IF NOT EXISTS niche TEXT,              -- ex. enfant-gratuit, voyage-noces, mawlid…
  ADD COLUMN IF NOT EXISTS travel_period TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS consent BOOLEAN DEFAULT false,
  -- suivi commercial / validation des réservations
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'nouveau',
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS booking_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS booked_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  -- attribution publicitaire
  ADD COLUMN IF NOT EXISTS channel TEXT,            -- meta | tiktok | whatsapp | google | organic | referral | direct
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS ad_id TEXT,
  ADD COLUMN IF NOT EXISTS adset_id TEXT,
  ADD COLUMN IF NOT EXISTS campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS fbclid TEXT,
  ADD COLUMN IF NOT EXISTS ttclid TEXT,
  ADD COLUMN IF NOT EXISTS gclid TEXT,
  ADD COLUMN IF NOT EXISTS first_channel TEXT,
  ADD COLUMN IF NOT EXISTS first_utm_source TEXT,
  ADD COLUMN IF NOT EXISTS first_utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS landing_page TEXT,
  ADD COLUMN IF NOT EXISTS page_url TEXT,
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  -- identifiants techniques (rapprochement Meta / TikTok)
  ADD COLUMN IF NOT EXISTS visitor_id TEXT,
  ADD COLUMN IF NOT EXISTS fbp TEXT,
  ADD COLUMN IF NOT EXISTS fbc TEXT,
  ADD COLUMN IF NOT EXISTS ttp TEXT,
  ADD COLUMN IF NOT EXISTS meta_event_id TEXT,
  ADD COLUMN IF NOT EXISTS ip TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

DO $$ BEGIN
  ALTER TABLE leads ADD CONSTRAINT leads_status_check
    CHECK (status IN ('nouveau', 'contacte', 'qualifie', 'reserve', 'perdu'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_ref ON leads(ref);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(channel, utm_campaign);

COMMENT ON TABLE leads IS 'Leads des landing pages Easy2Book (omra, voyages organisés, promos hôtels)';

-- ---------- ÉVÉNEMENTS (clics WhatsApp, offres consultées) ----------
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  event_name TEXT NOT NULL,
  event_id TEXT,
  visitor_id TEXT,
  ref TEXT,
  product TEXT,
  offer TEXT,
  niche TEXT,
  location TEXT,
  channel TEXT,
  utm_source TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  ad_id TEXT,
  page_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_ref ON events(ref);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(event_name);

COMMENT ON TABLE events IS 'Interactions des visiteurs (Contact = clic WhatsApp) pour tester les niches';

-- ---------- SÉCURITÉ ----------
-- Les écritures passent uniquement par l'API Next.js (clé service_role côté serveur).
-- Aucune politique "anon" : la clé publique ne permet ni de lire ni d'écrire les leads.
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert leads" ON leads;
DROP POLICY IF EXISTS "Allow read leads" ON leads;
DROP POLICY IF EXISTS "Team read leads" ON leads;
CREATE POLICY "Team read leads" ON leads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Team read events" ON events;
CREATE POLICY "Team read events" ON events FOR SELECT TO authenticated USING (true);

-- ---------- VUES D'ANALYSE ----------
-- Performance par campagne : leads → réservations → chiffre d'affaires
CREATE OR REPLACE VIEW campaign_performance WITH (security_invoker = true) AS
SELECT
  COALESCE(channel, 'inconnu')       AS channel,
  COALESCE(utm_campaign, '(aucune)') AS utm_campaign,
  product,
  COUNT(*)                                          AS leads,
  COUNT(*) FILTER (WHERE status IN ('contacte','qualifie','reserve')) AS leads_traites,
  COUNT(*) FILTER (WHERE status = 'reserve')        AS reservations,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'reserve') / NULLIF(COUNT(*), 0), 1) AS taux_conversion_pct,
  COALESCE(SUM(booking_value) FILTER (WHERE status = 'reserve'), 0) AS chiffre_affaires_tnd,
  MIN(created_at) AS premier_lead,
  MAX(created_at) AS dernier_lead
FROM leads
GROUP BY 1, 2, 3;

-- Test des niches : clics WhatsApp + leads + réservations par produit / niche
CREATE OR REPLACE VIEW niche_performance WITH (security_invoker = true) AS
WITH clics AS (
  SELECT product, COALESCE(niche, '(général)') AS niche, COUNT(*) AS clics_whatsapp, COUNT(DISTINCT visitor_id) AS visiteurs
  FROM events WHERE event_name = 'Contact'
  GROUP BY 1, 2
), l AS (
  SELECT product, COALESCE(niche, '(général)') AS niche,
         COUNT(*) AS leads,
         COUNT(*) FILTER (WHERE status = 'reserve') AS reservations,
         COALESCE(SUM(booking_value) FILTER (WHERE status = 'reserve'), 0) AS chiffre_affaires_tnd
  FROM leads GROUP BY 1, 2
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
