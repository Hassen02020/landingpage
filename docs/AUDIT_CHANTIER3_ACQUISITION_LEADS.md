# Chantier 3 — Acquisition automatique des leads (Facebook, Instagram, TikTok, WhatsApp)

Audit **OBSERVE → AUDIT → GAP** — 14/11/2026. Lecture seule : aucun code, aucune migration, aucune variable, aucun déploiement modifiés.
Complète `docs/AUDIT_LEADS_MULTICANAUX.md` (10/11/2026) en revérifiant le code de `main` (`22a7078`) et la production.

Statuts : PASS · FAIL · BLOQUÉ (accès ou décision du propriétaire) · À VALIDER.
Règle : **code écrit ≠ testé ≠ intégration connectée ≠ lead réel reçu**. Aucun canal n'est certifié tant qu'un lead réel de test n'est pas arrivé dans le CRM.

---

## 1. OBSERVE — ce qui existe réellement

### 1.1 Code (main `22a7078`)
| Élément | Fichier | Observation |
|---|---|---|
| Service central d'enregistrement d'un lead externe | `lib/server/inbound-leads.ts` | Entreprise passée explicitement ; clé d'idempotence `plateforme:identifiant` (3–100 caractères sûrs) ; prénom ≥ 2 caractères et téléphone valide obligatoires ; consentement de recontact obligatoire ; aucun identifiant publicitaire personnel ni IP ; trace « created » dans l'historique ; notification de l'équipe seulement pour l'organisation plateforme. |
| Authentification des webhooks | `lib/server/webhook-auth.ts` | Signature Meta `X-Hub-Signature-256` (HMAC-SHA256 sur le corps brut, comparaison à temps constant) ; vérification d'abonnement `hub.challenge` ; HMAC horodaté générique (tolérance 300 s) **non branché**, « à confirmer » pour TikTok. |
| Webhook Facebook / Instagram | `app/api/webhooks/meta-leads/route.ts`, `lib/server/meta-leads.ts` | Signature → événements `leadgen` → page rattachée à UNE entreprise → lecture du lead par l'API Graph (v21.0, jeton de Page en en-tête) → service central. Reprise (500) sur erreur temporaire ; 200 sur erreur permanente. |
| Pages Facebook par entreprise | `lib/server/meta-pages.ts`, carte « Meta — formulaires instantanés » (`/admin/integrations`) | Jeton chiffré, jamais réaffiché ; confirmation du propriétaire que le formulaire demande l'accord de recontact. |
| TikTok | `lib/server/tiktok.ts` | **Envoi** d'événements (Events API) uniquement. Aucune réception de leads. |
| WhatsApp | `docs/WHATSAPP.md`, `lib/server/crm.ts` | 38 liens `wa.me` avec référence `E2B-XXXXXX` ; rattachement **manuel** (message collé, échanges saisis `wa_in` / `wa_out`). Aucun webhook entrant. |
| Tests | `inbound-leads`, `inbound-leads-tenant`, `meta-leads` (16), `meta-pages` (5), `migration-0015` (7), `webhook-auth` (8) | Charges **simulées** ; sabotages vérifiés (entreprise forcée, signature non vérifiée, consentement non exigé). |

### 1.2 Production (vérifié le 14/11/2026, lecture seule)
| Contrôle | Résultat |
|---|---|
| `GET /api/webhooks/meta-leads?hub.mode=subscribe…` | **404** (route inerte) |
| `POST /api/webhooks/meta-leads` sans signature | **404** |
| Variables Vercel (production) | `META_APP_SECRET` et `META_LEADS_VERIFY_TOKEN` **absentes** ; `META_ACCESS_TOKEN`, `META_PIXEL_ID`, `ETA_PIXEL_ID` présentes (envoi d'événements) ; aucune variable TikTok ni WhatsApp de réception |
| Table `landing_meta_pages` (migration 0015) | **Absente** (migration non appliquée) |
| Table de journal des événements entrants | **Absente** (aucune migration écrite) |
| Leads existants | 7, tous issus du site ; **aucun lead reçu d'un canal externe** |
| Isolation | RLS forcée sur toutes les tables `landing_*` ; 2 organisations (`easy2book`, `indviduelel`) |

### 1.3 Flux cible (tel que le code le prévoit)
```
Facebook / Instagram  →  webhook leadgen (signé)  →  page → entreprise  →  API Graph  →  ingestExternalLead  →  CRM
TikTok                →  (rien)
WhatsApp              →  (rien ; rattachement manuel d'un message collé)
```

---

## 2. AUDIT — contrôles par canal

### 2.1 Facebook et Instagram (un seul circuit : formulaire instantané de Page, `platform = ig` pour Instagram)
| Contrôle | Statut | Remarque |
|---|---|---|
| Signature vérifiée sur le corps brut avant tout traitement | PASS (test) | 401 si absente ou fausse |
| Route inerte tant que les variables sont absentes | PASS (production) | 404 constaté |
| Rattachement lead → entreprise par la Page (jamais par la charge utile) | PASS (test) | |
| Idempotence : même événement deux fois = un lead | PASS (test) | Base : `(organization_id, idempotency_key)` |
| Consentement : lead refusé si la page n'est pas confirmée | PASS (test) | |
| Application Meta (Webhooks, objet « Page », champ `leadgen`), permissions de lecture des leads et de la Page, abonnement | BLOQUÉ | Propriétaire |
| Jeton de Page (durée de vie, rotation) | BLOQUÉ / À VALIDER | Voir G6 |
| Migration 0015 | À APPLIQUER (au démarrage) | Écrite, testée sur PGlite, retour arrière présent |
| Réception réelle d'un lead | NON PROUVÉ | Aucun accès Meta utilisé |

### 2.2 TikTok
| Contrôle | Statut |
|---|---|
| Envoi pixel + Events API | PASS (actif depuis le 10/11) |
| Réception de leads (Instant Form, Leads Center) | FAIL (rien dans le code) |
| Schéma de signature des webhooks TikTok | À VALIDER — `verifyTimestampedHmac` ne doit pas être branché avant confirmation dans la documentation officielle |
| Compte annonceur (« Easy2ook_adv »), application développeur, Marketing API | BLOQUÉ (vérification demandée, contrat non actif) |

### 2.3 WhatsApp
| Contrôle | Statut | Remarque |
|---|---|---|
| Liens, référence, clic distingué du message | PASS | `whatsapp.e2e` : 38 liens |
| Webhook entrant (messages, statuts) | FAIL | Non codé par choix : pas de faux message entrant |
| Signature | PASS (réutilisable) | Le webhook WhatsApp Cloud API est signé par `X-Hub-Signature-256` : `verifyMetaSignature` s'applique |
| Compte WhatsApp Business (WABA), numéro, jeton permanent | BLOQUÉ | Propriétaire |
| Décision de conservation du texte des messages | BLOQUÉ | Propriétaire |
| Rattachement d'un message entrant à un lead existant (référence `E2B-…`) | FAIL en automatique | La logique existe pour la saisie manuelle (`crm.ts`), pas pour un flux entrant |

### 2.4 Transverse
| Contrôle | Statut |
|---|---|
| Cloisonnement par entreprise (RLS, entreprise passée explicitement) | PASS |
| Jetons chiffrés, jamais renvoyés à l'écran | PASS |
| EasyV4 non touché, aucune table EasyV4 en base | PASS |
| Journal des événements reçus, états, reprises | FAIL (aucune table) |
| Surveillance / alerte quand un lead est perdu | FAIL |
| Politique de confidentialité pour les formulaires publicitaires | À VALIDER (elle ne mentionne que les formulaires du site) |

---

## 3. GAP — écarts, risques et décisions

| # | Écart | Gravité | Cause / risque | Action proposée | Dépendance |
|---|---|---|---|---|---|
| G1 | **Pas de journal des événements entrants** | Élevée | Un événement « ignoré » (page non rattachée, consentement non confirmé) ou « abandonné » (jeton invalide, lead supprimé) disparaît : seulement un `console.warn` dans les logs Vercel. Aucune reprise ni réconciliation possible. | Migration 0023 `landing_inbound_events` (plateforme, identifiant externe, entreprise, état, code d'erreur, horodatage ; **sans donnée personnelle**), ajout seul, cloisonnée, serveur seulement ; écran de suivi. | Votre GO sur la migration |
| G2 | Migration 0015 non appliquée, variables Vercel absentes | Bloquant (activation) | Route inerte | Appliquer 0015 puis définir `META_APP_SECRET` et `META_LEADS_VERIFY_TOKEN` **seulement quand l'application Meta existe** | Propriétaire (Meta) |
| G3 | **TikTok : aucune réception** et signature non confirmée | Bloquant (canal) | Compte annonceur non vérifié | Reporter ; confirmer le schéma dans la doc officielle au moment de l'accès ; sinon repli : export / saisie depuis Leads Center | Propriétaire (TikTok) |
| G4 | **WhatsApp : aucun webhook entrant** et pas de rattachement automatique par référence | Bloquant (canal) | Pas d'accès API ; un message entrant ne doit pas créer un doublon si la référence `E2B-…` existe | Concevoir le rattachement (référence → lead existant, sinon nouveau lead « WhatsApp ») ; coder après l'accès | Propriétaire (WABA, conservation) |
| G5 | **Dédoublonnage trop agressif** | Moyenne — À VALIDER | `ingestExternalLead` fusionne un lead avec un autre du **même téléphone le même jour** (produit « autre »). Un second formulaire (autre campagne) le même jour ne crée pas de lead et sa campagne d'origine est perdue. | Décider : conserver la règle, ou rattacher la 2ᵉ source en activité sur le lead existant | Décision propriétaire |
| G6 | **Cycle de vie du jeton de Page** | Moyenne | Une erreur 190 (jeton invalide ou expiré) → 200 « abandonné » : les leads suivants sont perdus **sans alerte**. | Alerte sur échec répété + indicateur d'état sur la carte Meta (dépend de G1) ; procédure de rotation | G1 |
| G7 | **Aucune notification pour les entreprises hors plateforme** | Moyenne | `notifyTeam` ne s'applique qu'à l'organisation plateforme | Définir la notification par entreprise (e-mail / webhook) | Décision |
| G8 | `contact_channel` figé sur « whatsapp » et `product` figé sur « autre » pour tout lead externe | Moyenne — À VALIDER | Pas de lien formulaire → produit ; le canal de recontact est supposé WhatsApp | Associer formulaire / offre → produit (table de correspondance par page) ; valider que le recontact par WhatsApp est bien voulu | Décision |
| G9 | **Consentement et conservation** | À VALIDER (juridique) | Le consentement est celui du formulaire de la plateforme, confirmé par page ; la politique de confidentialité ne le mentionne pas ; durées de conservation (24 / 36 mois) à confirmer | Mettre à jour la politique ; conserver le texte légal du formulaire | Propriétaire |
| G10 | **Aucune preuve de réception réelle** | Élevée | Tous les tests sont simulés | Plan de test avec le **Lead Ads Testing Tool** de Meta sur une Page de test ; marquer clairement le lead de test et décider de son sort (voir §5) | Propriétaire |
| G11 | Aucune surveillance de santé des canaux (dernier lead reçu, taux d'échec) | Moyenne | Panne silencieuse possible | Indicateur « dernier événement reçu » par canal dans `/admin/integrations` | G1 |
| G12 | Cartes d'administration TikTok et WhatsApp absentes | Faible | Seule Meta a sa carte | À créer avec chaque canal | Après accès |
| G13 | Limites de débit en mémoire | Faible pour les webhooks | Protégés par signature, pas par débit ; limite taille du corps 256 ko présente | Aucune action spécifique | — |

---

## 4. Ordre de traitement proposé (sans dépendre d'un accès externe d'abord)

| Lot | Contenu | Dépend de | État |
|---|---|---|---|
| A | Décisions G5, G7, G8 (règles de fusion, notification, correspondance formulaire → produit) | Propriétaire | À décider |
| B | Migration **0023 journal des événements entrants** + écriture de l'état de chaque événement + écran de suivi (G1, G6, G11) ; tests PGlite et simulés | GO sur 0023 | À préparer |
| C | **Facebook / Instagram** : appliquer 0015, créer l'application Meta (propriétaire), définir les deux variables, abonner la Page, lead de test réel (G2, G10) | Propriétaire + lot B | Bloqué |
| D | Politique de confidentialité et conservation (G9) | Propriétaire | À décider |
| E | **TikTok** : confirmer la signature, coder la réception (G3) | Compte annonceur actif | Bloqué |
| F | **WhatsApp** : rattachement par référence, webhook entrant, carte d'administration (G4, G12) | WABA + conservation | Bloqué |

## 5. Ce que j'attends du propriétaire (liste de décisions et d'accès)
1. **Décisions** : règle de fusion des leads du même jour (G5) ; notification des entreprises non plateforme (G7) ; recontact par WhatsApp et correspondance formulaire → produit (G8) ; politique de confidentialité et conservation (G9).
2. **Accès** : application Meta Business avec Webhooks (objet « Page », champ `leadgen`) et permissions de lecture des leads et de la Page ; jeton de Page ; formulaire instantané de test ; compte annonceur TikTok vérifié ; compte WhatsApp Business et numéro. **Aucun secret n'est demandé dans la conversation** : les valeurs se saisissent dans Vercel ou dans l'écran d'administration.
3. **Lead de test réel** : accord explicite sur le fait qu'un lead de test entrera dans le CRM de production (je recommande un prénom reconnaissable « TEST … » et son anonymisation ensuite).

## 6. Interdictions respectées par cet audit
Aucune migration appliquée, aucune variable modifiée, aucun déploiement, aucune écriture en base, aucun faux lead, aucun appel à Meta, TikTok ou WhatsApp, EasyV4 non touché.
