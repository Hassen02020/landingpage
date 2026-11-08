-- =====================================================================
-- Easy2Book landing — 0011 : unicités PAR ORGANISATION — étape 2/2 « RESSERRER » (TENANT-UNIQUENESS-04)
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0010 ET APRÈS le déploiement du code du chantier 04
-- (le code doit déjà envoyer organization_id et utiliser les nouvelles cibles de conflit). JAMAIS dans EasyV4.
--
-- Retire ce que 0010 avait conservé pour la compatibilité :
--   • les unicités GLOBALES (clé d'envoi, téléphone + produit + jour, event_id, fournisseur, blocage, protection, code promo, slug, SKU) ;
--   • l'ancienne fonction landing_redeem_promo(code, produit) ;
--   • les valeurs par défaut « Easy2Book » de organization_id : une insertion SANS organisation est désormais REFUSÉE.
-- Après 0011, une deuxième organisation peut être créée (le garde-fou de 0010 se lève). La référence E2B-XXXXXX reste unique sur la plateforme.
-- Retour arrière : supabase/rollback/0011_rollback.sql (refusé dès qu'il existe plus d'une organisation).
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_leads_org_idempotency_uq') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0010 (0010_per_org_uniqueness_expand.sql).';
  END IF;
  IF to_regclass('public.landing_leads_idempotency_key_uq') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0011 a déjà été appliquée.';
  END IF;
END $$;

-- ---------- 1. Unicités globales → par organisation ----------
DROP INDEX public.landing_leads_idempotency_key_uq;
DROP INDEX public.landing_leads_phone_product_day_uq;
DROP INDEX public.landing_events_event_id_uq;
ALTER TABLE public.landing_blocklist DROP CONSTRAINT landing_blocklist_kind_value_key;
ALTER TABLE public.landing_promo_codes DROP CONSTRAINT landing_promo_codes_code_key;
ALTER TABLE public.landing_categories DROP CONSTRAINT landing_categories_slug_key;
ALTER TABLE public.landing_offers DROP CONSTRAINT landing_offers_sku_key;

-- Intégrations : la clé devient (organisation, fournisseur)
ALTER TABLE public.landing_integrations DROP CONSTRAINT landing_integrations_pkey;
ALTER TABLE public.landing_integrations ADD CONSTRAINT landing_integrations_pkey PRIMARY KEY USING INDEX landing_integrations_org_provider_uq;

-- Protection : une ligne PAR ORGANISATION (au lieu d'une ligne unique id = 1)
ALTER TABLE public.landing_protection DROP CONSTRAINT landing_protection_pkey;
ALTER TABLE public.landing_protection DROP CONSTRAINT landing_protection_id_check;
ALTER TABLE public.landing_protection ADD CONSTRAINT landing_protection_pkey PRIMARY KEY USING INDEX landing_protection_org_uq;

-- ---------- 2. Ancienne fonction promo (sans organisation) ----------
DROP FUNCTION public.landing_redeem_promo(TEXT, TEXT);

-- ---------- 3. Fin de la valeur par défaut « Easy2Book » : l'organisation doit être explicite ----------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'landing_leads', 'landing_events', 'landing_lead_activities', 'landing_staff',
    'landing_integrations', 'landing_integration_changes', 'landing_admin_log',
    'landing_protection', 'landing_blocklist', 'landing_categories', 'landing_offers',
    'landing_promo_codes', 'landing_message_templates'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id DROP DEFAULT', t);
  END LOOP;
END $$;

COMMIT;
