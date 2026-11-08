-- =====================================================================
-- RETOUR ARRIÈRE de 0011 : rétablit les unicités GLOBALES, l'ancienne fonction promo et les valeurs par défaut Easy2Book.
-- Refusé dès qu'il existe plus d'une organisation (des données de plusieurs entreprises ne tiendraient pas sous des unicités globales).
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_leads_idempotency_key_uq') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0011 n''est pas appliquée (rien à annuler).';
  END IF;
  IF (SELECT count(*) FROM public.organizations) > 1 THEN
    RAISE EXCEPTION 'ARRÊT : plusieurs organisations existent : des unicités globales les feraient entrer en conflit. Retour arrière interdit.';
  END IF;
END $$;

CREATE UNIQUE INDEX landing_leads_idempotency_key_uq ON public.landing_leads (idempotency_key);
CREATE UNIQUE INDEX landing_leads_phone_product_day_uq ON public.landing_leads (phone, product, lead_day);
CREATE UNIQUE INDEX landing_events_event_id_uq ON public.landing_events (event_id);
ALTER TABLE public.landing_blocklist ADD CONSTRAINT landing_blocklist_kind_value_key UNIQUE (kind, value);
ALTER TABLE public.landing_promo_codes ADD CONSTRAINT landing_promo_codes_code_key UNIQUE (code);
ALTER TABLE public.landing_categories ADD CONSTRAINT landing_categories_slug_key UNIQUE (slug);
ALTER TABLE public.landing_offers ADD CONSTRAINT landing_offers_sku_key UNIQUE (sku);

ALTER TABLE public.landing_integrations DROP CONSTRAINT landing_integrations_pkey;
CREATE UNIQUE INDEX landing_integrations_org_provider_uq ON public.landing_integrations (organization_id, provider);
ALTER TABLE public.landing_integrations ADD CONSTRAINT landing_integrations_pkey PRIMARY KEY (provider);

ALTER TABLE public.landing_protection DROP CONSTRAINT landing_protection_pkey;
CREATE UNIQUE INDEX landing_protection_org_uq ON public.landing_protection (organization_id);
ALTER TABLE public.landing_protection ADD CONSTRAINT landing_protection_pkey PRIMARY KEY (id);
ALTER TABLE public.landing_protection ADD CONSTRAINT landing_protection_id_check CHECK (id = 1);

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
REVOKE ALL ON FUNCTION public.landing_redeem_promo(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_redeem_promo(TEXT, TEXT) TO service_role;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'landing_leads', 'landing_events', 'landing_lead_activities', 'landing_staff',
    'landing_integrations', 'landing_integration_changes', 'landing_admin_log',
    'landing_protection', 'landing_blocklist', 'landing_categories', 'landing_offers',
    'landing_promo_codes', 'landing_message_templates'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET DEFAULT %L', t, '00000000-0000-4000-8000-0000000e2b01');
  END LOOP;
END $$;

COMMIT;
