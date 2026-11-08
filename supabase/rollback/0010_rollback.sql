-- =====================================================================
-- RETOUR ARRIÈRE de 0010 : retire les unicités par organisation, la fonction promo à 3 arguments, la colonne organization_id des vues
-- et le garde-fou. Refusé si 0011 est appliquée (annuler d'abord 0011) ou s'il existe plus d'une organisation.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_leads_org_idempotency_uq') IS NULL AND to_regclass('public.landing_leads_idempotency_key_uq') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0010 n''est pas appliquée (rien à annuler).';
  END IF;
  IF to_regclass('public.landing_leads_idempotency_key_uq') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : 0011 est appliquée : annuler d''abord 0011 (supabase/rollback/0011_rollback.sql).';
  END IF;
  IF (SELECT count(*) FROM public.organizations) > 1 THEN
    RAISE EXCEPTION 'ARRÊT : plusieurs organisations existent. Retour arrière interdit.';
  END IF;
END $$;

DROP TRIGGER landing_organizations_guard ON public.organizations;
DROP FUNCTION public.landing_organizations_guard();
DROP FUNCTION public.landing_redeem_promo(TEXT, TEXT, UUID);

DROP INDEX public.landing_leads_org_idempotency_uq;
DROP INDEX public.landing_leads_org_phone_product_day_uq;
DROP INDEX public.landing_events_org_event_id_uq;
DROP INDEX public.landing_integrations_org_provider_uq;
DROP INDEX public.landing_blocklist_org_kind_value_uq;
DROP INDEX public.landing_protection_org_uq;
DROP INDEX public.landing_promo_codes_org_code_uq;
DROP INDEX public.landing_categories_org_slug_uq;
DROP INDEX public.landing_offers_org_sku_uq;

-- vues d'origine (0007) : une colonne ne se retire pas par CREATE OR REPLACE
DROP VIEW public.landing_campaign_performance;
DROP VIEW public.landing_niche_performance;
CREATE VIEW public.landing_campaign_performance WITH (security_invoker = true) AS
SELECT
  COALESCE(channel, 'inconnu')       AS channel,
  COALESCE(utm_campaign, '(aucune)') AS utm_campaign,
  product,
  COUNT(*)                                                                                                         AS leads,
  COUNT(*) FILTER (WHERE status NOT IN ('nouveau', 'a_contacter'))                                                 AS leads_traites,
  COUNT(*) FILTER (WHERE status IN ('reserve', 'gagne'))                                                           AS reservations,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('reserve', 'gagne')) / NULLIF(COUNT(*), 0), 1)                   AS taux_conversion_pct,
  COALESCE(SUM(booking_value) FILTER (WHERE status IN ('reserve', 'gagne')), 0)                                    AS chiffre_affaires_tnd
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
         COUNT(*) FILTER (WHERE status IN ('reserve', 'gagne')) AS reservations,
         COALESCE(SUM(booking_value) FILTER (WHERE status IN ('reserve', 'gagne')), 0) AS chiffre_affaires_tnd
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
GRANT SELECT ON public.landing_campaign_performance, public.landing_niche_performance TO service_role;

COMMIT;
