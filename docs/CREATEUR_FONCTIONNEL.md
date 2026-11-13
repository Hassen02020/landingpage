# Créateur de Landing Pages Easy2Book — état fonctionnel (phase d'exécution)

Réservé à Easy2Book. Aucun changement des pages publiques existantes (`/c/…`, `/omra`) ni des offres expirées. Essais sur FAUX Supabase : aucune preuve de production.

| Lot | Fonction | État |
|---|---|---|
| 1 | Tableau de bord : compteurs, onglets (actives, brouillons, publiées, archivées), recherche, filtre produit, duplication, désactivation, archivage contrôlé, restauration | FAIT — sans migration (archivage = brouillon en position −1000, réversible) |
| 2 | Statistiques par page : visites, visiteurs consentants, prospects, qualifiés, devis, réservations confirmées, commission conservée, dépenses, marge — « NON DISPONIBLE » si absent ; jamais le chiffre d'affaires | FAIT — réutilise le moteur de rentabilité |
| 3 | Personnalisation : couleur (préréglages + code exact, contraste vérifié), fond, texte du bouton, bouton WhatsApp, prix (« À partir de », prix barré), ordre et visibilité des sections, FAQ, programme, témoignages | CODE FAIT ET TESTÉ ; **stockage en attente de la migration 0018 proposée** (`docs/PROPOSITION_MIGRATION_0018_DESIGN.md`) — sans elle l'onglet prévient et refuse d'enregistrer, les pages gardent leur rendu |
| 4 | Reprise d'offres réelles du catalogue (sans coût), e-mail facultatif page par page | FAIT (l'option e-mail se stocke aussi via 0018) |
| déjà livrés | Assistant (10 modèles), éditeur d'infos, aperçu mobile/ordinateur, validation, publication, adresse stable, formulaire CRM avec consentement et UTM, lien publicitaire (Facebook, Instagram, TikTok, WhatsApp, Google Ads) | FAIT |

## Limites et décisions attendues
- **Migration 0018** (une colonne `design` JSONB) : indispensable pour mémoriser la personnalisation. Proposition rédigée, non créée.
- **Région dans le formulaire** : la décision antérieure du propriétaire demande la région « plus tard, en qualification CRM ». Non ajoutée au premier contact sans nouvelle décision (le champ existe en base).
- Téléphone/WhatsApp personnalisé par page : non fourni (numéro officiel du site).
- Arabe/RTL : pris en charge par le rendu et le formulaire ; les textes saisis par l'équipe sont affichés tels quels.
- Statistiques : visites totales non mesurées (le site ne compte que les visiteurs consentants).
