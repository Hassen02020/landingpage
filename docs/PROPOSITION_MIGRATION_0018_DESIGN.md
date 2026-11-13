# Proposition de migration 0018 — personnalisation des pages (NON CRÉÉE, NON APPLIQUÉE)

**Statut : proposition écrite uniquement.** Aucun fichier n'a été ajouté à `supabase/migrations`. Rien n'est exécuté sans votre autorisation distincte, et vous exécutez vous-même le SQL de production.

## Pourquoi
Couleurs, arrière-plan, texte du bouton, ordre des sections, FAQ propre, témoignages, programme et présentation des prix doivent être mémorisés par page. Aucune colonne existante ne convient (écrire du JSON dans `description` serait affiché au public).

## Contenu proposé
```sql
-- Ajout d'UNE colonne, nullable, sans valeur par défaut : aucune page existante n'est modifiée, aucun verrou long.
ALTER TABLE public.landing_categories
  ADD COLUMN design JSONB
  CHECK (design IS NULL OR (jsonb_typeof(design) = 'object' AND octet_length(design::text) <= 16000));
```
- Cloisonnement : la colonne hérite des règles existantes de `landing_categories` (organisation, droits `service_role`).
- Retour arrière : `ALTER TABLE public.landing_categories DROP COLUMN design;` (les pages reprennent leur rendu par défaut).
- Contrôle : `SELECT count(*) FROM landing_categories WHERE design IS NOT NULL;` (0 juste après l'application).

## Ce que fait le code SANS la colonne (déjà livré)
- L'onglet « Personnaliser » s'affiche avec un avertissement ; l'enregistrement est refusé avec un message clair (rien n'est perdu, aucune erreur 500).
- Les pages publiques gardent exactement leur rendu actuel (la lecture du design ne lève jamais d'exception).
- Dès que la colonne existe, tout fonctionne sans redéploiement du code.

## Ce que la migration ne change pas
Pas d'effet sur `/c/…`, `/omra`, les offres, les prospects ni les autres entreprises.
