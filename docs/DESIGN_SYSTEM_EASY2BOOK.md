# Identité Easy2Book — fondations (chantier E3)

Décision du propriétaire (15/11/2026) : le bleu de référence est celui **mesuré sur le logo officiel**. Aucune charte écrite n'existe dans le dépôt : les valeurs ci-dessous viennent des pixels de `public/logo.png` et restent à confirmer par une charte officielle le jour où elle existe.

## Couleurs (source unique : `app/globals.css`, variables `--e2b-*`, reprises dans `tailwind.config.ts` sous `e2b.*`)

| Variable | Valeur | Usage |
|---|---|---|
| `--e2b-blue` | `#003878` | couleur principale : boutons, titres, pied de page |
| `--e2b-blue-dark` | `#00285a` | survol, pied de page |
| `--e2b-blue-soft` | `#e4edf9` | fonds secondaires, surfaces |
| `--e2b-yellow` | `#f0c848` | accents (filets, surlignage, pastilles). **Jamais en texte sur fond clair** (contraste insuffisant) |
| `--e2b-ink` | `#0b1b3a` | texte principal |
| `--e2b-wa` | `#0e7a3c` | bouton WhatsApp (texte blanc 5,43:1, WCAG 2.2 AA) |

Règles : blanc pour la lisibilité ; jaune pour l'énergie ; une page de produit ne change **ni** le bleu, **ni** le jaune, **ni** le logo. Seule l'ambiance varie (photographie, fond bleu clair, motif discret).

## Logo
`public/logo.png` (512×512, fond transparent). Sur fond foncé, le poser sur une plaque blanche arrondie (comme dans le pied de page). Ne pas le déformer, le recolorer ni le recadrer.

## Typographie
**Non décidée.** Aujourd'hui : police du système. Une famille arabe + latin hébergée avec le site sera proposée avant adoption (écart n°13 du rapport d'audit). Aucune police n'est donc imposée par E3.

## Mascotte EAZY
**Ressource absente** du dépôt, du prototype `Easy2Book-omraramdhan2027` et des fichiers reçus. Elle n'est ni générée ni redessinée : le composant `Easy2BookMascot` attend les fichiers officiels (PNG ou SVG transparents).

## Composants
E3 pose l'en-tête compact et le pied de page de marque sur les pages du Créateur (`LandingView.tsx`, mise en page « split »), avec les variables ci-dessus. L'extraction en composants réutilisables (Header, Footer, Button, Hero, OfferCard, PriceCard, TrustSection, FAQ, LeadForm, WhatsAppCTA, Mascot) est le chantier E8, non commencé.

## Ce qui n'a pas changé
CRM, formulaire, consentements, attribution, `noindex`, pages `/c` et `/omra`, `SiteHeader` / `SiteFooter` partagés avec le reste du site.
