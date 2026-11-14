# Créateur de Landing Pages Easy2Book — état fonctionnel (phase d'exécution)

Réservé à Easy2Book. Aucun changement des pages publiques existantes (`/c/…`, `/omra`) ni des offres expirées. Essais sur FAUX Supabase : aucune preuve de production.

| Lot | Fonction | État |
|---|---|---|
| 1 | Tableau de bord : compteurs, onglets (actives, brouillons, publiées, archivées), recherche, filtre produit, duplication, désactivation, archivage contrôlé, restauration | FAIT — sans migration (archivage = brouillon en position −1000, réversible) |
| 2 | Statistiques par page : visites, visiteurs consentants, prospects, qualifiés, devis, réservations confirmées, commission conservée, dépenses, marge — « NON DISPONIBLE » si absent ; jamais le chiffre d'affaires | FAIT — réutilise le moteur de rentabilité |
| 3 / 5 | Personnalisation : couleur (préréglages + code exact, contraste vérifié), fond, texte du bouton, bouton WhatsApp, prix (« À partir de », prix barré), ordre et visibilité des sections, FAQ, programme, témoignages | CODE FAIT ET TESTÉ ; **migration 0018 créée localement, NON appliquée** (`supabase/migrations/0018_page_design.sql`, explications dans `docs/PROPOSITION_MIGRATION_0018_DESIGN.md`) — sans elle l'onglet prévient et refuse d'enregistrer, les pages gardent leur rendu ; rechargement, modification, droits serveur, anti-injection et aperçu identique à la page publiée vérifiés |
| 4 | Reprise d'offres réelles du catalogue (sans coût), e-mail facultatif page par page | FAIT (l'option e-mail se stocke aussi via 0018) |
| déjà livrés | Assistant (10 modèles), éditeur d'infos, aperçu mobile/ordinateur, validation, publication, adresse stable, formulaire CRM avec consentement et UTM, lien publicitaire (Facebook, Instagram, TikTok, WhatsApp, Google Ads) | FAIT |

## Limites et décisions attendues
- **Migration 0018** : fichier créé localement, à appliquer par le propriétaire (voir `docs/PROPOSITION_MIGRATION_0018_DESIGN.md`).
- **Région** : reste une qualification CRM ultérieure (décision du propriétaire) ; le premier formulaire ne change pas.
- **Visites** : proposition de compteur anonyme dans `docs/PROPOSITION_VISITES_PAGES.md`, non activée.
- Téléphone/WhatsApp personnalisé par page : non fourni (numéro officiel du site).
- Arabe/RTL : pris en charge par le rendu et le formulaire ; les textes saisis par l'équipe sont affichés tels quels.
- Statistiques : visites totales non mesurées (le site ne compte que les visiteurs consentants).

| 6 | Statistiques de visites : séparation audience / commercial / financier ; proposition d'un compteur de pages vues anonyme | PROPOSITION écrite, rien de collecté ni de migré |
| 7 | Parcours employé complet par l'interface (créer → personnaliser → aperçu → publier → lien → statistiques → dupliquer → désactiver → archiver) ; liens « Lien publicitaire » et « Statistiques » sur chaque carte | FAIT, parcours navigateur 97/97 |

## Clone du modèle « Omra Ramadan complet » (dépôt Easy2Book-omraramdhan2027)
Modèle étudié en lecture seule (application Vite/React avec voix off Gemini et réservations en mémoire). Données confirmées par le propriétaire (Tarhouni Hassen) : hôtel Maysan Al-Multazem, 5 900 / 6 400 / 6 900 DT par personne (chambre à 4-5, à 3, à 2), réduction famille de 200 DT dès 2 personnes (texte d'information), groupes de plus de 10 personnes, offre valable jusqu'au 15 décembre 2026, 4 témoignages.
- Nouveau modèle du Créateur « Omra Ramadan complet » : 3 offres (chambres) pré-remplies, services en 4 cartes, avantages et conditions, témoignages, compte à rebours, bouton WhatsApp, couleur marine.
- **Aucune date de départ ni nombre de nuits inventés** : l'équipe les renseigne (obligatoires pour publier).
- Formulaire = celui du CRM (consentements séparés, UTM, e-mail facultatif) ; le serveur Express du modèle (réservations en mémoire) et la voix off Gemini ne sont PAS repris.
- La page `/omra` existante n'est pas modifiée.
- Le préréglage de personnalisation est stocké dans `landing_categories.design` (migration 0018, appliquée en production) et n'est appliqué qu'à la création d'une page.
