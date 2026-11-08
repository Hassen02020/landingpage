-- =====================================================================
-- Easy2Book landing — 0013 : rôle MANAGER dans l'équipe (chantier 06)
-- landing_staff.role accepte désormais 'manager' (en plus de 'admin' et 'agent') ; la recopie vers organization_members
-- (déclencheur de 0008) traduit admin → admin, manager → manager, agent → employee.
-- Aucune donnée modifiée. À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0008. JAMAIS dans EasyV4.
-- Retour arrière : supabase/rollback/0013_rollback.sql (refusé s'il existe un manager). Contrôle : supabase/scripts/postcheck-0013.sql.
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.organization_members') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0008 (0008_multitenant_foundation.sql).';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
              WHERE t.relname = 'landing_staff' AND c.contype = 'c' AND pg_get_constraintdef(c.oid) LIKE '%manager%') THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0013 a déjà été appliquée.';
  END IF;
END $$;

-- l'ancienne contrainte (nom automatique, quel qu'il soit) est retrouvée par sa définition
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN SELECT con.conname FROM pg_constraint con JOIN pg_class t ON t.oid = con.conrelid
            WHERE t.relname = 'landing_staff' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%role%' LOOP
    EXECUTE format('ALTER TABLE public.landing_staff DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.landing_staff ADD CONSTRAINT landing_staff_role_check CHECK (role IN ('admin', 'manager', 'agent'));

CREATE OR REPLACE FUNCTION public.landing_staff_mirror_member() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.organization_members SET active = false
     WHERE organization_id = OLD.organization_id AND user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  INSERT INTO public.organization_members (organization_id, user_id, role, active)
  VALUES (NEW.organization_id, NEW.user_id, CASE NEW.role WHEN 'admin' THEN 'admin' WHEN 'manager' THEN 'manager' ELSE 'employee' END, NEW.active)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET active = EXCLUDED.active, role = EXCLUDED.role;
  RETURN NEW;
END $$;

COMMIT;
