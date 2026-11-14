# Landing Page Studio (Creator AI Studio) — inventaire et compatibilité

Source : `Hassen02020/Easy2Book-omraramdhan2027`, commit `55b7a10` (14/11/2026), cloné en LECTURE SEULE hors du projet. Rien n'a été copié dans `landingpage`, rien n'a été modifié dans ce dépôt.

## 1. Ce qu'est le Studio
Application **Vite + React, entièrement côté navigateur** (≈ 11 000 lignes), en mode démonstration (« Données de démonstration ») :
- Navigation : vue d'ensemble, toutes les pages, créer une page, modèles (16), bibliothèque de blocs (44), médias (15), brouillons, pages publiées, archives, paramètres. Langues FR / EN / AR, recherche globale, notifications.
- **4 univers** : Omra, Voyages, Hôtels Tunisie, Visa. Dossiers (« Groupe Ramadan 2027 »).
- **44 types de blocs** : 15 communs (hero image/vidéo, présentation, galerie, avantages, services, prix, cartes produit, témoignages, FAQ, compte à rebours, CTA, formulaire, WhatsApp, pied de page) + 8 Omra + 7 Voyages + 7 Hôtels + 7 Visa. Chaque bloc : style (couleurs, alignement, espacement, bordure), visibilité par appareil, contenu (titre, texte, image, éléments, date cible, WhatsApp).
- Éditeur de page (1 332 lignes), aperçu responsive (ordinateur / tablette / mobile), générateur de formulaire (champs activables, obligatoires), historique de versions avec restauration, publication (statuts brouillon / en relecture / programmée / publiée / expirée / archivée), SEO, attribution (UTM), médiathèque.
- **Contrat CRM** (`integration-contracts/crmAdapter.ts`) : `SimulatedCrmAdapter` qui journalise sans rien envoyer ; prévu pour être raccordé au vrai CRM.
- Serveur Express : `/api/creator/state` (un fichier JSON local, sans authentification), `/api/voiceover` (Gemini, clé serveur). Aucune base de données, aucun compte.

## 2. Comparaison avec le projet maître
| Sujet | Studio | landingpage | Verdict |
|---|---|---|---|
| Framework | Vite 8, SPA | Next.js 14.2.29 (App Router, rendu serveur) | Incompatible tel quel |
| React | 19 | 18 | Écart de version majeur |
| Tailwind | 4 (`@tailwindcss/vite`, syntaxe `@import`) | 3.4 (config `tailwind.config.ts`) | Classes et configuration à porter |
| TypeScript | 7 | 5 (strict) | Écart |
| Dépendances propres | `lucide-react`, `motion`, `@google/genai`, `express`, `dotenv` | aucune de ces dépendances | Ajout de paquets à décider |
| Authentification | aucune | session Supabase, droits par rôle, entreprise | À brancher |
| Données | état JSON local + démonstration | `landing_categories` / `landing_offers` / `design` JSONB, CRM | Modèle de données différent |
| Catalogue | références « externes » simulées | catalogue réel (`landing_offers`) | À connecter |
| CRM | adaptateur simulé | `/api/leads`, consentement, UTM, pipeline | À remplacer par l'existant |
| Rendu public | aperçu dans le navigateur | `/p/<adresse>` rendu serveur | Moteur de rendu à écrire côté serveur |
| Doublons | éditeur, aperçu, publication, formulaire, liens : tout existe déjà dans le Créateur | | Risque de deux systèmes concurrents |

## 3. Écarts fonctionnels (Studio → notre architecture, sans migration)
- **Statuts** « en relecture » et « programmée » : absents ; la publication programmée exige une date et un déclencheur serveur. « Expirée » existe déjà (calcul sur les offres).
- **Langue anglaise** : refusée par la base (`lang` limité à fr/ar).
- **Versions** : aucun stockage ; la colonne `design` est limitée à 16 000 octets, ce qui ne contiendrait pas 44 blocs stylés ni un historique.
- **Formulaire configurable par page** : notre configuration de formulaire est par entreprise (`landing_form_configs`), pas par page. Le champ **région** du Studio contredit la décision « qualification ultérieure ».
- **Clic WhatsApp** : le Studio prévoit `trackAsCrmLead: false` ; chez nous les clics WhatsApp sont suivis (avec consentement) et rattachés aux prospects.
- **Univers « Visa »** : n'existe pas comme produit (`omra`, `voyage`, `hotel`, `autre`).
- **Médias** : le Studio embarque 15 images ; nous utilisons le stockage Supabase (téléversement, sans liste des médias existants).
- Données de démonstration (8 pages, 16 modèles) : à ne jamais importer comme données réelles.

## 4. Stratégie d'intégration proposée
**Ne pas copier le Studio dans Next.** Reprendre son expérience et son vocabulaire, par lots, sur notre persistance et nos droits :
1. Navigation et tableau de bord à la manière du Studio (déjà largement couvert).
2. Bibliothèque de blocs : traduire les blocs en sections de notre moteur de rendu serveur (`design` v2).
3. Médiathèque : lister et réutiliser les images du stockage.
4. Formulaire par page, publication programmée, historique de versions : nécessitent des **migrations** (non créées).
5. Langues : ajouter l'anglais = migration.

## 5. Décisions nécessaires avant d'écrire du code d'intégration
1. Confirmer **l'approche** (porter l'expérience dans le Créateur existant) plutôt qu'un second outil.
2. Ordre de priorité des lots 2 à 5 (blocs, médiathèque, versions, programmation).
3. Autorisation d'ajouter `lucide-react` (icônes) ; `motion` et Gemini sont écartés par défaut.
4. Migrations : stockage des blocs et des versions (plus grand que 16 000 octets), anglais, publication programmée — à présenter séparément.

## Avancement de l'intégration (lots, sans migration)
- **Lot A — Médiathèque : FAIT.** Page `/admin/createur/medias` (images déjà utilisées par les pages et offres de l'entreprise, avec leurs usages) et sélecteur « Choisir une image déjà utilisée » dans l'éditeur (bannières et photos d'offres). Lecture du catalogue cloisonné uniquement : le bucket de stockage est partagé entre entreprises, il n'est jamais listé (sinon une entreprise verrait les images d'une autre). Limite : une image téléversée mais jamais enregistrée sur une page ou une offre n'apparaît pas.
- Lots B (blocs), C (versions), D (programmation), E (anglais) : voir les décisions de migration à présenter séparément ; rien n'est créé.
