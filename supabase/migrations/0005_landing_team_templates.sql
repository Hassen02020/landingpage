-- =====================================================================
-- Easy2Book landing — 0005 : gestion de l'équipe depuis /admin, modèles de messages WhatsApp,
-- journal d'administration.
-- À exécuter UNIQUEMENT dans le projet Supabase des landing pages, APRÈS 0001 à 0004.
-- =====================================================================

-- ---------- 0. Garde-fous ----------
DO $$
BEGIN
  IF to_regclass('public.agencies') IS NOT NULL
     OR to_regclass('public.crm_conversations') IS NOT NULL
     OR to_regclass('public.reservations') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : base EasyV4 (CRM) détectée. Ce script est réservé au projet Supabase des landing pages.';
  END IF;
  IF to_regclass('public.landing_offers') IS NULL THEN
    RAISE EXCEPTION 'ARRÊT : appliquer d''abord 0001 à 0004 (0004_landing_catalog.sql).';
  END IF;
  IF to_regclass('public.landing_message_templates') IS NOT NULL THEN
    RAISE EXCEPTION 'ARRÊT : la migration 0005 a déjà été appliquée.';
  END IF;
END $$;

-- ---------- 1. Équipe gérée depuis /admin/equipe ----------
-- Le serveur du site peut désormais ajouter un membre et modifier son rôle / son accès.
GRANT INSERT, UPDATE ON public.landing_staff TO service_role;

-- Il reste toujours au moins un administrateur actif (aucune erreur de manipulation ne peut
-- fermer l'accès à /admin).
CREATE FUNCTION public.landing_staff_keep_admin() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF (OLD.role = 'admin' AND OLD.active) AND NOT (NEW.role = 'admin' AND NEW.active) THEN
    IF NOT EXISTS (SELECT 1 FROM public.landing_staff WHERE role = 'admin' AND active AND user_id <> OLD.user_id) THEN
      RAISE EXCEPTION 'Il doit rester au moins un administrateur actif';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER landing_staff_keep_admin BEFORE UPDATE ON public.landing_staff
  FOR EACH ROW EXECUTE FUNCTION public.landing_staff_keep_admin();

-- ---------- 2. Journal d'administration (ajout seul) ----------
CREATE TABLE public.landing_admin_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id    UUID REFERENCES public.landing_staff (user_id) ON DELETE SET NULL,
  actor_label TEXT NOT NULL CHECK (char_length(actor_label) <= 320),
  area        TEXT NOT NULL CHECK (area IN ('equipe', 'modeles', 'leads')),
  summary     TEXT NOT NULL CHECK (char_length(summary) <= 300)
);
CREATE FUNCTION public.landing_admin_log_immutable() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'landing_admin_log est en ajout seul';
END $$;
CREATE TRIGGER landing_admin_log_no_update BEFORE UPDATE OR DELETE ON public.landing_admin_log
  FOR EACH ROW EXECUTE FUNCTION public.landing_admin_log_immutable();
CREATE TRIGGER landing_admin_log_no_truncate BEFORE TRUNCATE ON public.landing_admin_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.landing_admin_log_immutable();

-- ---------- 3. Modèles de messages WhatsApp ----------
-- Variables remplacées sur la fiche du lead : {prenom} {nom} {ref} {offre} {produit}
CREATE TABLE public.landing_message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 80),
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 2 AND 1500),
  product     TEXT CHECK (product IN ('omra', 'voyage', 'hotel', 'autre')), -- vide = tous
  position    INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES public.landing_staff (user_id) ON DELETE SET NULL
);

INSERT INTO public.landing_message_templates (title, body, product, position) VALUES
  ('Premier contact (Omra)', 'السلام عليكم {prenom} 🌙
معاك Easy2Book، وصلنا طلبك ({ref}) بخصوص {offre}.
وقتاش يناسبك نحكيو باش نعطيوك كل التفاصيل والأماكن المتوفرة؟', 'omra', 1),
  ('Relance (Omra)', 'السلام عليكم {prenom}، نذكّروك بطلبك ({ref}) لـ {offre}. الأماكن محدودة 🔥 تحب نحجزولك مكانك؟', 'omra', 2),
  ('Premier contact', 'Bonjour {prenom} 👋
Ici Easy2Book : nous avons bien reçu votre demande ({ref}) pour {offre}.
Quand pouvons-nous vous appeler pour vous donner tous les détails ?', NULL, 3),
  ('Documents à préparer', 'Bonjour {prenom}, pour finaliser votre réservation ({ref}), merci de nous envoyer une copie de votre passeport (valide au moins 6 mois après le retour).', NULL, 4);

-- ---------- 4. Sécurité ----------
ALTER TABLE public.landing_admin_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_admin_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.landing_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_message_templates FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.landing_admin_log, public.landing_message_templates FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.landing_staff_keep_admin(), public.landing_admin_log_immutable() FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.landing_admin_log TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.landing_message_templates TO service_role;
