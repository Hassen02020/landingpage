-- Retour arrière de 0013 : refusé tant qu'un manager existe (le retour casserait la contrainte).
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.landing_staff WHERE role = 'manager') THEN
    RAISE EXCEPTION 'ARRÊT : des membres ont le rôle manager. Changez leur rôle avant le retour arrière.';
  END IF;
END $$;
ALTER TABLE public.landing_staff DROP CONSTRAINT IF EXISTS landing_staff_role_check;
ALTER TABLE public.landing_staff ADD CONSTRAINT landing_staff_role_check CHECK (role IN ('admin', 'agent'));
CREATE OR REPLACE FUNCTION public.landing_staff_mirror_member() RETURNS trigger
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
COMMIT;
