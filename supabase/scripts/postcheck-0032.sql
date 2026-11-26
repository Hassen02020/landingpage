-- =====================================================================
-- CONTRÔLE APRÈS la migration 0032 (L7b) — LECTURE SEULE (aucune écriture).
-- Résultat : une ligne par contrôle ; la migration est saine si TOUS les statuts valent OK.
-- =====================================================================
SELECT n, controle, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS statut
FROM (
  SELECT 1 AS n, 'Table des confirmations présente, protégée (RLS forcée) et dossier unique' AS controle,
         COALESCE((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = to_regclass('public.landing_booking_confirmations')), false)
         AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'landing_booking_confirmations' AND indexdef LIKE '%UNIQUE%lead_id%') AS ok
  UNION ALL
  SELECT 2, 'Lecture par jeton : l''employé ne lit que ses dossiers, admin et manager l''organisation',
         COALESCE((SELECT qual LIKE '%employee%' AND qual LIKE '%assigned_to = auth.uid()%' AND qual LIKE '%admin%manager%' AND qual LIKE '%landing_member_role%'
                   FROM pg_policies WHERE schemaname = 'public' AND policyname = 'landing_booking_confirmations_read'), false)
  UNION ALL
  SELECT 3, 'Aucune écriture par jeton, aucune suppression même par le serveur',
         (SELECT count(*) FROM (VALUES ('anon'), ('authenticated')) r(role), (VALUES ('INSERT'), ('UPDATE'), ('DELETE')) pr(priv)
          WHERE has_table_privilege(r.role, 'public.landing_booking_confirmations', pr.priv)) = 0
         AND NOT has_table_privilege('service_role', 'public.landing_booking_confirmations', 'DELETE')
  UNION ALL
  SELECT 4, 'Conditions de paiement : colonnes ajoutées aux offres, aucune définie par défaut (aucune offre modifiée)',
         (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_offers'
            AND column_name IN ('payment_terms_defined', 'deposit_kind', 'deposit_value', 'deposit_due_date', 'payment_terms_note')) = 5
         AND NOT EXISTS (SELECT 1 FROM public.landing_offers WHERE payment_terms_defined)
  UNION ALL
  SELECT 5, 'Référence de commission : colonne présente, vide sur toutes les lignes existantes',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'landing_commissions' AND column_name = 'confirmation_ref')
         AND NOT EXISTS (SELECT 1 FROM public.landing_commissions WHERE confirmation_ref IS NOT NULL)
  UNION ALL
  SELECT 6, 'Aucune confirmation de réservation créée par la migration (tous les dossiers restent « Non renseigné »)',
         NOT EXISTS (SELECT 1 FROM public.landing_booking_confirmations)
) c
ORDER BY n;
