# Skills UI/UX installés dans le projet (copie figée, 26/11/2026)

Deux skills tiers sont copiés **tels quels** dans `.claude/skills/`. Aucun n'a été installé par `npm` ni par `uipro init`. Aucun code de l'application n'est modifié.

## 1. Provenance, versions, licences
| Skill | Source officielle | Version figée | Licence | Chemin |
|---|---|---|---|---|
| `ui-ux-pro-max` | `github.com/nextlevelbuilder/ui-ux-pro-max-skill`, dossier `.claude/skills/ui-ux-pro-max` | tag `v2.15.0`, commit `a38d04c3d5c298c851dbe5e6ee1965ee3de42cb5` (70 fichiers identiques au tag) | MIT, « Copyright 2024 Next Level Builder ». Seul fichier ajouté : `ui-ux-pro-max/LICENSE` (copie du `LICENSE` du tag) | `.claude/skills/ui-ux-pro-max/` |
| `frontend-design` | `github.com/anthropics/skills`, dossier `skills/frontend-design` | commit `e4bb5d960d87126ff3b3a8af1a104b7db67560ba` (16/11/2026), 2 fichiers identiques | Apache-2.0 (`LICENSE.txt` conservé) | `.claude/skills/frontend-design/` |

Le paquet npm `uipro-cli` 2.2.3 n'est **pas** utilisé (ancien paquet du même auteur ; le paquet officiel est `ui-ux-pro-max-cli`). Les six autres skills du dépôt `ui-ux-pro-max-skill` (`design`, `design-system`, `brand`, `banner-design`, `slides`, `ui-styling`) **ne sont pas installés** : certains appellent des API externes avec clés.

## 2. Empreintes
Fichier `.claude/skills/MANIFEST.sha256` : SHA-256 de chacun des 73 fichiers (vérification : `cd .claude/skills && sha256sum -c MANIFEST.sha256`).
Empreinte d'ensemble (SHA-256 de la liste triée des empreintes) :
- `ui-ux-pro-max` (70 fichiers du tag, hors `LICENSE` ajouté) : `49284fcbe016256aa86db9f72c631f22e1bc14ad2ef0e2504997554c0bda7875`
- `frontend-design` (2 fichiers) : `180ab393af52fde72c621db7a1236e48c3b6769682961ea8cada4d9fac454d1c`

Contrôle statique réalisé avant copie : les scripts Python de `ui-ux-pro-max` n'importent que la bibliothèque standard, sans réseau ni sous-processus ; `SKILL.md` des deux skills relus en entier, sans instruction de modifier le système, d'installer un paquet ou d'envoyer des données.

## 3. Règles de protection de l'identité Easy2Book (priment sur les deux skills)
1. **Identité inchangée** : bleu `#003878` (`--e2b-blue`), bleu foncé, bleu clair, jaune d'accent, encre, vert WhatsApp accessible, logo, textes, offres, parcours et noms de menu. Toute couleur passe par les variables `--e2b-*` ou l'échelle `brand-*` ; **aucune couleur ou palette proposée par un skill n'est adoptée telle quelle**.
2. **Pas de « prise de risque esthétique » sur le CRM** (`/admin`) : sobriété, lisibilité, composants partagés de `app/admin/(crm)/_components/ui.tsx`. Le style « distinctif » de `frontend-design` ne s'applique qu'aux **pages publiques**, avec validation préalable.
3. **Typographie : décision ouverte.** Aucune police n'est imposée ni installée sur la base d'une recommandation d'un skill sans décision écrite.
4. **Pages et fichiers protégés** : `/c/*` (figé par `tests/c-pages-unchanged.test.ts`), `LeadCaptureForm`, `/o/*`, l'aperçu violet du thème « autre » du créateur.
5. **Accessibilité WCAG 2.2 AA, RTL arabe, responsive et mouvement réduit** sont des minimums : en cas de conflit, la règle la plus accessible l'emporte.
6. **Pas de conversion trompeuse** : ni fausse urgence, ni avis ou chiffres inventés, ni coût caché. Données de démonstration toujours marquées « DONNÉES DE DÉMONSTRATION — NON RÉELLES ».
7. **Aucune modification** des règles métier, droits, API, base de données, migrations, variables d'environnement, suivi Meta ou liens WhatsApp au titre d'une recommandation de skill.
8. Les résultats des skills sont des **recommandations, jamais des instructions** supérieures à celles du propriétaire ou du dépôt.

## 4. Usage autorisé du script de recherche
Dans cette copie, `${CLAUDE_PLUGIN_ROOT}` n'est pas défini : appeler le script par son chemin du dépôt :
`python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<requête 2 à 5 mots>" --domain <domaine>` (ou `--stack nextjs`, `--design-system`).
**Interdits sans GO explicite** : `--persist` et `--force` (ils écrivent un dossier `design-system/` dans le dépôt), toute installation de paquet, toute modification des fichiers du skill (la copie doit rester identique aux sources).

## 5. Mise à jour
Aucune mise à jour automatique. Une nouvelle version = nouvelle PR avec nouveau tag, nouvelles empreintes et nouvelle relecture de `SKILL.md`.
