# Audit fonctionnel connecté — D1 et D2 (protocole du 23/11/2026)

**But : certifier D1 (garde-fou de sensibilité) et D2 (fiche de segment) dans l'interface réelle.** D1 et D2 sont déployés (PR #87) mais **non certifiés** tant que cet audit n'est pas réalisé avec un compte administrateur autorisé.
**Règles de l'audit :** lecture seule · aucune donnée fictive créée en production · aucun export · aucune activation publicitaire · aucun clic sur « Annuler », « Enregistrer » ou autre bouton d'écriture. Claude n'a pas de compte administrateur et n'en demande jamais les identifiants : l'audit est réalisé par le propriétaire (ou un administrateur désigné), Claude compare les résultats.

## 1. Valeurs de référence (production, lecture seule, **recalculées le 24/11/2026** après le 10ᵉ dossier réel du 23/11)
Calculées en lecture seule sur les mêmes règles que la page (leads réels, hors test, hors anonymisés, téléphone valide, regroupés par téléphone). Aucun numéro ni nom n'est reproduit ici. Les durées d'inactivité dépendent de la date du jour.

| Élément | Valeur attendue |
|---|---|
| Clients distincts (téléphones) | 6 (dont 5 avec consentement marketing sur toutes leurs demandes) |
| Carte « À traiter » (suivi) | 3 |
| Carte « À relancer (7 jours) », « Proposition sans réponse », « Région à renseigner » | 0 chacune |
| Carte « Perdus à reprendre (60 jours) », « Clients ayant réservé », « Clients VIP » | 0 chacune (le seuil VIP n'est pas défini : segment vide par construction) |
| Carte « Omra sans réservation » (marketing, **sensible**) | **2** affichés (3 membres, 1 exclu faute de consentement marketing : mention « 1 exclu(s) ») |

## 2. Étapes à exécuter (connecté en tant qu'administrateur, puis en tant qu'employé)
| N° | Action | Résultat attendu | Observé (OK / KO) |
|---|---|---|---|
| 1 | Menu → « Segments » | 8 cartes ; chiffres conformes au tableau ci-dessus | |
| 2 | Regarder la carte « Omra sans réservation » | Mention rouge **« Usage interne uniquement »** | |
| 3 | Regarder les 7 autres cartes | Aucune ne porte cette mention | |
| 4 | Ouvrir la fiche « Omra sans réservation » | Bloc « Effectif dans le CRM » : 3 membres, 2 éligibles, 1 exclu · phrase sur la taille réelle chez une plateforme · Provenance (canaux) · **Fiabilité : Insuffisante** (moins de 30) · **Audience publicitaire : interdite** avec la raison « donnée sensible » | |
| 5 | Ouvrir la fiche « À traiter » | 3 membres ; Fiabilité Insuffisante ; **Audience publicitaire : interdite** (« segment de suivi ») | |
| 6 | Ouvrir la fiche « Clients ayant réservé » | 0 membre ; Fiabilité Insuffisante ; verdict « à examiner » avec « validation humaine » et « Rien n'est activé » | |
| 7 | Chercher sur la page tout bouton ou lien « Exporter », « Envoyer », « Audience », « Meta » dans le contenu (le lien « Export CSV » du menu latéral est un export général existant, hors segments) | Aucun | |
| 8 | Vérifier qu'aucun numéro n'apparaît dans les **fiches** (blocs « segment-profile ») ; la liste des membres, elle, affiche le numéro (comportement existant réservé à l'équipe) | Aucun numéro dans la fiche | |
| 9 | Se connecter avec un compte **Super Admin** (sans espace entreprise) | Redirection vers « Plateforme » ; aucun contenu de lead ni de segment | |
| 10 | Se connecter en **employé** | Voit la page (règle existante : l'employé voit les dossiers de son entreprise) ; mêmes mentions D1 / D2 | |
| 11 | Console du navigateur (F12) | Aucune erreur rouge | |
| 12 | Télécharger ou copier quoi que ce soit ? | **Ne pas le faire** : aucune donnée n'est exportée | |

## 3. Observation déjà relevée (à ne corriger qu'avec un GO)
- **O1 :** un segment marketing non sensible **vide** affiche « à examiner ». Un segment sans aucun contact devrait afficher « aucun contact » plutôt qu'« à examiner ». Sans conséquence de conformité (rien n'est activable), mais trompeur. Correction proposée, non faite.

## 4. Critères de certification
- **D1 certifié** si les étapes 2, 3, 4, 5, 7, 9 sont OK.
- **D2 certifié** si les étapes 1, 4, 5, 6, 8, 11 sont OK et si les chiffres correspondent au tableau de référence (tout écart est analysé avant certification).
- Toute étape KO est décrite (capture d'écran sans numéro de client visible) et traitée avant certification.

## 3. Compléments du 24/11/2026 — doublons et droits (lecture seule, aucun clic d'écriture)
| N° | Compte | Action | Résultat attendu | Observé |
|---|---|---|---|---|
| 12 | Administrateur | Menu → « Doublons » | Page chargée, **aucun message « migration non appliquée »** ; les candidats détectés s'affichent sans rien enregistrer. Ne cliquer ni sur « Signaler », ni « Confirmer », ni « Rejeter » | |
| 13 | Administrateur | Ouvrir une fiche dossier d'un candidat | Fiche consultable ; statut, notes et historique inchangés | |
| 14 | Administrateur | Pipeline : comparer le nombre de dossiers au total « Leads » du tableau de bord | Mêmes chiffres (aucun doublon confirmé à ce jour) | |
| 15 | Administrateur | Export CSV : **ne pas exporter** ; vérifier seulement que le lien existe | Règle D5 : les doublons confirmés sont exclus, sans colonne ajoutée (prouvé par test, pas en production) | |
| 16 | Employé (si un compte est créé avec GO) | Menu | **Pas de menu « Doublons »** ; pas d'accès à `/admin/doublons` | |
| 17 | Manager (si un compte est créé avec GO) | Menu | Menu « Doublons » présent ; ne peut pas confirmer un signalement qu'il a lui-même fait ; ne peut pas rouvrir | |

Les étapes 16 et 17 sont **impossibles aujourd'hui** : la production ne compte que 2 comptes administrateur, aucun Manager ni employé. Créer ces comptes est une écriture en production : GO distinct du propriétaire.
