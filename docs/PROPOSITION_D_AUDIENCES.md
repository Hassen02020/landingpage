# Proposition — Lot D : segments et audiences (22/11/2026)

**Statut : AUDIT ET PROPOSITION. Aucun code, aucune migration, aucune activation.** Le développement exige un GO distinct du propriétaire.

## 1. Audit (état de production au 22/11/2026)
- 8 segments existent (`lib/segments.ts`) : 3 de suivi (à traiter, relance 7 j, proposition sans réponse), 1 de région, et 4 « marketing » (perdus à reprendre, **Omra sans réservation**, VIP, clients ayant réservé). Règle de consentement déjà appliquée : un segment marketing n'inclut que les clients sans refus ni retrait du consentement marketing.
- **Aucune fonction d'export de segment ni d'envoi vers une plateforme publicitaire n'existe.** L'export CSV général (`/admin/export`) ne reprend pas les segments. Aucune audience n'est donc sortie du CRM aujourd'hui.
- **Écart de conformité :** le segment « Omra sans réservation » est de nature « marketing » et rien, dans le code, n'interdit de l'exporter le jour où un export existera. Selon la règle acceptée (22/11/2026), une demande d'Omra est une information interne : jamais d'audience publicitaire ni d'export vers Meta (audience personnalisée ou similaire) sans validation écrite du propriétaire.
- Les segments n'indiquent ni **taille estimée avec marge**, ni **provenance** des données, ni **fiabilité**, et il n'existe pas de **registre de validation humaine** avant activation.

## 2. Proposition (par étapes, chacune avec son GO)
**D1 — Garde-fou de sensibilité (sans migration, petit).**
- Chaque segment porte un indicateur `sensitivity`: `none` ou `sensitive`. « Omra sans réservation » est `sensitive` (inférence religieuse). À l'avenir, tout segment fondé sur une donnée de santé, de religion, d'origine ou équivalente l'est aussi.
- Fonction pure `canUseForAdAudience(segment)` : refuse tout segment `sensitive`, et tout segment `suivi` (relances commerciales, pas des audiences). Test automatique qui échoue si un segment sensible devient exportable.
- Affichage : badge « Usage interne uniquement » sur ces segments.

**D2 — Fiche de segment : taille, provenance, fiabilité (sans migration).**
- Pour chaque segment : effectif, effectif éligible (consentement), **provenance** (formulaire, WhatsApp saisi, import), part de dossiers avec téléphone valide, et un **niveau de fiabilité** (faible / moyen / élevé) selon l'échantillon et la complétude. Sous un seuil d'effectif, afficher « échantillon trop petit » plutôt qu'un chiffre.
- Rien n'est exporté.

**D3 — Registre de validation humaine (migration, GO séparé).**
- Table `landing_audience_approvals` : segment, version des règles, effectif au moment de la validation, validé par, date, motif, décision (validé / refusé), expiration.
- Aucune activation possible sans une validation en cours de validité ; un segment sensible ne peut jamais être validé pour usage publicitaire (contrainte en base et dans le code).

**D4 — Préparation d'une audience (hors périmètre tant que non autorisé).**
- Production d'un fichier d'audience préparé pour **téléchargement manuel** par le propriétaire (chiffrement/hachage selon les règles de la plateforme), jamais d'envoi automatique ; consentement marketing exigé ; journal d'audit.

## 3. Ce que D ne fera jamais
- Construire ou exporter une audience à partir d'une donnée ou d'une inférence sensible ; activer sans validation humaine ; envoyer vers Meta ou TikTok sans GO ; utiliser un contact sans consentement marketing.

## 4. Décisions demandées au propriétaire
1. GO pour **D1 et D2** (sans migration, rapides) ?
2. D3 (registre) : durée de validité d'une validation (ex. 30 jours) ?
3. D4 : souhaitez-vous un jour exporter des audiences (oui / non) ? Sinon D3 et D4 restent en veille.
