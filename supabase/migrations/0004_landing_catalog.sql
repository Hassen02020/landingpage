-- =====================================================================
-- Easy2Book landing — 0004 : catalogue d'offres et catégories gérés depuis /admin
-- (départs, prix, coût, places, visibilité, bannières, SEO) + médias.
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0001, 0002 et 0003.
-- =====================================================================

-- ---------- 0. Garde-fous ----------
DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_promo_codes') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0001, 0002 puis 0003_landing_admin.sql.';
  END IF;
  IF to_regclass('public.landing_offers') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0004 a déjà été appliquée.';
  END IF;
END $$;

-- ---------- 1. Catégories (une catégorie = une page publique /c/<slug>) ----------
CREATE TABLE public.landing_categories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 60),
  name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  product           TEXT NOT NULL CHECK (product IN ('omra', 'voyage', 'hotel', 'autre')),
  lang              TEXT NOT NULL DEFAULT 'fr' CHECK (lang IN ('fr', 'ar')),
  headline          TEXT CHECK (char_length(headline) <= 160),
  description       TEXT CHECK (char_length(description) <= 2000),
  banner_desktop    TEXT CHECK (banner_desktop ~ '^(https://|/)[^\s"''<>]+$' AND char_length(banner_desktop) <= 500),
  banner_mobile     TEXT CHECK (banner_mobile ~ '^(https://|/)[^\s"''<>]+$' AND char_length(banner_mobile) <= 500),
  seo_title         TEXT CHECK (char_length(seo_title) <= 70),
  seo_description   TEXT CHECK (char_length(seo_description) <= 160),
  visible           BOOLEAN NOT NULL DEFAULT false,
  position          INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID REFERENCES public.landing_staff (user_id) ON DELETE SET NULL
);

-- ---------- 2. Offres (un départ / un forfait) ----------
CREATE TABLE public.landing_offers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      UUID REFERENCES public.landing_categories (id) ON DELETE SET NULL,
  product          TEXT NOT NULL CHECK (product IN ('omra', 'voyage', 'hotel', 'autre')),
  name             TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  sku              TEXT UNIQUE CHECK (sku ~ '^[A-Z0-9-]{3,32}$'),
  tag              TEXT CHECK (char_length(tag) <= 40),
  destination      TEXT CHECK (char_length(destination) <= 120),
  departure_date   DATE,
  nights           INTEGER CHECK (nights BETWEEN 0 AND 120),
  nights_detail    TEXT CHECK (char_length(nights_detail) <= 160),       -- ex. « 10 بمكة + 4 بالمدينة »
  price            NUMERIC(10, 2) NOT NULL CHECK (price >= 0),           -- prix de vente / personne (TND)
  price_before     NUMERIC(10, 2) CHECK (price_before >= 0),             -- prix barré (avant remise)
  cost             NUMERIC(10, 2) CHECK (cost >= 0),                     -- coût / personne : JAMAIS affiché au public
  seats_total      INTEGER CHECK (seats_total >= 0),                     -- vide = places non suivies
  seats_sold       INTEGER NOT NULL DEFAULT 0 CHECK (seats_sold >= 0),
  features         TEXT[] NOT NULL DEFAULT '{}' CHECK (coalesce(array_length(features, 1), 0) <= 20),
  description      TEXT CHECK (char_length(description) <= 4000),
  image_url        TEXT CHECK (image_url ~ '^(https://|/)[^\s"''<>]+$' AND char_length(image_url) <= 500),
  visible          BOOLEAN NOT NULL DEFAULT false,
  position         INTEGER NOT NULL DEFAULT 0,
  archived_at      TIMESTAMPTZ,                                          -- « supprimée » (récupérable)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by       UUID REFERENCES public.landing_staff (user_id) ON DELETE SET NULL,
  CHECK (seats_total IS NULL OR seats_sold <= seats_total)
);
CREATE INDEX landing_offers_category_idx ON public.landing_offers (category_id, position);
CREATE INDEX landing_offers_product_idx ON public.landing_offers (product, departure_date);

-- Lien lead → offre (statistiques de marge, places réservées dans le CRM)
ALTER TABLE public.landing_leads ADD COLUMN offer_id UUID REFERENCES public.landing_offers (id) ON DELETE SET NULL;
CREATE INDEX landing_leads_offer_idx ON public.landing_leads (offer_id);

-- ---------- 3. Contenu initial : catégorie Omra + les 3 départs actuellement en ligne ----------
WITH cat AS (
  INSERT INTO public.landing_categories (slug, name, product, lang, headline, seo_title, seo_description, visible, position)
  VALUES ('omra-2027', 'عمرة رمضان وشوال 2027', 'omra', 'ar', '3 أفواج: طيران + تأشيرة + فندق قريب من الحرم + مرافقة نسائية',
          'عمرة رمضان وشوال 2027 — Easy2Book', 'عمرة 2027 ابتداءً من 4800 د.ت: طيران، تأشيرة، فندق قريب من الحرم، مرافقة نسائية.', true, 0)
  RETURNING id
)
INSERT INTO public.landing_offers (category_id, product, name, sku, tag, departure_date, nights, nights_detail, price, visible, position, features)
SELECT cat.id, 'omra', v.name, v.sku, v.tag, v.d::date, v.n, v.detail, v.price, true, v.pos, ARRAY[
  'تذكرة الطائرة ذهاباً وإياباً', 'تأشيرة العمرة + التأمين الصحي', 'فندق أرائك غزة ⭐⭐⭐ قريب من الحرم', 'دخول مباشر لمكة لأداء العمرة',
  'التنقلات بحافلات سياحية مريحة', 'زيارة المزارات في مكة والمدينة', 'مرافقون ذوو خبرة + مرافقة نسائية', 'هدايا للمعتمرين']
FROM cat, (VALUES
  ('الفوج الأول',  'OMRA-2701', '✈️ أول فوج',        '2027-01-27', 14, '10 بمكة + 4 بالمدينة', 5500, 1),
  ('الفوج الثاني', 'OMRA-1802', '⭐ الإقامة الأطول',  '2027-02-18', 25, '20 بمكة + 5 بالمدينة', 7800, 2),
  ('عمرة شوال',    'OMRA-1503', '🕌 السعر الأقل',     '2027-03-15', 14, '10 بمكة + 4 بالمدينة', 4800, 3)
) AS v(name, sku, tag, d, n, detail, price, pos);

-- ---------- 4. Médias (images d'offres et bannières) ----------
-- Dossier public en lecture (images affichées sur le site), écriture par le serveur uniquement.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('landing-media', 'landing-media', true, 4194304, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ---------- 5. Sécurité ----------
ALTER TABLE public.landing_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landing_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_offers FORCE ROW LEVEL SECURITY;

-- Lecture et écriture par le serveur du site uniquement (le coût ne doit jamais sortir).
REVOKE ALL ON public.landing_categories, public.landing_offers FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.landing_categories, public.landing_offers TO service_role;
