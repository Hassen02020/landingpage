-- =====================================================================
-- Easy2Book landing — 0012 : création d'une entreprise par le Super Admin (chantier 05)
-- Deux fonctions SQL, réservées à service_role (le serveur), qui sont le SEUL chemin d'écriture sur `organizations` :
--   landing_create_organization : crée l'organisation ET son premier administrateur en UNE transaction (tout ou rien) ;
--   landing_set_organization_status : suspend / réactive une organisation (l'organisation de la plateforme est protégée).
-- Chaque fonction vérifie que l'acteur est enregistré dans platform_admins et laisse une trace dans organization_audit.
-- service_role n'obtient AUCUN droit d'écriture direct sur les tables d'organisation.
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0008. JAMAIS dans EasyV4.
-- Sans effet tant que personne ne les appelle. Créer une 2e organisation exige en plus 0011 (verrou de 0010).
-- Retour arrière : supabase/rollback/0012_rollback.sql. Contrôle : supabase/scripts/postcheck-0012.sql.
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
  IF to_regprocedure('public.landing_create_organization(text,text,text,uuid,uuid,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0012 a déjà été appliquée.';
  END IF;
END $$;

CREATE FUNCTION public.landing_create_organization(
  p_name TEXT, p_slug TEXT, p_sector TEXT, p_actor UUID,
  p_admin_user UUID, p_admin_email TEXT, p_admin_name TEXT
) RETURNS UUID
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE org UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_actor) THEN
    RAISE EXCEPTION 'Réservé au Super Admin de la plateforme' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_admin_user) THEN
    RAISE EXCEPTION 'Compte du premier administrateur introuvable' USING ERRCODE = '23503';
  END IF;
  -- le Super Admin ne lit aucun lead : son compte ne peut jamais être administrateur d'une entreprise
  IF EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_admin_user) THEN
    RAISE EXCEPTION 'Un compte Super Admin ne peut pas être administrateur d''une entreprise' USING ERRCODE = '42501';
  END IF;
  -- un compte appartient à UNE seule entreprise (pas encore de sélecteur d'organisation)
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = p_admin_user)
     OR EXISTS (SELECT 1 FROM public.landing_staff WHERE user_id = p_admin_user) THEN
    RAISE EXCEPTION 'Ce compte est déjà rattaché à une entreprise' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.organizations (slug, name, sector) VALUES (p_slug, p_name, NULLIF(p_sector, '')) RETURNING id INTO org;
  -- la fiche d'équipe crée le membre (déclencheur de recopie de 0008)
  INSERT INTO public.landing_staff (user_id, email, full_name, role, active, organization_id)
  VALUES (p_admin_user, lower(p_admin_email), NULLIF(p_admin_name, ''), 'admin', true, org);
  INSERT INTO public.organization_audit (organization_id, actor_id, action, details)
  VALUES (org, p_actor, 'organization_provisioned', jsonb_build_object('slug', p_slug, 'first_admin', p_admin_user));
  RETURN org;
END $$;

CREATE FUNCTION public.landing_set_organization_status(p_org UUID, p_status TEXT, p_actor UUID) RETURNS VOID
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE s TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_actor) THEN
    RAISE EXCEPTION 'Réservé au Super Admin de la plateforme' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active', 'suspended') THEN
    RAISE EXCEPTION 'Statut invalide' USING ERRCODE = '22023';
  END IF;
  SELECT slug INTO s FROM public.organizations WHERE id = p_org;
  IF s IS NULL THEN RAISE EXCEPTION 'Organisation introuvable' USING ERRCODE = 'P0002'; END IF;
  IF s = 'easy2book' AND p_status = 'suspended' THEN
    RAISE EXCEPTION 'L''organisation de la plateforme ne peut pas être suspendue' USING ERRCODE = '42501';
  END IF;
  UPDATE public.organizations SET status = p_status, updated_at = now() WHERE id = p_org;
  INSERT INTO public.organization_audit (organization_id, actor_id, action, details)
  VALUES (p_org, p_actor, CASE p_status WHEN 'suspended' THEN 'organization_suspended' ELSE 'organization_reactivated' END, '{}'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.landing_create_organization(text,text,text,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.landing_set_organization_status(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landing_create_organization(text,text,text,uuid,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.landing_set_organization_status(uuid,text,uuid) TO service_role;

COMMIT;
