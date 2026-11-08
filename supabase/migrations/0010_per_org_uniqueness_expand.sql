-- =====================================================================
-- Easy2Book landing — 0010 : unicités PAR ORGANISATION — étape 1/2 « ÉLARGIR » (TENANT-UNIQUENESS-04)
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0008 (et 0009). JAMAIS dans EasyV4.
--
-- Méthode « élargir puis resserrer » : AUCUN comportement existant ne change.
--   • les nouvelles unicités par organisation sont AJOUTÉES ; les anciennes (globales) restent en place jusqu'à 0011 ;
--   • une nouvelle fonction landing_redeem_promo(code, produit, organisation) est ajoutée ; l'ancienne reste ;
--   • les vues de performance gagnent une colonne organization_id (en dernière position) ;
--   • un GARDE-FOU interdit de créer une DEUXIÈME organisation tant que 0011 n'est pas appliquée
--     (sinon les anciennes unicités globales ferait entrer les entreprises en conflit et révéleraient l'existence de leurs données).
-- Le site déployé avant ou après 0010 fonctionne (l'ancien code ignore les ajouts). Le code du chantier 04 EXIGE 0010 : appliquer 0010 AVANT de le déployer.
-- Retour arrière : supabase/rollback/0010_rollback.sql. Contrôle : supabase/scripts/postcheck-0010.sql.
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
  IF to_regclass('public.landing_leads_org_idempotency_uq') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0010 a déjà été appliquée.';
  END IF;
END $$;

-- ---------- 1. Unicités par organisation (en plus des unicités globales actuelles) ----------
CREATE UNIQUE INDEX landing_leads_org_idempotency_uq ON public.landing_leads (organization_id, idempotency_key);
CREATE UNIQUE INDEX landing_leads_org_phone_product_day_uq ON public.landing_leads (organization_id, phone, product, lead_day);
-- (la référence E2B-XXXXXX du lead reste UNIQUE SUR TOUTE LA PLATEFORME : elle identifie un lead dans les conversations WhatsApp)
CREATE UNIQUE INDEX landing_events_org_event_id_uq ON public.landing_events (organization_id, event_id);
CREATE UNIQUE INDEX landing_integrations_org_provider_uq ON public.landing_integrations (organization_id, provider);
CREATE UNIQUE INDEX landing_blocklist_org_kind_value_uq ON public.landing_blocklist (organization_id, kind, value);
CREATE UNIQUE INDEX landing_protection_org_uq ON public.landing_protection (organization_id);
CREATE UNIQUE INDEX landing_promo_codes_org_code_uq ON public.landing_promo_codes (organization_id, code);
CREATE UNIQUE INDEX landing_categories_org_slug_uq ON public.landing_categories (organization_id, slug);
CREATE UNIQUE INDEX landing_offers_org_sku_uq ON public.landing_offers (organization_id, sku);

-- ---------- 2. Utilisation d'un code promo, PAR ORGANISATION ----------
CREATE FUNCTION public.landing_redeem_promo(p_code TEXT, p_product TEXT, p_org UUID)
  RETURNS TABLE (code TEXT, title TEXT, discount_type TEXT, discount_value NUMERIC)
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE public.landing_promo_codes p
     SET used_count = p.used_count + 1, updated_at = now()
   WHERE p.organization_id = p_org
     AND p.code = upper(p_code) AND p.active
     AND (p.product IS NULL OR p.product = p_product)
     AND (p.starts_on IS NULL OR p.starts_on <= (now() AT TIME ZONE 'Africa/Tunis')::date)
     AND (p.ends_on IS NULL OR p.ends_on >= (now() AT TIME ZONE 'Africa/Tunis')::date)
     AND (p.max_uses IS NULL OR p.used_count < p.max_uses)
  RETURNING p.code, p.title, p.discount_type, p.discount_value
$$;
REVOKE ALL ON FUNCTION public.landing_redeem_promo(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_redeem_promo(TEXT, TEXT, UUID) TO service_role;

-- ---------- 3. Vues de performance : une ligne par organisation (colonne ajoutée EN DERNIER) ----------
CREATE OR REPLACE VIEW public.landing_campaign_performance WITH (security_invoker = true) AS
SELECT
  COALESCE(channel, 'inconnu')       AS channel,
  COALESCE(utm_campaign, '(aucune)') AS utm_campaign,
  product,
  COUNT(*)                                                                                                         AS leads,
  COUNT(*) FILTER (WHERE status NOT IN ('nouveau', 'a_contacter'))                                                 AS leads_traites,
  COUNT(*) FILTER (WHERE status IN ('reserve', 'gagne'))                                                           AS reservations,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('reserve', 'gagne')) / NULLIF(COUNT(*), 0), 1)                   AS taux_conversion_pct,
  COALESCE(SUM(booking_value) FILTER (WHERE status IN ('reserve', 'gagne')), 0)                                    AS chiffre_affaires_tnd,
  organization_id
FROM public.landing_leads
GROUP BY 1, 2, 3, organization_id;

CREATE OR REPLACE VIEW public.landing_niche_performance WITH (security_invoker = true) AS
WITH clics AS (
  SELECT organization_id, product, COALESCE(niche, '(général)') AS niche,
         COUNT(*) AS clics_whatsapp, COUNT(DISTINCT visitor_id) AS visiteurs
  FROM public.landing_events WHERE event_name = 'Contact'
  GROUP BY 1, 2, 3
), l AS (
  SELECT organization_id, product, COALESCE(niche, '(général)') AS niche,
         COUNT(*) AS leads,
         COUNT(*) FILTER (WHERE status IN ('reserve', 'gagne')) AS reservations,
         COALESCE(SUM(booking_value) FILTER (WHERE status IN ('reserve', 'gagne')), 0) AS chiffre_affaires_tnd
  FROM public.landing_leads GROUP BY 1, 2, 3
)
SELECT
  COALESCE(c.product, l.product) AS product,
  COALESCE(c.niche, l.niche)     AS niche,
  COALESCE(c.clics_whatsapp, 0)  AS clics_whatsapp,
  COALESCE(c.visiteurs, 0)       AS visiteurs_contact,
  COALESCE(l.leads, 0)           AS leads,
  COALESCE(l.reservations, 0)    AS reservations,
  COALESCE(l.chiffre_affaires_tnd, 0) AS chiffre_affaires_tnd,
  COALESCE(c.organization_id, l.organization_id) AS organization_id
FROM clics c
FULL OUTER JOIN l ON l.organization_id = c.organization_id AND l.product = c.product AND l.niche = c.niche;

-- ---------- 4. Garde-fou : pas de deuxième organisation avant 0011 ----------
CREATE FUNCTION public.landing_organizations_guard() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF to_regclass('public.landing_leads_idempotency_key_uq') IS NOT NULL AND (SELECT count(*) FROM public.organizations) >= 1 THEN
    RAISE EXCEPTION 'ARRÊT : appliquer 0011 (unicités par organisation, étape 2/2) avant de créer une deuxième organisation.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_organizations_guard BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.landing_organizations_guard();

COMMIT;
