# Données publiques du site — sources et règles (mise à jour du 09/11/2026)

## Sources (fournies par le propriétaire)
| Page | Module | Fichier source | Contenu repris |
|---|---|---|---|
| `/voyages-organises` | `app/voyages-organises/data.ts` | `voyages_organises_easy2book.xlsx` (feuille « Voyages valables ») | 19 voyages : catégorie, destination, titre, premier départ, durée, visa, prix « à partir de » (TND par personne) |
| `/summer-vibes` | `app/summer-vibes/data/hotel-promos.ts` | `promos_hotels_tunisie_active_travel.xlsx` | 29 hôtels : ville, réduction (%), prix « à partir de », remarque |

Les modules sont **générés à partir des fichiers** (aucune retranscription à la main) et vérifiés par `tests/site-data.test.ts` (nombres, valeurs contrôlées une à une, absence de lien externe).

## Décisions du propriétaire (09/11/2026)
- **Hôtels** : réduction + prix « par personne et par nuit », présentés comme **tarif indicatif confirmé sur WhatsApp**. Les colonnes « Type de séjour » et « Validité des dates » étant vides, **aucune date de validité n'est affichée**.
- **Liens Active Travel** : non affichés. Tout passe par le bouton WhatsApp d'Easy2Book.
- **Voyages** : seulement les données du fichier. Pas de photo (aucune photo vérifiée pour ces destinations), pas de prestations incluses ni de description (le programme est « sur demande »). Fond coloré par catégorie (Premium, Individuel garanti, Standard).

## Règles appliquées
- **Prix exacts, jamais arrondis** (le dinar a 3 décimales) : 44,5 reste 44,5 ; 160,125 reste 160,125.
- **Départ passé masqué automatiquement** (date du jour en Tunisie, calculée dans le navigateur ; le HTML initial est identique côté serveur pour éviter les écarts d'affichage). Un départ du jour affiche « Départ aujourd'hui — contactez-nous vite » ; à moins de 14 jours : « Départ dans N jours ».
- Remarque ambiguë « 1er -5 ans » (Laico Hammamet) **volontairement non affichée** ; « Réservé aux non-célibataires » (Marhaba Club) et « Premier enfant de moins de 6 ans gratuit » (Sol Palmeras Beach) affichées telles quelles.
- La feuille « Départs passés » n'est pas affichée (départs terminés).
- Les chiffres du bandeau de `/voyages-organises` (destinations, départs, catégories, prix de départ) sont **calculés** à partir des données ; les mentions non justifiées par le fichier (« 20+ dates », « 4★/5★ hôtels partenaires », « 100 % organisé & guidé », « Vol inclus / Hôtel sélectionné / Visites guidées / Groupe organisé ») ont été retirées de cette page.

## Contenus existants NON vérifiés (non modifiés, à valider par le propriétaire)
`/summer-vibes` : titre « Été 2026 », « Places limitées — Été 2026 », compte à rebours, « 4.9/5 », « +1200 réservations », « +500 clients », catégories d'hôtels (El Mouradi…, « All inclusive », « Aquapark ») et témoignages. Accueil : « Vols + hôtels + visites inclus », « Départs garantis depuis Tunis ». `/voyages-organises` : section « Pourquoi choisir Easy2Book » (guides nommées, « support 24/7 »).

## Mettre à jour la prochaine fois
Envoyer le nouveau fichier ; les modules sont régénérés et les tests de cohérence rejoués. À terme, ces listes pourraient être gérées depuis l'administration (module Catalogue existant) pour éviter toute intervention technique.
