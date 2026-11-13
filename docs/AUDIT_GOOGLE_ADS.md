# Audit du suivi actuel avant Google Ads (lecture seule — aucune migration proposée ici)

Constats vérifiés dans le code (PR 38, `main`). **Aucune modification de ce suivi dans cette PR.**

## Ce qui existe
| Sujet | État constaté |
|---|---|
| Balise Google (gtag / GTM, `AW-…`) | **Absente.** Aucun script Google chargé sur le site (`grep gtag|googletagmanager|AW-` : rien). |
| `gclid` | Reconnu pour classer le canal « google » (`lib/channel.ts`) et lu par `lib/server/attribution.ts`, **mais non conservé** sur le lead : pas de colonne `gclid`. `wbraid` / `gbraid` : absents. |
| Lead (prospect obtenu) | Événement `Lead` envoyé à Meta / TikTok **depuis le serveur**, uniquement avec consentement « traceurs », avec `event_id` (déduplication navigateur / serveur). |
| Réservation | Événement `Purchase` envoyé **une seule fois par dossier** : `booked_at` n'est posé qu'à la première bascule vers `reserve` / `gagne`, et l'identifiant est `purchase-<lead.id>`. Repasser le statut ne renvoie rien. |
| Consentement | Sans consentement traceurs : aucune conversion n'est envoyée (`conversion: "sans consentement"`). |

## Points d'attention (à décider avant de coder Google Ads)
1. **Lead ≠ Réservation.** Aujourd'hui deux événements distincts, bien séparés : `Lead` (formulaire) et `Purchase` (statut réservé). À conserver tel quel pour Google : deux actions de conversion distinctes, jamais fusionnées.
2. **Une vente = une conversion.** La règle existante (une seule émission par dossier, identifiant stable) est la bonne base. Google devra recevoir le même identifiant de transaction (`purchase-<lead.id>`) pour dédupliquer.
3. **Valeur envoyée.** `Purchase` transmet `booking_value` (montant de la vente saisi dans le CRM), **pas la commission nette conservée**. Pour piloter Google Ads sur la rentabilité réelle, la valeur de conversion devrait être la commission nette confirmée, pas le chiffre d'affaires. Décision du propriétaire requise.
4. **« Réservation » dans le CRM ≠ « commission confirmée » dans EasyV4.** Le statut CRM peut précéder la confirmation financière ; une annulation / un remboursement ultérieur n'est pas encore renvoyé en « ajustement de conversion ». Décision requise : conversion à la réservation CRM (rapide, provisoire) ou à la confirmation de la commission (fiable, tardive).
5. **Consentement.** Une balise Google ne doit se charger qu'après accord (mode de consentement), comme Meta / TikTok ; vérifier aussi l'accessibilité pour AdsBot / Lighthouse (la page ne doit pas être bloquée).
6. **Rattachement.** Le `gclid` doit être conservé sur chaque lead (avec le consentement) pour pouvoir importer les conversions hors ligne : cela demandera une migration, **à ne proposer qu'après validation de cet audit par le propriétaire**.

## Ce qu'il faut du propriétaire (aucun jeton dans le chat)
Identifiant du compte Google Ads, identifiant de balise `AW-…`, libellés de conversion Lead et Réservation, et les décisions 3 et 4 ci-dessus.
