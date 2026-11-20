# Module E-Visa (page « sur devis »)

Décisions du propriétaire (20/11/2026) : **aucun prix**, **aucun délai**, un **devis par destination avec la liste des pièces**, via un formulaire avec **liste de pays**. La vidéo finale sera fournie plus tard.

## Ce que le module fait
- **Modèle « E-Visa (sur devis) »** du Créateur : produit « autre », arabe, adresse `evisa` (la niche suivie dans les statistiques est l'adresse de la page : `evisa`).
- **Liste de destinations** propre à la page (réglage « Liste de destinations du formulaire », une par ligne, 80 maximum). Elle rend le choix de la destination **obligatoire** dans le formulaire ; la destination choisie est enregistrée dans le lead (colonne `destination`, comportement existant pour les pages d'Easy2Book).
- **Page sans offre ni prix** : la vérification avant publication accepte une page sans offre si une liste de destinations existe ; aucun prix, aucun lien « prix » ; FAQ dédiée (devis, « E-Visa ≠ voyager sans visa », autre destination, documents par WhatsApp).
- **Aucun document n'est collecté sur le site** : passeport, relevés, fiches de paie passent uniquement par WhatsApp.

## Liste des destinations
Source indiquée par le propriétaire : groupe « eVisa » du site myvisaport.com (43 destinations, vérification du 20/11/2026). **32 destinations** sont proposées ; les **11 signalées « source non officielle, non vérifiée »** par cette source (Botswana, Burkina Faso, Cameroun, RD Congo, Djibouti, Gabon, Nigeria, Sao Tomé-et-Principe, Sierra Leone, Soudan du Sud, Trinité-et-Tobago) passent par **« Autre destination (selon demande) »**. Les règles de visa changent : la faisabilité est toujours confirmée par un conseiller. La brochure du propriétaire annonce 53 destinations ; l'alignement complet reste à faire quand il fournira sa liste.

## Formulation
« Destinations disponibles en E-Visa » — jamais « pays sans visa ». L'acceptation finale relève exclusivement des autorités du pays concerné (texte de la brochure repris).

## Points ouverts (propriétaire)
- Frais consulaires ou gouvernementaux : non affichés (aucun prix).
- La vidéo (finale) et ses images : mention « contenu généré par IA » à vérifier avant les publicités Meta / TikTok.
- Conservation des pièces reçues par WhatsApp : à décider.
- Produit dédié « visa » (migration) : seulement si des statistiques séparées par produit sont voulues.

## Code
`lib/page-builder/themes.ts` (modèle, `EVISA_DESTINATIONS`), `design.ts` (`form.destinations`), `readiness.ts` (page sur devis), `faq.ts`, `LandingView.tsx`, `LeadCaptureForm.tsx` (`requireDestination`), `DesignEditor.tsx`. Tests : `tests/evisa-module.test.ts` (14).
