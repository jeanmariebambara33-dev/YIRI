# Déploiement — état au 12 octobre 2026

## En ligne

- Site : https://yiri-sigma.vercel.app
- L'ancien `yiri-alpha` a été **supprimé** du compte Vercel. Son adresse ne répond plus.
- Base et authentification : projet Supabase `kzzrowymwwxoydklnkfb`
- Prestataire de paiement : SasPay (https://app.saspay.me)

> **La configuration est en deux morceaux, et ils ne sont pas alignés.**
> Côté Supabase, *Site URL*, *Redirect URLs* et le secret `SITE_URL` désignent encore
> `yiri-alpha`, qui n'existe plus. Tant que ce n'est pas corrigé :
>
> - les courriels de confirmation d'inscription et de mot de passe oublié renvoient vers une
>   adresse morte ;
> - après un paiement en ligne, le voyageur est renvoyé vers cette même adresse morte.
>   L'encaissement lui-même n'est pas touché — c'est le webhook, côté serveur, qui confirme —
>   mais le voyageur ne voit pas sa réservation confirmée.
>
> **Donc : ne pas faire le test de paiement réel avant d'avoir aligné les trois réglages.**
> Décision du fondateur : les trois seront faits en même temps que le passage à `yiri.bf`.

Chaque dépôt sur vercel.com/drop crée un NOUVEAU projet, donc une nouvelle adresse, donc ces
trois réglages à refaire. Relier le dépôt GitHub à Vercel supprimerait ce cycle : adresse
stable, déploiement automatique.

## Migrations appliquées

0001 à 0016.

| | |
|---|---|
| 0009 | paiement en ligne |
| 0010 | annulation et remboursement |
| 0011 | visibilité des réservations et notifications |
| 0012 | téléphone du voyageur, obligatoire |
| 0013 | retrait de l'ancienne `create_booking` sans téléphone |
| 0014 | abonnements, relances, expiration |
| 0015 | accès offert à un propriétaire, publication de ses propres annonces |
| 0016 | l'abonnement est rattaché au **profil** du propriétaire, plus au logement |
| 0017 | les notifications arrivent sur le téléphone, site fermé |
| 0018 | le déclencheur d'envoi, en SQL (la page « Webhooks » a disparu du tableau de bord) |
| 0019 | le voyageur n'enclenche plus de remboursement : l'équipe décide |
| 0020 | le voyageur est enfin prévenu de SA réservation, et les courriels partent |
| 0021 | deux droits de lecture oubliés, retirés (audit du 14 octobre) |
| 0022 | les relevés de revenus des propriétaires sous gestion, et les versements |
| 0023 | les réclamations : signaler un problème, et le traiter |

Un contrôle automatique interdit désormais qu'une migration soit oubliée :
`node scripts/fonctions-attendues.mjs` liste les 91 fonctions attendues et produit
`supabase/preprod/fonctions_manquantes.sql`, à exécuter dans l'éditeur SQL pour comparer avec
ce qui est réellement en place. C'est ce contrôle qui manquait le jour où la migration 0008
n'avait jamais été appliquée sans que rien ne le signale.

## Fonctions serveur déployées

| Fonction | Verify JWT | Rôle |
|---|---|---|
| `paiement-demarrer` | **activé** | la base fixe le montant, puis crée la page de paiement |
| `paiement-webhook` | **désactivé** | reçoit les messages signés du prestataire et confirme |
| `push-envoyer` | **désactivé** | pousse les notifications sur les appareils enregistrés |
| `email-envoyer` | **désactivé** | envoie les notifications par courriel (Brevo) |

Adresse déclarée chez SasPay :
`https://kzzrowymwwxoydklnkfb.supabase.co/functions/v1/paiement-webhook`
Événements souscrits : `transaction.success`, `transaction.failed`, `transaction.cancelled`.

Cette adresse est celle de **Supabase**, pas celle du site : changer d'adresse de site ne la
touche pas.

## Secrets (Supabase → Edge Functions → Secrets)

`SASPAY_SECRET_KEY`, `SASPAY_WEBHOOK_SECRET`, `SITE_URL`,
`VAPID_PRIVATE_KEY`, `PUSH_TRIGGER_SECRET`, `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`.
Jamais dans le code, jamais dans une conversation.

Les clés VAPID se fabriquent avec `outils/cles-vapid.html`, hors ligne, sur ta machine. La clé
**publique** ne figure pas dans les secrets : elle vit en base (table `public_settings`), parce
que le site doit la lire avant toute connexion, et la fonction d'envoi la lit au même endroit.
Une seule copie, donc jamais deux valeurs qui divergent.
Marche à suivre complète : `supabase/functions/push-envoyer/LISEZ-MOI.md`.

## Authentication → URL Configuration

- Site URL : pointe encore sur l'ancienne adresse — **à changer**, voir l'avertissement en haut
- Redirect URLs : la même, avec `/` et `/**`

## Tâche planifiée

`pg_cron` activé, tâche `yiri-expire-holds` toutes les minutes :
`select public.expire_booking_holds()` — libère les dates des réservations non payées.

L'expiration des abonnements, elle, **ne dépend d'aucune tâche planifiée** : la vue
`public_listings` recalcule la visibilité à chaque lecture. Une annonce dont l'abonnement est
échu disparaît à la seconde, même si rien ne tourne. `expire_subscriptions()` ne sert qu'à
écrire les statuts et les relances.

## Qui apprend qu'une réservation est payée (0011)

Un déclencheur écrit une notification à la confirmation **et** à l'annulation :

- au **propriétaire** du logement ;
- à chaque membre de l'équipe ayant `reservations` ou `paiements`, et aux administrateurs.

Les écrans qui les montrent : la **cloche** en haut de chaque page, l'onglet **Réservations** de
l'équipe, le bloc **Réservations sur mes logements** dans l'espace propriétaire. Les coordonnées
du voyageur ne sont données au propriétaire qu'**une fois le séjour payé** — c'est la base qui
les retient, pas l'affichage.

Depuis la 0017, l'alerte arrive aussi **sur le téléphone, site fermé** : chacun active les
alertes depuis **Mon compte**, son espace ou l'espace équipe, sur chacun de ses appareils.
Sur iPhone, le site doit d'abord être ajouté à l'écran d'accueil — Safari ne pousse rien à un
onglet ordinaire.

Qui reçoit quoi est décidé **au moment de l'envoi**, par la base : une alerte d'équipe ne part
qu'à qui a l'autorisation correspondante. Retirer une autorisation coupe les alertes à l'envoi
suivant, sans toucher au téléphone de la personne.

Depuis la 0020, l'alerte part **aussi par courriel**, via Brevo — donc elle atteint aussi qui
n'installe pas l'application. La liste des événements qui donnent lieu à un courriel est
volontairement courte (`_email_eligible`, migration 0020) : une boîte inondée finit en
indésirables, ce qui ferait perdre AUSSI les messages importants.
Marche à suivre : `supabase/functions/email-envoyer/LISEZ-MOI.md`.

Pas encore fait : le **SMS**, payant au message.

## Se parler : qui a le numéro de qui (0012)

- Le **téléphone du voyageur** est obligatoire au moment de réserver. Il est porté par la
  **réservation**, pas par le profil : le bon numéro est celui du séjour.
- L'**équipe** le voit dès la réservation, avec un bouton WhatsApp et un bouton d'appel.
- Le **propriétaire** ne le voit qu'une fois le séjour payé.
- Le **voyageur** reçoit le contact YIRI dans « Mes séjours », **une fois le séjour payé**,
  avec un message WhatsApp pré-rempli aux dates du séjour.

Choix assumé : le WhatsApp YIRI reste affiché dans le pied de page, sur toutes les pages
(`SOCIETE.whatsapp`, `src/App.tsx`). Un service sans numéro visible inspire moins confiance,
et c'est ce qui compte le plus ici. Conséquence acceptée : le numéro est public, donc le bloc
« après paiement » est un confort au bon moment, pas une protection contre les séjours traités
en direct. Ne pas le présenter comme une protection.

## Ne versez rien à l'avance (YIRI Annonce)

Sur une annonce qui n'est **pas** sous gestion YIRI, l'argent se remet **au moment de la remise
des clés**, jamais avant. L'avertissement s'affiche deux fois dans le parcours : avant que le
numéro du propriétaire ne soit révélé, puis à côté du numéro. C'est écrit noir sur blanc que
YIRI n'encaisse rien pour ces logements et ne pourra pas récupérer une somme envoyée hors du
site.

## Mettre à jour le site

1. `node scripts/build-site.mjs`
2. Déposer sur vercel.com/drop les **neuf fichiers** de `dist/site-yiri/` :
   `index.html`, `manifest.webmanifest`, `sw.js`, `vercel.json`, `robots.txt`,
   `icone-192.png`, `icone-512.png`, `icone-maskable-512.png`, `apple-touch-icon.png`.
3. Noter la nouvelle adresse et réaligner les trois réglages Supabase ci-dessus.

> **Ne jamais déposer `index.html` seul.** C'est l'erreur qui a déjà été commise : sans
> `vercel.json`, **aucun en-tête de sécurité n'est appliqué** ; sans `manifest.webmanifest`,
> `sw.js` et les icônes, l'installation sur téléphone ne marche plus.

## Reste à faire — et ce qui ne dépend pas du code

- **Empreinte d'intégrité de la bibliothèque Supabase** : une commande à lancer sur ton Mac, puis
  une ligne à coller dans `assets/supabase-sri.txt`. Tant qu'elle manque, la construction
  avertit et `scripts/sri.test.mjs` reste rouge — volontairement.
- **Nom de domaine** : `yiri.bf` (voir le document « Nom de domaine YIRI »).
- **Trois réglages Supabase** : *Site URL*, *Redirect URLs*, secret `SITE_URL`.
- **Test de paiement réel** : annonce à 500 FCFA, réservation depuis un second compte, paiement
  de bout en bout. *Bloqué* tant que les trois réglages ci-dessus ne sont pas alignés.
- **Nettoyage des données d'essai** : `supabase/preprod/nettoyage_tests.sql`, avant l'ouverture.
- **Juridique** : RCCM, IFU, forme et adresse dans `src/data/legal.ts` ; déclaration CIL.
- **Versement des remboursements** : encore manuel, et c'est assumé depuis la 0019. SasPay ne
  documente pas d'opération de remboursement et son API de versement exige une IP fixe, que les
  fonctions Supabase n'ont pas. Le site ne promet donc plus aucun remboursement automatique : le
  voyageur annule, l'équipe décide et enregistre depuis l'onglet **Remboursements**. Le virement
  lui-même reste à faire à la main. Leur tableau de bord propose une « IP Whitelist » : question
  à leur poser si l'on veut un jour automatiser.
- **Alertes courriel ou SMS** : les notifications arrivent sur les téléphones où l'application
  est installée (0017). Pour joindre quelqu'un qui ne l'installe pas, il faudrait un expéditeur
  de courriels (compte gratuit à créer) ou un fournisseur de SMS (payant au message).
- **Relier GitHub à Vercel** : supprimerait le cycle « nouvelle adresse à chaque dépôt ».
