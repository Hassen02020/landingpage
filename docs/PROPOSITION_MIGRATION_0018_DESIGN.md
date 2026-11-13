# Migration 0018 — personnalisation des pages (FICHIER CRÉÉ LOCALEMENT, NON APPLIQUÉ)

Fichiers : `supabase/migrations/0018_page_design.sql`, `supabase/rollback/0018_rollback.sql`, `supabase/scripts/postcheck-0018.sql`, test `tests/migration-0018.test.ts` (PostgreSQL de test).
**Rien n'a été exécuté sur Supabase.** Vous l'appliquez vous-même, dans le projet des landing pages uniquement (jamais EasyV4).

## SQL exact (cœur de la migration)
```sql
ALTER TABLE public.landing_categories
  ADD COLUMN design JSONB
  CONSTRAINT landing_categories_design_check
  CHECK (design IS NULL OR (jsonb_typeof(design) = 'object' AND octet_length(design::text) <= 16000));
```
Autour : gardes d'arrêt (base EasyV4 détectée, tables 0004/0008 absentes, migration déjà appliquée), transaction `BEGIN … COMMIT`, commentaire de colonne.

## Effet, en clair
- Ajoute **une seule case** « design » à chaque page du catalogue. Elle est **vide** (NULL) : aucune page existante n'est modifiée, aucune n'a de valeur par défaut, `/c/…` et `/omra` ne changent pas.
- La base vérifie seulement que le contenu est un **objet JSON de 16 000 caractères maximum**. Le contrôle fin (couleurs lisibles, longueurs, sections autorisées, texte brut) est fait par le serveur à l'enregistrement **et** à chaque lecture publique.
- Droits et cloisonnement **inchangés** : la table garde sa sécurité par ligne forcée et l'accès réservé au serveur ; la colonne suit la ligne, donc l'entreprise propriétaire de la page. Aucune nouvelle table, aucun stockage concurrent.
- Retour arrière : `0018_rollback.sql` supprime la colonne, **refusé** tant qu'une page a une personnalisation (elle serait perdue). Les pages reprennent alors leur rendu par défaut.

## Vérifié (sur PostgreSQL de test, pas sur votre base)
Gardes ; pages existantes inchangées (mêmes valeurs avant/après) ; colonne NULL sans défaut ; refus d'un tableau, d'un texte ou d'un objet trop gros ; service_role lit et modifie, anon et authenticated sans accès ; contrôle postcheck (4 lignes OK) ; retour arrière refusé puis accepté ; ré-application possible.

## Tant qu'elle n'est pas appliquée
L'onglet « Personnaliser » prévient et refuse d'enregistrer (aucune erreur 500, aucune perte) ; les pages gardent leur rendu actuel. Dès l'application, la personnalisation et l'option e-mail du formulaire fonctionnent sans redéploiement.

## Ordre conseillé (par vous)
1. `0018_page_design.sql`  2. `postcheck-0018.sql` (4 lignes « OK »)  3. test dans le Créateur : onglet « Personnaliser », enregistrer, actualiser, publier.
