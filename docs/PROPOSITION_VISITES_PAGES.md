# Proposition — mesurer les visites d'une page sans confondre consentement et trafic (NON APPLIQUÉE)

## Situation actuelle (inchangée)
| Indicateur | Source | Ce qu'il représente |
|---|---|---|
| Visites totales | aucune | **NON DISPONIBLE** (jamais estimée) |
| Visiteurs ayant accepté le suivi | `landing_events` (ViewContent / CategoryView, visiteurs consentants) | un **sous-ensemble** du trafic ; jamais présenté comme les visites |
| Prospects, qualifiés, devis, réservations confirmées | CRM (`landing_leads`, historique des statuts, commissions) | exacts, indépendants du suivi |

Le tableau « Statistiques » sépare désormais ces trois familles (audience, commercial, financier). Un taux « prospects ÷ visiteurs consentants » n'est volontairement pas affiché : le dénominateur sous-estime le trafic.

## Solution proposée : compteur de pages vues ANONYME et agrégé
- **Principe** : à chaque affichage de `/p/<adresse>` (page publiée, hors aperçu administrateur, hors préchargement, hors robots connus d'après l'agent utilisateur), le serveur ajoute **+1** à un compteur par jour et par page. Aucun cookie, aucun identifiant, aucune adresse IP, aucun agent utilisateur ni paramètre d'URL n'est enregistré.
- **Donnée** : `landing_page_views (organization_id, slug, day, views)` — une ligne par page et par jour. Incrément atomique par fonction SQL réservée au serveur. Cloisonnée par entreprise, comme le reste.
- **Ce que le chiffre veut dire** : « pages vues » (un rechargement compte), jamais « visiteurs uniques ». Affiché à part, sous le libellé « Pages vues (compteur anonyme) », à côté — et sans jamais les mélanger avec — « visiteurs ayant accepté le suivi ».
- **Réglementation** : une mesure d'audience strictement anonyme, agrégée, sans identifiant ni recoupement, relève en général du régime allégé (sans bandeau de consentement) dans l'esprit des lignes directrices européennes ; **la conformité exacte (INPDP en Tunisie, RGPD pour les visiteurs européens) doit être confirmée par vous ou votre conseil avant activation**. Tant qu'elle ne l'est pas, rien n'est collecté.
- **Limites** : robots non déclarés comptés ; pas de visiteurs uniques ; pas de provenance détaillée (la provenance reste portée par les prospects, via les UTM).

## Alternative sans migration
Activer Vercel Web Analytics (sans cookie, agrégé) et lire les pages vues par chemin dans le tableau de bord Vercel. Pas de lien automatique avec le Créateur ; réglage Vercel à faire par vous.

## Ce qu'il faudrait (rien n'est créé)
1. Votre décision : compteur anonyme maison (migration 0019 + ~40 lignes de code) **ou** Vercel Web Analytics **ou** statu quo.
2. Pour le compteur : validation de conformité ci-dessus, puis autorisation de créer le fichier de migration local (que vous appliqueriez).

## Esquisse SQL (indicative, NON créée dans `supabase/migrations`)
```sql
CREATE TABLE public.landing_page_views (
  organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  slug  TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 60),
  day   DATE NOT NULL,
  views BIGINT NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (organization_id, slug, day)
);  -- + RLS forcée, accès service_role seulement, fonction d'incrément atomique (INSERT … ON CONFLICT DO UPDATE SET views = views + 1)
```
