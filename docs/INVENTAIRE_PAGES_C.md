# Inventaire des pages `/c/…` existantes — LECTURE SEULE EN PRODUCTION (à exécuter par vous)

**Statut : NON EXÉCUTÉ.** Claude n'a aucun accès à la base de production et n'en exécute jamais les requêtes ; ces requêtes sont uniquement des `SELECT`.
**Décision du propriétaire :** aucune modification des pages `/c/…` existantes et aucun déploiement avant que cet inventaire soit fait.

## Ce que le code protège déjà
- Le rendu `/c/<adresse>` est **identique à celui de `main`** (`app/c/[slug]/CategoryView.tsx`, empreinte vérifiée par `tests/c-pages-unchanged.test.ts`). Les pages du Créateur sont servies ailleurs : `/p/<adresse>`.
- Restent modifiés côté `/c/…` (phase A, déjà décidée) : le secours d'une catégorie introuvable (redirection avec paramètres conservés) et l'erreur 500 en cas de panne. **Ce sont des chemins d'erreur, pas le rendu des pages existantes.**
- Nouveauté touchant le catalogue : l'adresse d'une catégorie publiée ou déjà utilisée ne peut plus être renommée (le contenu reste modifiable).

## 1. Catégories existantes et leur état (adresses à protéger)
```sql
SELECT c.slug, c.name, c.product, c.visible, c.updated_at,
       count(o.*) FILTER (WHERE o.visible AND o.archived_at IS NULL)                                   AS offres_affichees,
       count(o.*) FILTER (WHERE o.visible AND o.archived_at IS NULL AND o.departure_date < current_date) AS offres_expirees
FROM landing_categories c
LEFT JOIN landing_offers o ON o.category_id = c.id
GROUP BY c.id ORDER BY c.slug;
```
(si la base contient plusieurs entreprises, ajouter `WHERE c.organization_id = (SELECT id FROM organizations WHERE slug = 'easy2book')`.)

## 1 bis. Compléments d'inventaire (SELECT uniquement, résultats agrégés, aucune donnée de prospect)
```sql
-- (a) Catégories publiées / masquées, par entreprise
SELECT org.slug AS entreprise, c.visible, count(*) AS categories
FROM landing_categories c JOIN organizations org ON org.id = c.organization_id
GROUP BY 1,2 ORDER BY 1,2;

-- (b) Adresses (slugs) présentes chez PLUSIEURS entreprises = collisions éventuelles
SELECT slug, count(DISTINCT organization_id) AS entreprises, array_agg(DISTINCT organization_id) AS ids
FROM landing_categories GROUP BY slug HAVING count(DISTINCT organization_id) > 1;

-- (c) La base impose-t-elle l'unicité par entreprise ? (migrations 0010 / 0011)
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'landing_categories' AND indexdef ILIKE '%slug%';
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.landing_categories'::regclass AND contype IN ('u','p');

-- (d) Entreprises (pour lire (a) et (b) ; aucune donnée personnelle)
SELECT slug, status FROM organizations ORDER BY slug;

-- (e) Offres rattachées à une catégorie masquée (pages invisibles mais conservées)
SELECT c.slug, count(o.*) AS offres FROM landing_categories c
JOIN landing_offers o ON o.category_id = c.id
WHERE NOT c.visible GROUP BY 1 ORDER BY 1;
```
Lecture de (c) : l'index attendu est `landing_categories_org_slug_uq (organization_id, slug)` et l'ancienne contrainte `landing_categories_slug_key` doit avoir disparu. Si elle est encore là, deux entreprises ne peuvent pas partager une adresse (aucun risque de collision, mais aucune migration 0011 appliquée).

## 2. Prospects arrivés par une page `/c/…` (120 derniers jours)
```sql
SELECT landing_page, coalesce(utm_source,'-') AS source, coalesce(utm_campaign,'-') AS campagne,
       count(*) AS prospects, min(created_at) AS premier, max(created_at) AS dernier
FROM landing_leads
WHERE (landing_page LIKE '/c/%' OR landing_page LIKE '/p/%') AND created_at > now() - interval '120 days'
GROUP BY 1,2,3 ORDER BY prospects DESC;
```

## 3. Visites enregistrées (visiteurs consentants) sur ces pages
```sql
SELECT niche AS page, event_name, count(*) AS evenements, max(created_at) AS dernier
FROM landing_events
WHERE niche IN (SELECT slug FROM landing_categories) AND created_at > now() - interval '120 days'
GROUP BY 1,2 ORDER BY evenements DESC;
```

## 4. À compléter dans Meta / TikTok / Google Ads Ads Manager
Relever l'adresse de destination de chaque annonce **active** ou récente et noter celles qui contiennent `/c/`.

## 5. Comment lire le résultat
| Constat | Conséquence |
|---|---|
| Aucune catégorie visible hors `omra-2027`, aucun prospect ni annonce sur `/c/…` | aucune page `/c/…` en usage : le rendu pourra être discuté plus tard |
| Une ou plusieurs adresses `/c/<x>` avec prospects ou annonces actives | **ne rien changer** à leur rendu ; ces adresses sont automatiquement protégées contre le renommage |
| Des offres expirées encore affichées | sujet traité séparément (décision : ne pas modifier l'affichage dans ce chantier) |

Ne communiquez pas de données personnelles : ces requêtes ne renvoient que des agrégats.

## Sondes publiques en lecture seule (exécutées par Claude, requêtes GET sans donnée personnelle)

Cible : alias de production actuel. Aucune écriture, aucun accès à la base. Ces résultats décrivent la version **actuellement déployée**, pas la branche locale.

| Adresse | Résultat | Lecture |
|---|---|---|
| `/`, `/omra`, `/voyages-organises`, `/summer-vibes` | 200 | pages fixes en ligne |
| `/c/omra-2027` | 307 → `/omra` | redirection existante en place |
| `/omra-2027` | 404 | la règle 307 de la branche n'est PAS déployée |
| `/p/omra-2027`, `/p/<inconnue>` | 404 | route `/p` non déployée (branche locale uniquement) |
| `/c/<inconnue>`, `/o/<inconnue>` | 404 | comportement actuellement déployé (avant phase A) |
| `/admin/createur` | 307 → connexion | protégé ; ne prouve pas que le Créateur soit déployé |
| `robots.txt` | interdit `/admin`, `/api/`, `/o/`, `/c/` | `/p/` à interdire : prévu dans la branche |
| `sitemap.xml` | 6 adresses fixes, aucune `/c/…` | aucune catégorie listée |
| liens `/c/…` dans l'accueil et `/voyages-organises` | aucun | aucune catégorie visible n'y est liée |

**NON VÉRIFIÉ** (exige vos requêtes `SELECT` ci-dessus) : catégories publiées en base, catégories masquées, liens publicitaires réellement utilisés, collisions d'adresses, volumes de prospects par page.
