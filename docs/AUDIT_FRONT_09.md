# Audit frontend du 09/11/2026 — suites données

Source : audit externe collé par le propriétaire (vérifié contre le code avant correction).

## Corrigé dans le code (PR « audit P1/P2 »)
| Constat | Correction | Test |
|---|---|---|
| Prix Omra incohérent (accueil « dès 4 800 » = offre Chawwal) | Accueil : « Ramadan dès 5 500 TND · Chawwal dès 4 800 TND » (valeurs de `app/omra/packages.ts`) | revue |
| Compte à rebours + « Places limitées » sans échéance fournisseur | Bloc d'urgence retiré, remplacé par « Conditions des promotions » visibles | e2e + revue |
| Note 4,9/5, +1200 réservations, +500 clients, témoignages codés en dur | Section retirée ; `aggregateRating` retiré du JSON-LD | `tests/seo.test.ts` |
| Promesses non prouvées (< 15 min, 24/7, meilleurs prix garantis, acompte, « tout inclus ») | Reformulées sans engagement chiffré (accueil, promos, FAQ, voyages) | revue |
| `sitemap.xml` et `robots.txt` en 404 | `app/sitemap.ts`, `app/robots.ts` (admin, API, `/o/`, `/c/` exclus) | `tests/seo.test.ts` |
| Canonical absent | `alternates.canonical` sur accueil (relatif `./`), voyages, Omra, promos | `tests/seo.test.ts` |
| Image de partage = logo | `public/og-easy2book.jpg` (1200×630) | — |
| `fb:page_id` = nom au lieu de l'ID numérique | Balise retirée (valeur invalide) ; à remettre avec l'ID numérique de la page | `tests/seo.test.ts` |
| `/confidentialite` en 404 | Page créée ; durées = purge SQL réelle (testé) ; lien dans le pied de page | `tests/seo.test.ts` |

## À faire par le propriétaire
1. **Pixels Meta/TikTok** : `/api/pixels` renvoie `null`. Cause possible : intégration désactivée dans Réglages › Intégrations, ou aucune ligne. Vérification en lecture seule à exécuter par le propriétaire :
   `select provider, enabled, pixel_id is not null as pixel_renseigne, organization_id from landing_integrations;`
   Activer/renseigner est une action propriétaire (aucun compte publicitaire connecté par Claude). Ensuite : test avec code d'événement de test, consentement et déduplication.
2. **Mentions légales** : fournir raison sociale, forme, matricule fiscal / RC, adresse, directeur de publication. Page non créée tant que ces informations manquent.
3. **Validité des promotions** : dates réelles et conditions par hôtel (Active Travel) ; tant qu'elles manquent, l'offre est « indicative, confirmée sur WhatsApp ».
4. **Preuves** (avis, nombre de réservations) avant de les réafficher.
5. **ID numérique de la page Facebook** pour `fb:page_id`.
6. **Photos réelles des hôtels** (aujourd'hui : vues de villes, Adobe Stock).

## Plan restant (non fait ici)
- P2 sécurité : Content-Security-Policy (d'abord en `Report-Only`, pixels et Turnstile à autoriser), limitation de débit centralisée, vérification Turnstile en production.
- P3 : mesure Lighthouse/Core Web Vitals sur le site en ligne, tests multi-écrans.
- Langue HTML d'Omra : `<html lang="fr">` global ; la page porte `lang="ar"` sur son conteneur.
- Certification du parcours complet formulaire → CRM → WhatsApp en production (sans créer de faux prospects : à faire avec un prospect de test déclaré).

## Mise à jour du 10/11/2026 — mentions légales
Informations communiquées par le propriétaire : raison sociale « Easy2Book Tarhouni Hassen », identifiant fiscal / RC « 1399210/02/Z », adresse « Avenue 28 Mars, Siliana, Tunisie », directeur de la publication « Tarhouni Hassen ». Source unique : `lib/legal.ts` (page `/mentions-legales`, politique de confidentialité, pied de page, sitemap). À faire par le propriétaire : confirmer que « 1399210/02/Z » est bien l'identifiant à publier (matricule fiscal ou RC) et, s'il le souhaite, ajouter une adresse e-mail de contact publique.
