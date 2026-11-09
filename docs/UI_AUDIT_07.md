# Audit UI/UX du frontend public — chantier 07 (09/11/2026)

Méthode : site construit et servi en local sans base ; Playwright (mobile 390×844 et ordinateur 1366×860) ; axe-core (WCAG 2.x A/AA) ; mesure du poids, du CLS, des débordements horizontaux et des zones tactiles. Pages : `/`, `/omra`, `/voyages-organises`, `/summer-vibes`. Les captures sont des instantanés de travail (non versionnés).

## Ce qui était déjà bon
Aucun débordement horizontal ; un seul `h1` par page ; toutes les images ont un `alt` ; décalage de mise en page (CLS) nul ; titres et descriptions SEO présents ; images du bas de page chargées à la demande.

## Défauts trouvés et corrigés
| # | Défaut | Mesure avant | Correction |
|---|---|---|---|
| 1 | **Contraste insuffisant** des boutons verts (texte blanc sur #22c55e ou #25D366 : 2,3:1 et 2,0:1 ; minimum 4,5:1) — dont « Envoyer et continuer sur WhatsApp », « Accepter », « Réserver » | 5 à 44 éléments par page | Vert plus profond (#15803d, 5,0:1) ; survol #166534 |
| 2 | Texte gris clair (#9ca3af sur blanc 2,5:1 ; pied de page gris sombre sur noir 2,7:1) et couleurs d'accent de `/summer-vibes` (3,2:1 à 4,2:1) | 31 éléments | Gris 600 sur clair, gris 400 sur sombre ; accents assombris (≥ 4,5:1) |
| 3 | **Aucun repère de page** (`main`), pas de lien d'évitement ; boutons flottants hors repères | 10 à 33 régions par page | `<main id="contenu">`, lien « Aller au contenu » (visible au clavier), boutons flottants dans un repère « Contact WhatsApp » |
| 4 | Page arabe `/omra` déclarée en français | lecteurs d'écran mal prononcés | `lang="ar"` sur la page |
| 5 | Ordre des titres de `/summer-vibes` (h1 puis h3) | 1 | h2 |
| 6 | **Zones tactiles trop petites** (boutons de bandeau 38 px, liens du pied de page 20 px, filtres 36 px, points du carrousel 12 px) | 12 à 22 par page | 44 px pour les actions, 24 px minimum pour les cases et points (WCAG 2.2) |
| 7 | Focus clavier peu visible ; animations non réductibles | — | contour de focus net ; respect de « réduire les animations » |
| 8 | **Logo 3 750×3 750 px (1,4 Mo)** servi pour l'aperçu social et l'accueil | 1,4 Mo | 512×512 (75 Ko), même image |
| 9 | Image d'en-tête de `/voyages-organises` : 1 600 px envoyés à un mobile de 390 px | 1 055 Ko sur mobile | `srcset` (640 / 1 000 / 1 400 px) : 546 Ko sur mobile |

## Résultat (axe-core, 8 vues)
Défauts d'accessibilité : **15→0, 35→0, 63→0, 76→0**. Poids mobile : accueil 351→187 Ko, voyages 1 055→546 Ko.

## Restes (décisions ou travaux futurs)
- Les photos de `/voyages-organises` et `/summer-vibes` viennent d'un service tiers (Unsplash) : dépendance externe, chargement variable, aucune maîtrise du contenu. Recommandation : les héberger dans `/public` ou le catalogue (chantier dédié).
- Le vert WhatsApp est plus sombre que le vert officiel de la marque (nécessaire pour la lisibilité du texte blanc) : à valider visuellement.
- Pas de mesure Lighthouse réelle (réseau du banc de test limité) : à refaire sur le site en ligne après déploiement.
