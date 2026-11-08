-- Retour arrière de 0012 : retire les deux fonctions. Aucune donnée touchée (les organisations déjà créées restent).
BEGIN;
DROP FUNCTION IF EXISTS public.landing_create_organization(text,text,text,uuid,uuid,text,text);
DROP FUNCTION IF EXISTS public.landing_set_organization_status(uuid,text,uuid);
COMMIT;
