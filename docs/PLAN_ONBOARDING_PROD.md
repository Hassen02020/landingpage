# Plan de mise en service de la création d'entreprises (chantier 05 A) — à exécuter par le propriétaire

**Rien de ce document ne s'exécute automatiquement.** Claude ne touche ni à la base de production, ni à Supabase Auth, ni à Vercel. Chaque étape ci-dessous est faite par le propriétaire ; Claude lit les résultats collés.

## 0. Prérequis déjà satisfaits
0008 et 0010 appliquées ; compte Super Admin `tarhouni.hassene@gmail.com` enregistré ; CRM d'Easy2Book vérifié en ligne après le déploiement 04.

## 1. Décisions à prendre avant
| # | Décision | Recommandation |
|---|---|---|
| 1 | Migration 0009 (employés voient tous les leads de leur entreprise) : appliquer maintenant ? | Oui : sans effet visible aujourd'hui, nécessaire avant la certification multi-entreprises |
| 2 | Expéditeur SMTP | Un service d'envoi (Resend, Brevo, Mailjet, SES…) avec un domaine d'envoi à vous (SPF/DKIM). L'envoi par défaut de Supabase est limité à quelques e-mails par heure et destiné aux tests |
| 3 | Adresse d'expédition | `no-reply@<votre domaine>` ; un nom d'expéditeur « Easy2Book » |

## 2. Configuration Supabase Auth (tableau de bord du projet `tdexdlukqciolslvjmhd`)
1. **Authentication → URL Configuration**
   - *Site URL* : `https://landingpage-easy2book.vercel.app`
   - *Redirect URLs* : ajouter `https://landingpage-easy2book.vercel.app/admin/invitation` (sans cet ajout, le lien de l'e-mail d'invitation est refusé).
2. **Authentication → SMTP Settings** : activer *Custom SMTP* avec les paramètres fournis par votre service d'envoi (hôte, port, utilisateur, mot de passe, adresse et nom d'expéditeur). **Ne collez jamais le mot de passe SMTP dans une conversation** ; il se saisit uniquement dans ce formulaire.
3. **Authentication → Rate Limits** : vérifier la limite d'e-mails par heure (augmentée une fois le SMTP personnalisé actif).
4. **Authentication → Email Templates → Invite user** : garder le lien `{{ .ConfirmationURL }}` (l'application lit le jeton dans le fragment d'URL ; ne pas le remplacer par un lien qui ne le renvoie pas vers `/admin/invitation`). Texte conseillé :
   - Objet : `Votre espace Easy2Book est prêt`
   - Corps : « Bonjour, un espace a été créé pour vous. Cliquez ici pour choisir votre mot de passe : {{ .ConfirmationURL }}. Ce lien est personnel. »
5. **Authentication → Providers → Email** : laisser « Confirm email » actif ; les inscriptions libres doivent rester désactivées (*Allow new users to sign up* = non), sinon n'importe qui pourrait créer un compte Auth.

## 3. Ordre d'application (après validation de la PR 16)
1. Sauvegarde du jour.
2. **0009** : requête d'état, application, `postcheck-0009.sql` (5 OK).
3. Fusion de la PR 16 et déploiement (sur votre GO).
4. **0012** : application puis `postcheck-0012.sql` (4 OK). Sans effet tant que personne ne crée d'entreprise.
5. **0011** : application puis `postcheck-0011.sql` (7 OK) — **uniquement juste avant** la première création d'entreprise (elle lève le verrou de 0010 et retire les unicités globales). Après 0011, tout nouveau lead doit porter son organisation : le site public le fait déjà.

## 4. Test d'une deuxième organisation — seulement quand 1 à 3 sont faits
Entreprise **de test** (pas une vraie), adresse d'invitation que vous contrôlez (ex. `vous+test@gmail.com`, pas votre compte Super Admin : il est refusé volontairement).
1. Connexion avec le compte Super Admin → `/admin/plateforme`.
2. Créer « Test Entreprise » avec cette adresse. Attendu : message « invitation envoyée » ; e-mail reçu ; la ligne apparaît (1 membre, 1 administrateur).
3. Ouvrir le lien reçu → `/admin/invitation` → choisir un mot de passe → se connecter.
4. Vérifier : CRM **vide**, aucune donnée d'Easy2Book ; `/admin/equipe` = ce seul compte ; ouvrir directement l'adresse d'une fiche lead d'Easy2Book → page introuvable.
5. Côté Easy2Book (`direction@easy2book.tn`) : Pipeline, Clients, Leads **inchangés** (mêmes 4 leads / 3 clients).
6. Suspendre « Test Entreprise » → son administrateur ne peut plus se connecter ; réactiver.
7. Contrôle base (lecture seule, Claude lit le résultat) : `SELECT slug, status FROM organizations;` et `SELECT count(*) FROM landing_leads WHERE organization_id <> '00000000-0000-4000-8000-0000000e2b01';` → `0`.
8. Retour arrière du test : suspendre l'organisation de test (elle reste dans l'audit, qui est en ajout seul).

## 5. Ce qui n'est PAS fait
Formulaires adaptatifs par entreprise et page publique par entreprise (chantiers 05 B / 07) ; sélecteur d'organisation ; changement d'administrateur d'une entreprise.
