# Phase A — parcours sécurisés : comportement des pages publiques

Branche locale `feat/phase-a-parcours-securises` (non poussée). Ce document décrit ce que voit le visiteur selon la situation.

| Situation | Réponse | Détail |
|---|---|---|
| URL inexistante (`/n-importe-quoi`) | **404** | `app/not-found.tsx` : message, retour accueil (paramètres de campagne conservés), WhatsApp. En `noindex`. |
| Catégorie `/c/<slug>` introuvable (confirmé par la base) | **307** vers `/voyages-organises` | query string conservée (`lib/fallback.ts`). |
| Entreprise `/o/<slug>` introuvable ou suspendue | **307** vers `/` | provisoire : la distinction inconnue / suspendue fait l'objet d'une proposition séparée (décision D1). |
| **Panne de la base** (injoignable, 5xx, 401…) | **500** | erreur dédiée `PublicDataUnavailable` ; `app/error.tsx` affiche le message ; journal serveur `DB_UNAVAILABLE`. **Jamais** un 404, **jamais** une redirection. |
| **Base non configurée** | **500** | même traitement (raison `db_not_configured`) : c'est une erreur de service, pas une ressource inexistante. |
| `/omra-2027` | **307** vers `/omra` | règle unique de `next.config.mjs`, tous les paramètres conservés, aucun joker. |
| `/c/omra-2027` | **307** vers `/omra` | inchangée (dans la page, sans lecture de base). |

## Journal serveur `DB_UNAVAILABLE`
Une ligne JSON par incident, repérable par une alerte : `{"event":"DB_UNAVAILABLE","route":"/c/[slug]","reason":"db_error"|"db_not_configured","slug":"…","at":"…"}`.
Le `slug` n'est écrit que s'il respecte le format attendu (minuscules, chiffres, tirets) : une valeur hostile n'entre jamais dans les journaux. Aucune donnée personnelle.

## Limites acceptées
- **Le message personnalisé de panne nécessite JavaScript.** Next 14 renvoie, pour un statut 500, une coquille HTML (en `noindex`) ; `app/error.tsx` ne s'affiche qu'après le chargement du JavaScript. Sans JavaScript, le visiteur voit une page vide sous un statut 500.
- **Ce n'est pas un 503.** Next 14.2 ne permet pas à une page d'émettre un 503 ; le statut est 500. Pas d'en-tête `Retry-After`.
- `app/error.tsx` capte aussi toute erreur de rendu imprévue des pages publiques ; le détail technique n'est jamais affiché (seulement la référence `digest`).
- `app/error.tsx` ne couvre pas une erreur du gabarit racine (`global-error.tsx` non créé).
- `/omra-2027/` (avec barre finale) est d'abord normalisée par Next (308 vers `/omra-2027`) avant le 307 : deux sauts, paramètres conservés.
- `/omra-2027/<suffixe>` reste un 404 (aucun joker, voulu).
- Le passage de la redirection `/omra-2027` en 308 (mise en cache durable) exige une nouvelle autorisation.

## Preuves (locales, non production)
Tests unitaires (`tests/fallback-routes.test.ts`, `tests/public-errors.test.ts`, `tests/redirects.test.ts`) et parcours sur serveur Next de production local : `tests/e2e/fallback.e2e.mjs` (panne puis rétablissement, avec interrupteur de panne dans le faux Supabase) et `tests/e2e/fallback-nodb.e2e.mjs` (base non configurée). Ils ne prouvent rien sur le comportement réel de Vercel.
