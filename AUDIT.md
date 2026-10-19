# YIRI — audit technique et préparation au lancement

État au 12 octobre 2026. Ce document remplace l'audit de la maquette, devenu faux : il décrivait
un site où toute la logique vivait dans le navigateur, un paiement par lien Chariow et un fichier
`src/store.tsx` qui simulait un serveur. Rien de cela n'existe plus.

## Verdict

Le code n'est plus ce qui empêche l'ouverture au public. Ce qui l'empêche est, dans l'ordre : le
nom de domaine, trois réglages Supabase à aligner, un test de paiement réel jamais fait, des
données d'essai à nettoyer, et le RCCM, l'IFU et la déclaration CIL.

## A. Ce qui a changé depuis l'audit de la maquette

| Alors | Aujourd'hui |
|---|---|
| Logique et droits dans le navigateur, falsifiables | Tout est décidé par la base : RLS, fonctions serveur, 16 migrations. `scripts/tamper-check.mjs` échoue si un accès forgé redevient possible |
| Paiement par lien à montant libre, confirmation à la main | Paiement en ligne SasPay, montant fixé **par la base**, confirmation par webhook signé côté serveur |
| Pas de mentions légales | Mentions, CGU, confidentialité, cookies (`src/data/legal.ts`, 61 contrôles) |
| Pas d'inscription réelle | Supabase Auth : inscription, connexion, mot de passe oublié, vérification d'identité propriétaire |
| Photos en base64 dans le navigateur | Supabase Storage, avec droits |

## B. Problèmes relevés par l'audit du 12 octobre, et leur sort

| Gravité | Problème | Sort |
|---|---|---|
| Élevé | Le formulaire de candidature Partenariat écrivait dans le **navigateur du visiteur**. La candidature n'arrivait jamais chez YIRI, alors que l'écran affichait « YIRI vous contactera ». | **CORRIGÉ** — `submitApplication` écrit en base ; un échec d'envoi s'affiche au lieu d'être avalé |
| Élevé | Aucun écran ne montrait les demandes de rappel ni les candidatures : elles arrivaient en base et personne ne les voyait. | **CORRIGÉ** — onglet **Demandes** de l'espace équipe |
| Élevé | Les notifications étaient écrites par la base depuis la 0011 et **lues par aucun écran**. | **CORRIGÉ** — cloche sur toutes les pages, avec le nombre de non lues |
| Moyen | L'autorisation d'équipe `audit` n'ouvrait **rien** : la base laissait lire le journal, aucun écran ne l'affichait. | **CORRIGÉ** — onglet **Journal**, en lecture seule |
| Moyen | `src/pages/public.tsx` embarquait encore un catalogue, une fiche, une page de paiement et un bouton « J'ai effectué le paiement » qui ne touchaient que le navigateur. Aucune route n'y menait, mais le code partait dans le site livré. | **CORRIGÉ** — réduit à la page d'accueil |
| Moyen | `src/store.tsx` recopiait un faux serveur complet (logements, réservations, paiements, candidatures) dans `localStorage`. Plus personne ne s'en servait. | **CORRIGÉ** — réduit au routeur ; 493 lignes ramenées à 166 |
| Moyen | `src/pages/admin.tsx`, `team.tsx`, `owner.tsx`, `new-listing.tsx` : écrans de maquette importés nulle part. | **CORRIGÉ** — supprimés |
| Moyen | `src/lib/payments.test.ts` : neuf tests qui éprouvaient le faux serveur, donc rien de ce qui est livré. | **CORRIGÉ** — supprimés avec le code qu'ils visaient, remplacés par sept tests sur des fonctions réellement livrées |
| Moyen | Aucun des deux fichiers de tests unitaires ne pouvait s'exécuter (`tsx` absent, `react` non résoluble). | **CORRIGÉ** — `scripts/test-unitaires.mjs` |
| Moyen | `scripts/tamper-check.mjs` démontrait une faille qui n'existait plus. | **CORRIGÉ** — devenu un garde-fou de neuf contrôles |
| Moyen | `AUDIT.md`, `README.md`, `DEPLOIEMENT.md` décrivaient la maquette. `DEPLOIEMENT.md` disait de déposer `index.html` **seul** — l'erreur qui a déjà privé le site de ses en-têtes de sécurité et cassé l'installation sur téléphone. | **CORRIGÉ** — les trois réécrits |
| — | Domaine, trois réglages Supabase, test de paiement réel, nettoyage des données d'essai, RCCM/IFU/CIL | **NE DÉPEND PAS DU CODE** — voir `DEPLOIEMENT.md` |

## C. Résultats réels des tests, après corrections

- **Base de données** : 991 contrôles sur PostgreSQL 17 local, migrations 0001 à 0016 rejouées
  depuis une base vide, plus les scénarios à connexions simultanées. 0 échec.
- **Navigateur réel** (Chromium, 13 suites + falsification) : 567 contrôles. 0 échec.
- **Fonctions pures** : 15 tests. 0 échec.
- **Les tests mordent** : chaque correction a été sabotée volontairement pour vérifier que les
  tests tombent. Quatre sabotages sur les écrans Demandes et notifications, deux sur le Journal :
  tous détectés.

### Ce qui n'est PAS testé, et doit être dit

- Le **paiement réel** de bout en bout : jamais fait. Les tests de paiement portent sur la base
  et sur un prestataire imité, pas sur SasPay en vrai.
- Je n'ai **pas** inspecté les réglages de Supabase, de Vercel ni du prestataire de paiement :
  tout ce qui est écrit ici vient du code et des tests locaux.
- Vérification de types TypeScript des fichiers `.tsx` : les types React ne sont pas installables
  dans cet environnement. Les `.ts` sont propres.
- Lint : aucun configuré. Contrastes de couleurs, performance sur réseau lent : non mesurés.
- Le **versement** des remboursements : manuel, voir `DEPLOIEMENT.md`.
- Aucune **alerte** ne sort du site : les notifications existent, mais ni courriel ni SMS.

## D. Sécurité, en une page

- La page **affiche**, la base **autorise**. Aucun droit n'est décidé par le navigateur.
- Le **montant** d'un paiement est fixé par la base à partir des dates et du tarif ; il n'est
  jamais transmis par le navigateur.
- La **confirmation** vient du webhook signé, jamais d'une redirection ni d'un clic.
- La clé `anon` est publique par conception. La clé `service_role` n'apparaît nulle part dans
  l'application, et aucune fonction appelable par un visiteur ne l'exige.
- Le **journal** (`audit_logs`) ne peut être ni modifié ni effacé, pas même par un administrateur :
  un déclencheur le refuse.
- Sur **YIRI Annonce**, le site dit deux fois au voyageur de ne rien verser avant la remise des
  clés, et qu'YIRI n'encaisse rien pour ces logements.

## E. Risques résiduels

Rapprochement manuel des versements de remboursement ; engagement Sérénité hors
Ouagadougou et Bobo-Dioulasso non éprouvé ; dépendance à un prestataire de paiement unique ;
aucune alerte hors du site, donc une réservation payée la nuit n'est vue qu'au réveil.
