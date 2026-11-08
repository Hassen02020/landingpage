-- =====================================================================
-- CONTRÔLE APRÈS la migration 0010 (élargir) — LECTURE SEULE. Tous les statuts doivent valoir OK.
-- =====================================================================
SELECT n, controle, valeur, attendu, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS statut
FROM (
  SELECT 1 AS n, 'Unicités par organisation créées (9 index)' AS controle,
         (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('landing_leads_org_idempotency_uq', 'landing_leads_org_phone_product_day_uq', 'landing_events_org_event_id_uq', 'landing_integrations_org_provider_uq', 'landing_blocklist_org_kind_value_uq', 'landing_protection_org_uq', 'landing_promo_codes_org_code_uq', 'landing_categories_org_slug_uq', 'landing_offers_org_sku_uq'))::text AS valeur,
         '9' AS attendu,
         (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('landing_leads_org_idempotency_uq', 'landing_leads_org_phone_product_day_uq', 'landing_events_org_event_id_uq', 'landing_integrations_org_provider_uq', 'landing_blocklist_org_kind_value_uq', 'landing_protection_org_uq', 'landing_promo_codes_org_code_uq', 'landing_categories_org_slug_uq', 'landing_offers_org_sku_uq')) = 9 AS ok
  UNION ALL
  SELECT 2, 'Nouvelle fonction promo à 3 arguments présente',
         (to_regprocedure('public.landing_redeem_promo(text,text,uuid)') IS NOT NULL)::text, 'true', to_regprocedure('public.landing_redeem_promo(text,text,uuid)') IS NOT NULL
  UNION ALL
  SELECT 3, 'Ancienne fonction promo conservée (compatibilité avec le site actuel)',
         (to_regprocedure('public.landing_redeem_promo(text,text)') IS NOT NULL)::text, 'true', to_regprocedure('public.landing_redeem_promo(text,text)') IS NOT NULL
  UNION ALL
  SELECT 4, 'Anciennes unicités globales conservées (leads, événements)',
         (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('landing_leads_idempotency_key_uq', 'landing_leads_phone_product_day_uq', 'landing_events_event_id_uq'))::text, '3',
         (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('landing_leads_idempotency_key_uq', 'landing_leads_phone_product_day_uq', 'landing_events_event_id_uq')) = 3
  UNION ALL
  SELECT 5, 'Vues de performance : colonne organization_id présente (2 vues)',
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('landing_campaign_performance', 'landing_niche_performance') AND column_name = 'organization_id')::text, '2',
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('landing_campaign_performance', 'landing_niche_performance') AND column_name = 'organization_id') = 2
  UNION ALL
  SELECT 6, 'Garde-fou « pas de 2e organisation avant 0011 » actif',
         (SELECT count(*) FROM pg_trigger WHERE tgname = 'landing_organizations_guard' AND NOT tgisinternal)::text, '1',
         (SELECT count(*) FROM pg_trigger WHERE tgname = 'landing_organizations_guard' AND NOT tgisinternal) = 1
  UNION ALL
  SELECT 7, 'Fonction promo à 3 arguments : aucun accès pour anon ni les comptes connectés',
         CASE WHEN to_regprocedure('public.landing_redeem_promo(text,text,uuid)') IS NULL THEN 'fonction absente'
              ELSE (SELECT count(*) FROM (VALUES ('anon'), ('authenticated')) r(role) WHERE has_function_privilege(r.role, 'public.landing_redeem_promo(text,text,uuid)', 'EXECUTE'))::text END, '0',
         CASE WHEN to_regprocedure('public.landing_redeem_promo(text,text,uuid)') IS NULL THEN false
              ELSE (SELECT count(*) FROM (VALUES ('anon'), ('authenticated')) r(role) WHERE has_function_privilege(r.role, 'public.landing_redeem_promo(text,text,uuid)', 'EXECUTE')) = 0 END
) c
ORDER BY n;
