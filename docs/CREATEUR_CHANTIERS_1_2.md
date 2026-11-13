# Créateur de Landing Pages — chantiers 1 et 2 : constats et protection de l'existant

Base : branche locale `feat/createur-landing-pages` (départ `c62fc2e`, qui contient la phase A non poussée). Aucun code de production n'a été modifié par ces deux chantiers : seulement des tests et ce document.

## Chantier 1 — Sécurité multi-entreprises (preuves : `tests/e2e/multi-links.e2e.mjs`)
Essai sur serveur Next de production local + faux Supabase multi-entreprises (Easy2Book + « Bob SARL »). **Un essai simulé ne prouve rien sur la production.**

### Garanties vérifiées (toutes ✓)
- Le générateur de B ne montre aucun nom de page d'Easy2Book ; celui d'Easy2Book ne montre aucune page de B.
- Collision d'adresse (`/c/collision-x` existe chez les deux) : le site public sert la page d'**Easy2Book**, jamais le contenu de B.
- Un prospect arrivé par `/c/…` est enregistré chez Easy2Book et chez personne d'autre ; un prospect arrivé par `/o/bob-sarl` est enregistré chez B et jamais chez Easy2Book.
- Sur `/c/…`, les UTM (campagne, source, contenu), le canal et la page d'arrivée sont conservés jusqu'au prospect.

### Défauts constatés (aucun n'est corrigé en silence)
| # | Défaut | Preuve | Correction nécessaire |
|---|---|---|---|
| 1 | La catégorie de B est proposée par son générateur (`/c/bob-ete`) mais **n'est pas servie** : le site renvoie vers `/voyages-organises` (page d'Easy2Book ; 404 sur `main`). | e2e : HTTP 307 → `/voyages-organises` | Ne proposer à B que des destinations réellement servies pour B. |
| 2 | Le générateur de B propose les **pages fixes d'Easy2Book** (`/`, `/omra`, `/voyages-organises`, `/summer-vibes`) : elles mènent au site et au CRM d'Easy2Book. | e2e : destinations de B = `/ /omra /voyages-organises /summer-vibes /c/bob-ete /c/collision-x` | Idem : le contexte de l'entreprise doit filtrer les destinations. |
| 3 | **Collision d'adresse** : B qui crée `collision-x` obtient un lien qui mène à la page d'Easy2Book. | e2e | Idem + empêcher qu'une entreprise non plateforme obtienne un lien `/c/…`. |
| 4 | Sur `/o/<entreprise>`, **les paramètres de campagne sont perdus** avant d'arriver au prospect (campagne, source, canal vides ; seule la page du formulaire est conservée). | e2e : prospect de B : campagne ∅, source ∅, canal ∅ | Le formulaire `/o` doit envoyer les paramètres de l'adresse au moment de l'envoi. |
| 5 | **Effet de la phase A sur `/c`** : le secours de `/c/<inconnu>` redirige vers `/voyages-organises` (page d'Easy2Book) — y compris pour une adresse de B. *(Pour `/o/<entreprise>`, la redirection a été retirée : 404 neutre, décision du propriétaire.)* | e2e (défaut 1) | Le secours de `/c` dépend du contexte : jamais vers une page d'une autre entreprise. |

### Décision d'architecture pour le créateur (conforme à votre règle « jamais un lien vers une autre entreprise »)
Le **créateur publie dans `/p/<adresse>` (comme `/c/<adresse>`), servi uniquement pour Easy2Book**. Il est donc **réservé à l'organisation de la plateforme** et refuse (côté serveur) toute autre entreprise avec un message clair, tant que les défauts 1 à 5 ne sont pas tranchés. Les autres entreprises gardent leurs formulaires `/o/…`.

## Chantier 2 — Inventaire des liens existants (preuves : `tests/links-inventory.test.ts`, 23 tests)
### Routes publiques (à ne jamais retirer)
`/`, `/omra`, `/voyages-organises`, `/summer-vibes`, `/c/<adresse>`, `/o/<entreprise>`, `/confidentialite`, `/mentions-legales`. Redirections : `/c/omra-2027` → `/omra` (dans la page), `/omra-2027` → `/omra` (307, `next.config.mjs`). API publiques : `/api/leads`, `/api/o/<entreprise>/leads`, `/api/track`.

### Formats de lien (figés par les tests)
- Statique : `…/<page>?utm_source=<réseau>&utm_medium=<support>&utm_campaign=<nom>[&utm_content=<contenu>]`.
- Meta dynamique (Facebook, Instagram) : `utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}`.
- TikTok dynamique : `utm_campaign=__CAMPAIGN_NAME__&utm_term=__AID_NAME__&utm_content=__CID_NAME__&campaign_id=__CAMPAIGN_ID__&adset_id=__AID__&ad_id=__CID__`.
- Liens de bio : Instagram / TikTok (`utm_medium=bio`), Facebook (`utm_medium=organic_social`), campagne `bio`.
- Anciens formats du README (`utm_source=instagram_bio`, `tiktok_bio`, `whatsapp`) toujours reconnus ; `fbclid`, `ttclid`, `gclid` prioritaires.

### Requêtes de production — LECTURE SEULE (à exécuter par vous, jamais en écriture)
Agrégats sans donnée personnelle, pour connaître les adresses et campagnes réellement en circulation :
```sql
-- pages d'arrivée et campagnes des 120 derniers jours
SELECT landing_page, coalesce(utm_source,'-') AS source, coalesce(utm_campaign,'-') AS campagne, count(*) AS prospects, max(created_at) AS dernier
FROM landing_leads WHERE created_at > now() - interval '120 days'
GROUP BY 1,2,3 ORDER BY prospects DESC;

-- visites enregistrées (consentement) par page logique et campagne
SELECT niche, coalesce(utm_campaign,'-') AS campagne, count(*) AS evenements
FROM landing_events WHERE created_at > now() - interval '120 days'
GROUP BY 1,2 ORDER BY evenements DESC;

-- catégories existantes et leur visibilité (adresses à protéger)
SELECT slug, visible, updated_at FROM landing_categories ORDER BY slug;
```
À compléter par vous : les adresses de destination des annonces actives dans Meta / TikTok Ads Manager. Ces listes ne couvrent que les visiteurs ayant rempli le formulaire.

## Statut des défauts après correction locale (suite de la décision du propriétaire)

| # | Défaut | Statut | Preuve | Reste à décider |
|---|--------|--------|--------|-----------------|
| 1 | Catégorie de B proposée mais non servie | **CORRIGÉ (côté générateur)** : B ne reçoit plus que `/o/<son-slug>` | `tests/e2e/multi-links.e2e.mjs` (15 ✓), `tests/links-context.test.ts` | Servir réellement les catalogues d'entreprises (`/c`, `/p` hors Easy2Book) = décision d'architecture (hors MVP) |
| 2 | Pages fixes d'Easy2Book proposées à B | **CORRIGÉ** : aucune page fixe, aucun lien de bio, aucun `/c/…` pour une entreprise | idem | — |
| 3 | Collision d'adresse | **ATTÉNUÉ SANS MIGRATION** : B n'obtient aucun lien `/c/…` ; la collision au niveau des données n'est pas bloquée sans décision d'architecture | idem | Unicité globale des adresses de pages ou préfixe par entreprise (migration éventuelle, non créée) |
| 4 | Paramètres de campagne perdus sur `/o` | **CORRIGÉ** : l'attribution est lue dans l'adresse à l'envoi (sans identifiants de clic ni jeton) | `tests/url-attribution.test.ts` (7), e2e multi-links | — |
| 5 | Secours `/c` vers une page d'Easy2Book pour l'adresse de B | **NON MODIFIÉ** (rendu `/c` protégé avant inventaire) ; sans effet pour B puisqu'il n'obtient plus de lien `/c/…` | — | À traiter avec le service multi-entreprises des catalogues |

Défaut supplémentaire trouvé et corrigé pendant la vérification : la destination initiale du générateur était codée « `/` », absente de la liste d'une entreprise → aucun lien généré pour B. Corrigé (`LinkBuilder.tsx`), couvert par le e2e.

## Audit des adresses entre entreprises (phase de finalisation)
- **Deux entreprises peuvent-elles avoir la même adresse ?** Par conception oui au niveau des données : l'unicité est `(organization_id, slug)` (migrations 0010/0011 ; état réel en production NON VÉRIFIÉ, requête (c) de `INVENTAIRE_PAGES_C.md`). Prouvé en test : `collision-x` existe chez Easy2Book ET chez B.
- **Une collision ouvre-t-elle la page d'une autre entreprise ?** Non. `/c/collision-x` sert uniquement la page d'Easy2Book (le contexte public est fixé sur Easy2Book) ; le contenu de B n'est jamais servi (e2e `multi-links`, vérification « JAMAIS le contenu de B »).
- **Isolation côté serveur :** la couche d'accès à la base ajoute `organization_id=eq.<contexte>` à toute lecture/modification, impose `organization_id` aux insertions et refuse tout filtre ou changement visant une autre entreprise, ainsi que toute requête sans contexte (`tests/tenant-db.test.ts`, 20+ cas dont requêtes simultanées de deux entreprises).
- **Consultation/modification des données d'une autre entreprise :** refusée par cette couche ; e2e `multi-tenant` : 133 ✓ (isolation des prospects, API, suspension, 404 neutre). Preuves sur FAUX Supabase : elles ne prouvent rien sur la production.
- **Contrainte d'unicité globale :** NON créée (aucune migration). Solution à présenter pour autorisation séparée : conserver `(organization_id, slug)` et laisser le Créateur réservé à Easy2Book ; une unicité globale des adresses de pages publiques ne serait nécessaire qu'à l'ouverture aux agences.
