-- =====================================================================
-- Easy2Book landing — 0003 : intégrations publicitaires gérées depuis /admin
-- (Meta Pixel + API Conversions, TikTok Pixel + Events API) et protection anti-spam
-- des formulaires (numéros / IP bloqués, pays autorisés), codes promo
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0001 et 0002.
--
-- Les jetons d'accès ne sont JAMAIS stockés en clair : le serveur du site les chiffre
-- (AES-256-GCM) avant l'écriture. La base ne contient qu'un texte chiffré + les 4 derniers
-- caractères (pour que l'équipe reconnaisse le jeton enregistré).
-- =====================================================================

-- ---------- 0. Garde-fous ----------
DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_staff') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0001_landing_leads.sql puis 0002_landing_crm.sql.';
  END IF;
  IF to_regclass('public.landing_integrations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0003 a déjà été appliquée.';
  END IF;
END $$;

-- ---------- 1. Réglages par intégration ----------
CREATE TABLE public.landing_integrations (
  provider          TEXT PRIMARY KEY CHECK (provider IN ('meta', 'tiktok')),
  enabled           BOOLEAN NOT NULL DEFAULT false,
  -- identifiant PUBLIC du pixel (visible dans le navigateur des visiteurs de toute façon)
  pixel_id          TEXT CHECK (pixel_id ~ '^[A-Za-z0-9]{5,40}$'),
  -- code de l'onglet « Tester les événements » (facultatif, à vider en production)
  test_event_code   TEXT CHECK (char_length(test_event_code) <= 64),
  -- jeton chiffré par le serveur du site (format v1:iv:tag:données, base64url)
  token_ciphertext  TEXT CHECK (token_ciphertext ~ '^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'),
  token_last4       TEXT CHECK (char_length(token_last4) <= 4),
  -- dernier test de connexion lancé depuis /admin
  last_test_at      TIMESTAMPTZ,
  last_test_ok      BOOLEAN,
  last_test_message TEXT CHECK (char_length(last_test_message) <= 300),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID REFERENCES public.landing_staff (user_id) ON DELETE SET NULL,
  -- un jeton chiffré va toujours avec ses 4 derniers caractères
  CHECK ((token_ciphertext IS NULL) = (token_last4 IS NULL))
);

-- ---------- 2. Journal des modifications (ajout seul, jamais de valeur de jeton) ----------
CREATE TABLE public.landing_integration_changes (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider    TEXT NOT NULL CHECK (provider IN ('meta', 'tiktok')),
  actor_id    UUID REFERENCES public.landing_staff (user_id) ON DELETE SET NULL,
  actor_label TEXT NOT NULL CHECK (char_length(actor_label) <= 320),
  -- ex. « pixel_id, token, enabled » ou « test : ok »
  summary     TEXT NOT NULL CHECK (char_length(summary) <= 300)
);
CREATE INDEX landing_integration_changes_idx ON public.landing_integration_changes (provider, created_at DESC);

CREATE FUNCTION public.landing_integration_changes_immutable() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'landing_integration_changes est en ajout seul';
END $$;
CREATE TRIGGER landing_integration_changes_no_update BEFORE UPDATE OR DELETE ON public.landing_integration_changes
  FOR EACH ROW EXECUTE FUNCTION public.landing_integration_changes_immutable();
CREATE TRIGGER landing_integration_changes_no_truncate BEFORE TRUNCATE ON public.landing_integration_changes
  FOR EACH STATEMENT EXECUTE FUNCTION public.landing_integration_changes_immutable();

-- ---------- 3. Protection des formulaires ----------
-- Liste de blocage : un lead venant d'un numéro ou d'une IP bloqués est refusé par /api/leads.
-- Débloquer = active à false (l'historique du blocage est conservé).
CREATE TABLE public.landing_blocklist (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('phone', 'ip')),
  value       TEXT NOT NULL CHECK (char_length(value) BETWEEN 3 AND 64),
  reason      TEXT CHECK (char_length(reason) <= 200),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES public.landing_staff (user_id) ON DELETE SET NULL,
  actor_label TEXT CHECK (char_length(actor_label) <= 320),
  UNIQUE (kind, value)
);

-- Réglages (une seule ligne) : pays autorisés d'après l'IP du visiteur (vide = tous les pays).
CREATE TABLE public.landing_protection (
  id                 SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  allowed_countries  TEXT[] NOT NULL DEFAULT '{}' CHECK (array_length(allowed_countries, 1) IS NULL OR array_length(allowed_countries, 1) <= 60),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by         UUID REFERENCES public.landing_staff (user_id) ON DELETE SET NULL
);
INSERT INTO public.landing_protection (id) VALUES (1);

-- ---------- 4. Codes promo ----------
-- Saisis dans le formulaire, vérifiés par le serveur, enregistrés sur le lead. La remise est
-- appliquée par l'équipe au moment de la réservation (pas de paiement en ligne).
CREATE TABLE public.landing_promo_codes (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_-]{3,32}$'),
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  discount_type   TEXT NOT NULL CHECK (discount_type IN ('percent', 'amount')),
  discount_value  NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0 AND (discount_type <> 'percent' OR discount_value <= 100)),
  product         TEXT CHECK (product IN ('omra', 'voyage', 'hotel', 'autre')), -- vide = tous les produits
  starts_on       DATE,
  ends_on         DATE,
  max_uses        INTEGER CHECK (max_uses > 0),
  used_count      INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES public.landing_staff (user_id) ON DELETE SET NULL,
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

ALTER TABLE public.landing_leads ADD COLUMN promo_code TEXT CHECK (char_length(promo_code) <= 32);

-- Utilisation atomique d'un code (compteur + limites vérifiés dans la même instruction).
CREATE FUNCTION public.landing_redeem_promo(p_code TEXT, p_product TEXT)
  RETURNS TABLE (code TEXT, title TEXT, discount_type TEXT, discount_value NUMERIC)
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.landing_promo_codes p
     SET used_count = p.used_count + 1, updated_at = now()
   WHERE p.code = upper(p_code) AND p.active
     AND (p.product IS NULL OR p.product = p_product)
     AND (p.starts_on IS NULL OR p.starts_on <= (now() AT TIME ZONE 'Africa/Tunis')::date)
     AND (p.ends_on IS NULL OR p.ends_on >= (now() AT TIME ZONE 'Africa/Tunis')::date)
     AND (p.max_uses IS NULL OR p.used_count < p.max_uses)
  RETURNING p.code, p.title, p.discount_type, p.discount_value
$$;

-- ---------- 5. Sécurité ----------
-- Seul le serveur du site (service_role) lit et écrit ces tables. Aucun accès par l'API
-- Supabase pour les comptes connectés : les écrans /admin passent par le serveur,
-- qui vérifie le rôle « admin » à chaque action.
ALTER TABLE public.landing_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_integrations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landing_integration_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_integration_changes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landing_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_blocklist FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landing_protection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_protection FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landing_promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_promo_codes FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.landing_integrations, public.landing_integration_changes,
              public.landing_blocklist, public.landing_protection, public.landing_promo_codes
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.landing_integration_changes_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_redeem_promo(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_redeem_promo(TEXT, TEXT) TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.landing_integrations TO service_role;
GRANT SELECT, INSERT ON public.landing_integration_changes TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.landing_blocklist TO service_role;
GRANT SELECT, UPDATE ON public.landing_protection TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.landing_promo_codes TO service_role;
