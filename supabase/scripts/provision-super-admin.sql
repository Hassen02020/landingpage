-- =====================================================================
-- Attribution du rôle SUPER ADMIN (administrateur de la plateforme)
-- À exécuter par le PROPRIÉTAIRE dans l'éditeur SQL du projet Supabase des landing pages,
-- APRÈS la migration 0008. Ce n'est PAS une migration : aucune application automatique.
--
-- Sécurité : le rôle n'est JAMAIS accordé sur la foi d'une adresse envoyée par un navigateur.
-- Le script retrouve le compte dans l'authentification Supabase (auth.users). Si ce compte
-- n'existe pas, il s'arrête sans rien créer. Aucun mot de passe n'est créé ni modifié.
-- Le compte doit exister, avoir une adresse CONFIRMÉE et ne pas être suspendu.
-- Pour un autre compte : changer l'adresse ci-dessous (une seule fois, ici).
-- =====================================================================
DO $$
DECLARE
  target_email CONSTANT TEXT := 'Tarhouni.Hassene@gmail.com';
  uid UUID;
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.platform_admins') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord la migration 0008_multitenant_foundation.sql.';
  END IF;

  -- Seul un compte dont l'adresse est CONFIRMÉE et qui n'est pas suspendu peut devenir Super Admin :
  -- sinon quelqu'un qui s'inscrirait avec cette adresse avant le propriétaire recevrait le rôle.
  SELECT id INTO uid FROM auth.users
   WHERE lower(email) = lower(target_email)
     AND email_confirmed_at IS NOT NULL
     AND (banned_until IS NULL OR banned_until < now())
   LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : aucun compte CONFIRMÉ et actif pour % dans l''authentification Supabase. Rien n''a été créé.', target_email;
  END IF;

  INSERT INTO public.platform_admins (user_id, note)
  VALUES (uid, 'Propriétaire de la plateforme (script provision-super-admin.sql)')
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'Super Admin : compte % (id %) enregistré.', target_email, uid;
END $$;

-- Vérification (lecture seule) :
-- SELECT p.user_id, u.email, p.created_at FROM public.platform_admins p JOIN auth.users u ON u.id = p.user_id;
