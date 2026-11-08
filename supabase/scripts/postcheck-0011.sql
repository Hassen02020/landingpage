-- =====================================================================
-- CONTRÔLE APRÈS la migration 0011 (resserrer) — LECTURE SEULE. Tous les statuts doivent valoir OK.
-- =====================================================================
SELECT n, controle, valeur, attendu, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS statut
FROM (
  SELECT 1 AS n, 'Anciennes unicités globales supprimées (leads, événements)' AS controle,
         (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('landing_leads_idempotency_key_uq', 'landing_leads_phone_product_day_uq', 'landing_events_event_id_uq'))::text AS valeur,
         '0' AS attendu,
         (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('landing_leads_idempotency_key_uq', 'landing_leads_phone_product_day_uq', 'landing_events_event_id_uq')) = 0 AS ok
  UNION ALL
  SELECT 2, 'Anciennes contraintes globales supprimées (blocage, codes promo, catégories, offres)',
         (SELECT count(*) FROM pg_constraint WHERE conname IN ('landing_blocklist_kind_value_key', 'landing_promo_codes_code_key', 'landing_categories_slug_key', 'landing_offers_sku_key'))::text, '0',
         (SELECT count(*) FROM pg_constraint WHERE conname IN ('landing_blocklist_kind_value_key', 'landing_promo_codes_code_key', 'landing_categories_slug_key', 'landing_offers_sku_key')) = 0
  UNION ALL
  SELECT 3, 'La référence E2B-XXXXXX reste unique sur toute la plateforme',
         (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'landing_leads_ref_uq')::text, '1',
         (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'landing_leads_ref_uq') = 1
  UNION ALL
  SELECT 4, 'Clés par organisation : intégrations (organisation, fournisseur) et protection (organisation)',
         (SELECT string_agg(conrelid::regclass::text || ':' || pg_get_constraintdef(oid), ' | ' ORDER BY conrelid::regclass::text) FROM pg_constraint WHERE conname IN ('landing_integrations_pkey', 'landing_protection_pkey')),
         'organization_id',
         (SELECT bool_and(pg_get_constraintdef(oid) LIKE '%organization_id%') AND count(*) = 2 FROM pg_constraint WHERE conname IN ('landing_integrations_pkey', 'landing_protection_pkey'))
  UNION ALL
  SELECT 5, 'Ancienne fonction promo (sans organisation) supprimée ; nouvelle conservée',
         (to_regprocedure('public.landing_redeem_promo(text,text)') IS NULL AND to_regprocedure('public.landing_redeem_promo(text,text,uuid)') IS NOT NULL)::text, 'true',
         to_regprocedure('public.landing_redeem_promo(text,text)') IS NULL AND to_regprocedure('public.landing_redeem_promo(text,text,uuid)') IS NOT NULL
  UNION ALL
  SELECT 6, 'Plus aucune valeur par défaut « Easy2Book » sur organization_id (13 tables)',
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'organization_id' AND column_default IS NOT NULL AND table_name LIKE 'landing\_%')::text, '0',
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'organization_id' AND column_default IS NOT NULL AND table_name LIKE 'landing\_%') = 0
  UNION ALL
  SELECT 7, 'Le garde-fou « pas de 2e organisation » est levé (0011 appliquée)',
         (to_regclass('public.landing_leads_idempotency_key_uq') IS NULL)::text, 'true', to_regclass('public.landing_leads_idempotency_key_uq') IS NULL
) c
ORDER BY n;
