-- =====================================================================
-- Easy2Book landing — 0008 : socle MULTI-ENTREPRISES (MULTI-TENANT-FOUNDATION-01)
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0001 à 0007,
-- et APRÈS une sauvegarde (voir docs/MULTI_TENANT.md). JAMAIS dans EasyV4.
--
-- Stratégie PROGRESSIVE (le CRM Easy2Book existant ne doit pas casser) :
--   1. création des organisations, membres, administrateurs plateforme et journal d'audit ;
--   2. création de l'organisation « Easy2Book » et rattachement de TOUTES les données existantes
--      (colonne organization_id NOT NULL avec, pendant la transition, Easy2Book comme valeur par
--      défaut : le code actuel, qui n'envoie pas organization_id, continue de fonctionner) ;
--   3. recopie de l'équipe actuelle (landing_staff) dans organization_members, puis synchronisation
--      automatique tant que l'application écrit encore dans landing_staff ;
--   4. isolation par RLS : un compte connecté ne lit que les données de SON organisation,
--      selon son rôle (admin / manager : tout ; employé : ses leads) ; les administrateurs
--      plateforme voient les organisations, pas les leads.
-- Retour arrière : supabase/rollback/0008_rollback.sql. Super Admin : supabase/scripts/.
-- =====================================================================

-- Tout ou rien : si une instruction échoue, RIEN n'est appliqué.
BEGIN;

-- ---------- 0. Garde-fous ----------
DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_staff') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_leads_status_check'
                    AND pg_get_constraintdef(oid) LIKE '%gagne%') THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0001 à 0007 (0007_landing_pipeline.sql).';
  END IF;
  IF to_regclass('public.organizations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0008 a déjà été appliquée.';
  END IF;
END $$;

-- ---------- 1. Organisations ----------
CREATE TABLE public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  sector      TEXT CHECK (char_length(sector) <= 64),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organisation n°1 : Easy2Book (identifiant fixe, utilisé comme valeur par défaut pendant la transition).
INSERT INTO public.organizations (id, slug, name, sector)
VALUES ('00000000-0000-4000-8000-0000000e2b01', 'easy2book', 'Easy2Book', 'voyage');

CREATE TABLE public.organization_members (
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  user_id         UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee')),
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX organization_members_user_idx ON public.organization_members (user_id) WHERE active;

-- Administrateurs de la PLATEFORME (Super Admin). Aucune écriture par l'API : seul le propriétaire
-- de la base (éditeur SQL, script supabase/scripts/provision-super-admin.sql) y inscrit un compte.
CREATE TABLE public.platform_admins (
  user_id     UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  note        TEXT CHECK (char_length(note) <= 500)
);

-- Journal d'audit des actions sensibles sur les organisations (ajout seul).
CREATE TABLE public.organization_audit (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  organization_id UUID REFERENCES public.organizations (id) ON DELETE RESTRICT,
  actor_id        UUID,           -- auth.uid() quand l'action vient d'un compte connecté ; NULL : éditeur SQL / serveur
  action          TEXT NOT NULL CHECK (char_length(action) <= 64),
  details         JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ---------- 2. Fonctions d'autorisation (SECURITY DEFINER : évitent la récursion des politiques) ----------
-- Rôle du compte connecté dans l'organisation (NULL : non membre, membre désactivé ou organisation suspendue).
CREATE FUNCTION public.landing_member_role(org UUID) RETURNS TEXT
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT m.role
  FROM public.organization_members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.organization_id = org AND m.user_id = auth.uid() AND m.active AND o.status = 'active'
$$;

CREATE FUNCTION public.landing_is_platform_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
$$;

REVOKE ALL ON FUNCTION public.landing_member_role(UUID), public.landing_is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.landing_member_role(UUID), public.landing_is_platform_admin() TO authenticated, service_role;

-- ---------- 3. Rattachement de TOUTES les données existantes à Easy2Book ----------
-- Colonne ajoutée avec une valeur par défaut constante : PostgreSQL rattache les lignes existantes
-- à Easy2Book sans réécrire la table et sans déclencher les triggers (historique immuable inclus).
-- Le DEFAULT est TRANSITOIRE : il disparaîtra (migration « contract ») quand le code enverra
-- toujours organization_id explicitement.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'landing_leads', 'landing_events', 'landing_lead_activities', 'landing_staff',
    'landing_integrations', 'landing_integration_changes', 'landing_admin_log',
    'landing_protection', 'landing_blocklist', 'landing_categories', 'landing_offers',
    'landing_promo_codes', 'landing_message_templates'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN organization_id UUID NOT NULL DEFAULT %L REFERENCES public.organizations (id) ON DELETE RESTRICT',
      t, '00000000-0000-4000-8000-0000000e2b01');
  END LOOP;
END $$;

CREATE INDEX landing_leads_org_idx ON public.landing_leads (organization_id, created_at DESC);
CREATE INDEX landing_events_org_idx ON public.landing_events (organization_id, created_at DESC);
CREATE INDEX landing_lead_activities_org_idx ON public.landing_lead_activities (organization_id);
CREATE INDEX landing_staff_org_idx ON public.landing_staff (organization_id);

-- L'organisation d'une ligne ne change jamais (sauf opération volontaire du propriétaire :
-- SET landing.org_move = 'on' dans l'éditeur SQL).
CREATE FUNCTION public.landing_org_immutable() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     AND coalesce(current_setting('landing.org_move', true), '') <> 'on' THEN
    RAISE EXCEPTION 'organization_id est immuable (table %)', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'landing_leads', 'landing_events', 'landing_staff', 'landing_integrations', 'landing_blocklist',
    'landing_categories', 'landing_offers', 'landing_promo_codes', 'landing_message_templates'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER landing_org_immutable BEFORE UPDATE OF organization_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.landing_org_immutable()', t);
  END LOOP;
END $$;
-- (landing_lead_activities est déjà en ajout seul ; les tables de journal le sont aussi.)

-- Une ligne d'historique appartient TOUJOURS à l'organisation de son lead (valeur recalculée, jamais crue).
CREATE FUNCTION public.landing_activity_inherit_org() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  SELECT organization_id INTO NEW.organization_id FROM public.landing_leads WHERE id = NEW.lead_id;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_activity_inherit_org BEFORE INSERT ON public.landing_lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.landing_activity_inherit_org();

-- Un lead ne peut être confié qu'à un membre de la MÊME organisation.
CREATE FUNCTION public.landing_leads_assignee_same_org() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.landing_staff s WHERE s.user_id = NEW.assigned_to AND s.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'le conseiller affecté n''appartient pas à l''organisation du lead';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_leads_assignee_same_org BEFORE INSERT OR UPDATE OF assigned_to ON public.landing_leads
  FOR EACH ROW EXECUTE FUNCTION public.landing_leads_assignee_same_org();

-- ---------- 4. Équipe actuelle → membres de l'organisation Easy2Book ----------
INSERT INTO public.organization_members (organization_id, user_id, role, active, created_at)
SELECT organization_id, user_id, CASE role WHEN 'admin' THEN 'admin' ELSE 'employee' END, active, created_at
FROM public.landing_staff;

-- Tant que l'application écrit encore dans landing_staff, les membres suivent automatiquement.
-- Un « manager » (rôle qui n'existe pas dans landing_staff) n'est jamais rétrogradé par la synchronisation.
CREATE FUNCTION public.landing_staff_mirror_member() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.organization_members SET active = false
     WHERE organization_id = OLD.organization_id AND user_id = OLD.user_id;
    RETURN OLD;
  END IF;
  INSERT INTO public.organization_members (organization_id, user_id, role, active)
  VALUES (NEW.organization_id, NEW.user_id, CASE NEW.role WHEN 'admin' THEN 'admin' ELSE 'employee' END, NEW.active)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET active = EXCLUDED.active,
        role = CASE WHEN public.organization_members.role = 'manager' AND EXCLUDED.role = 'employee'
                    THEN 'manager' ELSE EXCLUDED.role END;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_staff_mirror_member AFTER INSERT OR UPDATE OR DELETE ON public.landing_staff
  FOR EACH ROW EXECUTE FUNCTION public.landing_staff_mirror_member();

-- Une organisation garde toujours au moins un administrateur actif.
CREATE FUNCTION public.landing_members_keep_admin() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.role = 'admin' AND OLD.active
     AND (TG_OP = 'DELETE' OR NEW.role <> 'admin' OR NOT NEW.active)
     AND NOT EXISTS (SELECT 1 FROM public.organization_members m
                     WHERE m.organization_id = OLD.organization_id AND m.role = 'admin' AND m.active
                       AND m.user_id <> OLD.user_id) THEN
    RAISE EXCEPTION 'une organisation doit conserver au moins un administrateur actif';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER landing_members_keep_admin BEFORE UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.landing_members_keep_admin();

-- ---------- 5. Journal d'audit (ajout seul) ----------
CREATE FUNCTION public.landing_org_audit_immutable() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'organization_audit est en ajout seul';
END $$;
CREATE TRIGGER organization_audit_no_change BEFORE UPDATE OR DELETE ON public.organization_audit
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_audit_immutable();
CREATE TRIGGER organization_audit_no_truncate BEFORE TRUNCATE ON public.organization_audit
  FOR EACH STATEMENT EXECUTE FUNCTION public.landing_org_audit_immutable();

CREATE FUNCTION public.landing_org_audit() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE org UUID; act TEXT; det JSONB;
BEGIN
  IF TG_TABLE_NAME = 'organizations' THEN
    org := coalesce(NEW.id, OLD.id);
    IF TG_OP = 'INSERT' THEN act := 'organization_created'; det := jsonb_build_object('slug', NEW.slug);
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN act := 'organization_status'; det := jsonb_build_object('from', OLD.status, 'to', NEW.status);
    ELSE RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'organization_members' THEN
    org := coalesce(NEW.organization_id, OLD.organization_id);
    IF TG_OP = 'INSERT' THEN act := 'member_added'; det := jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role);
    ELSIF TG_OP = 'DELETE' THEN act := 'member_removed'; det := jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role);
    ELSIF NEW.role IS DISTINCT FROM OLD.role OR NEW.active IS DISTINCT FROM OLD.active THEN
      act := 'member_changed';
      det := jsonb_build_object('user_id', NEW.user_id, 'role_from', OLD.role, 'role_to', NEW.role, 'active_from', OLD.active, 'active_to', NEW.active);
    ELSE RETURN NEW; END IF;
  ELSE -- platform_admins
    org := NULL;
    IF TG_OP = 'INSERT' THEN act := 'platform_admin_added'; det := jsonb_build_object('user_id', NEW.user_id);
    ELSE act := 'platform_admin_removed'; det := jsonb_build_object('user_id', OLD.user_id); END IF;
  END IF;
  INSERT INTO public.organization_audit (organization_id, actor_id, action, details) VALUES (org, auth.uid(), act, det);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER landing_org_audit AFTER INSERT OR UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_audit();
CREATE TRIGGER landing_org_audit AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_audit();
CREATE TRIGGER landing_org_audit AFTER INSERT OR DELETE ON public.platform_admins
  FOR EACH ROW EXECUTE FUNCTION public.landing_org_audit();

-- La création d'Easy2Book et la recopie de l'équipe sont elles aussi tracées (rejouées à la main :
-- les triggers n'existaient pas encore au moment de l'INSERT).
INSERT INTO public.organization_audit (organization_id, actor_id, action, details)
VALUES ('00000000-0000-4000-8000-0000000e2b01', NULL, 'organization_created', '{"slug":"easy2book","origin":"migration 0008"}');
INSERT INTO public.organization_audit (organization_id, actor_id, action, details)
SELECT organization_id, NULL, 'member_added', jsonb_build_object('user_id', user_id, 'role', role, 'origin', 'migration 0008')
FROM public.organization_members;

-- ---------- 6. Droits et isolation (RLS) ----------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_audit FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.organizations, public.organization_members, public.platform_admins, public.organization_audit
  FROM PUBLIC, anon, authenticated, service_role;

-- Lecture seule pour les comptes connectés ; AUCUNE écriture par l'API (rôles, membres, Super Admin :
-- seul le propriétaire de la base les modifie). service_role : lecture seule pour l'instant ; les
-- écritures serveur (inscription d'une entreprise…) seront accordées par une migration dédiée, au
-- strict nécessaire.
GRANT SELECT ON public.organizations, public.organization_members, public.platform_admins TO authenticated;
GRANT SELECT ON public.organizations, public.organization_members, public.platform_admins, public.organization_audit TO service_role;

CREATE POLICY organizations_member_read ON public.organizations
  FOR SELECT TO authenticated
  USING (public.landing_member_role(id) IS NOT NULL OR public.landing_is_platform_admin());

CREATE POLICY organization_members_read ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.landing_member_role(organization_id) IN ('admin', 'manager')
         OR public.landing_is_platform_admin());

CREATE POLICY platform_admins_self_read ON public.platform_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Les anciennes politiques « tout membre de l'équipe lit tout » sont remplacées par des politiques par organisation.
DROP POLICY landing_leads_staff_read ON public.landing_leads;
DROP POLICY landing_events_staff_read ON public.landing_events;
DROP POLICY landing_activities_staff_read ON public.landing_lead_activities;
DROP POLICY landing_staff_self_or_staff ON public.landing_staff;

-- Leads : admin et manager de l'organisation voient tout ; un employé voit SES leads ET les leads non encore affectés
-- (décision du propriétaire, 07/11/2026) ; jamais ceux attribués à un collègue.
CREATE POLICY landing_leads_org_read ON public.landing_leads
  FOR SELECT TO authenticated
  USING (public.landing_member_role(organization_id) IN ('admin', 'manager')
         OR (public.landing_member_role(organization_id) = 'employee' AND (assigned_to = auth.uid() OR assigned_to IS NULL)));

-- Événements de navigation (identifiants visiteurs) : admin et manager seulement.
CREATE POLICY landing_events_org_read ON public.landing_events
  FOR SELECT TO authenticated
  USING (public.landing_member_role(organization_id) IN ('admin', 'manager'));

-- Historique : suit la visibilité du lead.
CREATE POLICY landing_activities_org_read ON public.landing_lead_activities
  FOR SELECT TO authenticated
  USING (public.landing_member_role(organization_id) IN ('admin', 'manager')
         OR (public.landing_member_role(organization_id) = 'employee'
             AND EXISTS (SELECT 1 FROM public.landing_leads l WHERE l.id = lead_id AND (l.assigned_to = auth.uid() OR l.assigned_to IS NULL))));

CREATE POLICY landing_staff_org_read ON public.landing_staff
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.landing_member_role(organization_id) IN ('admin', 'manager'));

-- Les autres tables (catalogue, codes promo, intégrations, protection, modèles, journaux) restent
-- RÉSERVÉES au serveur (aucun droit, aucune politique pour les comptes connectés) : leur accès par
-- organisation sera ouvert, table par table, avec les chantiers qui en ont besoin.

COMMIT;
