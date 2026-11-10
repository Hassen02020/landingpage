# Audit — leads multicanaux instantanés (10/11/2026)

Lecture seule du dépôt (aucun fichier de code modifié par l'audit). Décision fonctionnelle du propriétaire : un prospect qui se manifeste sur Facebook, Instagram, TikTok, le site ou WhatsApp arrive automatiquement dans le CRM. Un **clic** sur un bouton WhatsApp n'est **pas** un message reçu : aucun lead n'est créé à partir d'un clic.

Statuts : PASS · FAIL · BLOQUÉ (accès ou décision externe) · À VALIDER.

## A0 — État du dépôt
| Contrôle | Statut | Remarque |
|---|---|---|
| `main` à jour, CI verte | PASS | |
| PR ouvertes | PASS | Seule la PR n° 1 (PETORA, autre projet) : **ne jamais fusionner** |
| Documentation vs code | À CORRIGER (fait dans cette PR) | ROADMAP : Meta (jeton invalide) et TikTok (non connecté) étaient périmés |

## A1 — Collecte actuelle
| Contrôle | Statut | Preuve |
|---|---|---|
| Circuit unique des formulaires | PASS | `handleLeadPost` (`lib/server/lead-intake.ts`) |
| Nom, téléphone, consentement de recontact obligatoires | PASS | validation serveur |
| Anti-doublons en base | PASS | index uniques `(organization_id, idempotency_key)` et `(organization_id, phone, product, lead_day)` |
| Source et campagne conservées | PASS | `channel`, `utm_*`, `adset_id`, `ad_id`, `first_channel` |
| Réception réelle en production | À VALIDER | jamais testée sans créer de faux prospect |
| Service de création utilisable par un webhook | FAIL | couplé à la requête du formulaire (origine, anti-robot) → à extraire (Lot 1) |
| Identifiant externe du lead (Meta, TikTok) | FAIL | aucune colonne ; `idempotency_key` peut le porter sans migration |
| Anti-doublon mémoire et limite de débit | À VALIDER | non partagés entre instances ; seule la contrainte en base protège vraiment |

## A2 — Meta (Facebook, Instagram)
| Contrôle | Statut |
|---|---|
| Pixel + API des conversions (envoi) | PASS (actifs le 10/11/2026) |
| Webhook `leadgen`, signature `X-Hub-Signature-256`, récupération du formulaire | FAIL (rien dans le code) |
| Application Meta, autorisations, jeton de Page, abonnement au webhook | BLOQUÉ (propriétaire) |
| Formulaires instantanés existants | À VALIDER |

## A3 — TikTok
| Contrôle | Statut |
|---|---|
| Pixel + Events API (envoi) | PASS (actifs le 10/11/2026) |
| Réception de leads, webhook, Lead ID | FAIL |
| Application développeur, Marketing API | BLOQUÉ (compte annonceur « Easy2ook_adv » : contrat non actif, vérification demandée) |
| Leads Center | À VALIDER (vide, aucun formulaire) |

## A4 — WhatsApp
| Contrôle | Statut |
|---|---|
| Liens, rattachement par référence, clic distingué du message | PASS (`docs/WHATSAPP.md`) |
| Webhook entrant (signature, idempotence) | FAIL (non codé, par choix : pas de faux entrant) |
| API officielle (WABA, numéro, jeton, conservation) | BLOQUÉ (propriétaire) |

## A5 — Sécurité et conformité
| Contrôle | Statut |
|---|---|
| Leads et réglages cloisonnés par entreprise (RLS) | PASS |
| Jetons chiffrés, jamais renvoyés à l'écran | PASS |
| Rattacher un événement entrant à la bonne entreprise (page, compte) | FAIL (à concevoir) |
| Authentification propre des webhooks | FAIL : la vérification d'origine laisse passer les appels sans `Origin` → signature obligatoire |
| Consentement des leads de formulaires publicitaires | À VALIDER (texte légal de la plateforme à conserver) |
| Conservation (24 mois / 36 mois) et politique de confidentialité | À VALIDER (la politique ne mentionne que les formulaires du site) |
| Journal des événements reçus, états, reprises | FAIL (aucune table : migration nécessaire, Lot 5) |

## Conclusions
- **Sans accès externe** : Lot 1 (service central, identifiant externe via la clé d'idempotence, tests avec charges simulées **déclarées comme telles**), puis squelettes sécurisés des webhooks.
- **Bloqué côté propriétaire** : application Meta (leads, Page), application TikTok + compte annonceur actif, WhatsApp Business.
- Aucune certification d'un canal n'est possible sans lead réel de test reçu dans le CRM.

## Prérequis propriétaire par canal
| Canal | À fournir |
|---|---|
| Meta | Application Business, permissions de leads et de Page, jeton de Page, abonnement `leadgen`, formulaire de test |
| TikTok | Application développeur, compte annonceur actif (vérification), Instant Form de test |
| WhatsApp | Compte WhatsApp Business, numéro, jeton permanent, décision de conservation du texte |

## Règles non négociables
Prénom + téléphone au premier contact (e-mail facultatif) ; consentement de recontact enregistré ; source et identifiants publicitaires conservés ; un événement externe ne crée jamais deux leads ; aucune fuite entre entreprises ; EasyV4 reste indépendant.

## Lot 1 — socle central (10/11/2026) : CODE ÉCRIT + TESTÉ (charges simulées) — NON ACTIVÉ
Aucune route de webhook n'est exposée : rien n'est atteignable depuis Internet, rien n'est actif en production.

| Élément | Fichier | Preuve |
|---|---|---|
| Service d'enregistrement d'un lead externe (entreprise passée explicitement ; idempotence `plateforme:identifiant` ; consentement de recontact obligatoire ; aucun identifiant publicitaire personnel ; pas d'événement « Lead » renvoyé aux plateformes) | `lib/server/inbound-leads.ts` | `tests/inbound-leads.test.ts` (10), `tests/inbound-leads-tenant.test.ts` (3, vérifié par sabotage) |
| Signature Meta `X-Hub-Signature-256`, vérification d'abonnement `hub.challenge`, signature horodatée anti-rejeu | `lib/server/webhook-auth.ts` | `tests/webhook-auth.test.ts` (8) |

Limites déclarées : les charges de test sont **simulées** ; la réception réelle d'un lead Facebook, Instagram, TikTok ou WhatsApp n'est **pas prouvée**. Le schéma de signature TikTok est **à confirmer** dans la documentation officielle avant de brancher `verifyTimestampedHmac`. Rattachement page/compte → entreprise, journal des événements (migration) et routes : lots suivants, après les accès externes.
