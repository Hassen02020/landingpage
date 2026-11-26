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

## Composants (chantier E8) — `app/components/easy2book/`
Briques d'affichage prop-driven, sans suivi ni logique CRM (textes, liens et gestionnaires de clic viennent de la page).

| Composant | Rôle | Remarques |
|---|---|---|
| `Easy2BookButton` | bouton / lien (`brand`, `whatsapp`, `page`) | couleurs = variables `--e2b-*` |
| `Easy2BookWhatsAppCTA` | appel WhatsApp | vert accessible, `noopener`, suivi fourni par la page |
| `Easy2BookHeader` / `Easy2BookFooter` | en-tête et pied de page compacts | pied de page en `fr` / `en` / `ar` ; **logo transparent sur fond clair (aucune plaque)**, réseaux sociaux officiels (`lib/social-links.ts`), aucun texte ne répète « Centrale de réservation » (déjà dans le logo) |
| `Easy2BookHero` | hero « split » (texte + média vertical) | titre en deux temps (accent jaune), ambiance par famille |
| `Easy2BookOfferCard` / `Easy2BookPriceCard` | carte d'offre complète / carte de prix compacte | aucun calcul : le prix vient de la page |
| `Easy2BookTrustSection` | cartes de réassurance (icônes ou numéros) | texte brut échappé |
| `Easy2BookConditionsBand` | avantages et conditions | 1 à 8 blocs |
| `Easy2BookFAQ` | questions fréquentes | `<details>` natif |
| `Easy2BookLeadForm` | enveloppe d'affichage de `LeadCaptureForm` | **la chaîne CRM n'est pas dans le composant** |
| `Easy2BookMascot` | mascotte EAZY | **n'affiche rien sans fichier officiel** (aucun remplaçant) |

Le pied de page du site (`SiteFooter`) accepte `lang` (`fr` par défaut) : en arabe, textes arabes, sens droite-gauche, téléphone en `dir="ltr"`, ni majuscules ni espacement des lettres.

### Ambiances par produit (`lib/design-system/ambiance.ts`)
Omra, hôtels, vols, bateaux, transferts, attractions, packages, voyages organisés. **Seule la surface varie.** Omra = crème chaud déjà validé (`--e2b-surface-omra`). Les sept autres reprennent le bleu clair de marque et sont marquées « à valider » tant que le propriétaire n'a pas approuvé leur ambiance avec ses photographies.

## Page de référence
La page Omra Ramadan complet (`/p/omra-ramadan-complet`) utilise ces composants ; les pages de départ (`/p/omra-foj-*`) utilisent le même formulaire, la même FAQ, les mêmes cartes et le pied de page du site en arabe.

## Ce qui n'a pas changé
CRM, formulaire, consentements, attribution, `noindex`, pages `/c` et `/omra`, `SiteHeader` / `SiteFooter` partagés avec le reste du site.

## Espace équipe (CRM) — LOT 1 de la modernisation frontend (26/11/2026)

Décision du 25/11/2026 : bleu CRM `#003878`. Le CRM était en violet (`violet-*`, 47 fichiers) ; il reprend désormais l'identité.

### Échelle `brand-*` (source unique : `app/globals.css`, exposée dans `tailwind.config.ts`)
Nuances **dérivées** de `--e2b-blue` ; trois d'entre elles sont les couleurs officielles existantes.

| Classe | Variable | Valeur | Usage |
|---|---|---|---|
| `brand-50` | `--e2b-blue-50` | `#f3f7fc` | fond des badges « en cours », survols |
| `brand-100` | `--e2b-blue-soft` | `#e4edf9` | surfaces secondaires |
| `brand-200`…`400` | `--e2b-blue-200…400` | `#c9daf0`, `#9dbbe3`, `#5f8fcc` | bordures, filets, titres de groupes du menu (sur fond foncé) |
| `brand-500` | `--e2b-blue-500` | `#2d66ad` | anneau de focus clavier |
| `brand-600` | `--e2b-blue-600` | `#124d93` | avatars, filets d'indicateurs |
| `brand-700` | `--e2b-blue` | `#003878` | boutons principaux, liens |
| `brand-800` | `--e2b-blue-dark` | `#00285a` | menu latéral, survol des boutons, pages connexion / 404 / erreur |
| `brand-900`, `950` | `--e2b-blue-900`, `-950` | `#001d42`, `#00122b` | texte très foncé, réserve |

Contrastes vérifiés par `tests/design-system-crm.test.ts` (blanc sur 500/600/700/800 ≥ 4,5:1 ; titres du menu ≥ 4,5:1 ; focus jaune sur le menu ≥ 3:1). Le jaune reste un accent : filet sous le logo du menu, focus sur fond foncé.

### Statuts par phase (`app/admin/format.ts`, composant `StatusBadge`)
Présentation seule : libellés et règles restent ceux de `lib/status.ts`.

| Phase | Statuts | Couleur |
|---|---|---|
| À traiter | Nouveau, À contacter | ambre |
| En cours | Contacté → En négociation | bleu de marque, de plus en plus soutenu |
| Vendu | Réservé (clair), Gagné (plein) | vert |
| Perdu | Perdu | gris |

Chaque badge porte un point et le libellé, et annonce la phase aux lecteurs d'écran ; la couleur n'est jamais la seule information. Les colonnes du pipeline utilisent la même palette.

### Composants partagés (`app/admin/(crm)/_components/ui.tsx`)
`StatusBadge`, `PageHeader`, `KpiCard` (valeur fournie par la page, filet + libellé), `FilterChip` (`aria-current`), `Notice` (`role="status"` / `role="alert"` pour une erreur), `EmptyState` (vide réel, jamais un zéro trompeur), `Skeleton`, classes `fieldCls` / `primaryBtnCls` / `secondaryBtnCls`. Erreur de chargement : `LoadError` (existant). Montants affichés : `formatTnd` (`app/admin/format.ts`, affichage seul, aucun calcul).

Règles : affichage seul (aucune lecture de données, aucun droit) ; une donnée interdite à un rôle **n'est pas transmise** au composant (contrôle serveur), jamais masquée en CSS.

**Pas de `loading.tsx` au niveau des routes de l'espace équipe** : il ferait passer en HTTP 200 les 404 neutres (dossier d'un collègue, client inconnu). `Skeleton` est réservé à des zones `Suspense` internes. Garde-fou dans `tests/design-system-crm.test.ts`.

### Focus et mouvement
`.admin-root :focus-visible` : anneau de 3 px `brand-500` (jaune sur le menu foncé) ; `prefers-reduced-motion` respecté dans le CRM.

### Exception
`createur/modeles` garde le dégradé violet de la famille « autre » : c'est l'aperçu d'un thème de landing page (`lib/page-builder/style.ts`), pas la couleur du CRM. `/o/[slug]` (page d'une autre entreprise) n'est pas passé au bleu Easy2Book.
