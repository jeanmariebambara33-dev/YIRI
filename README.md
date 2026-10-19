# YIRI — location meublée de courte durée au Burkina Faso

Trois offres : **YIRI Annonce** (le propriétaire gère, YIRI rend visible), **YIRI Sérénité**
(YIRI gère), **YIRI Partenariat** (YIRI investit et exploite).

## Où est quoi

| | |
|---|---|
| `supabase/migrations/` | la base : tables, droits (RLS), fonctions serveur. **C'est elle qui décide.** |
| `supabase/tests/` | les tests de la base, rejoués sur PostgreSQL local |
| `supabase/preprod/` | contrôles à passer dans l'éditeur SQL avant une mise en ligne |
| `src/lib/api.ts` | le seul endroit qui parle à la base |
| `src/pages/` | les écrans |
| `src/store.tsx` | la navigation, rien d'autre |
| `scripts/` | construction du site et tests de bout en bout dans un vrai navigateur |
| `outils/` | outils locaux, jamais déployés (fabrication des clés de notification) |

## Construire

```
node scripts/build-preview.mjs    # dist/yiri-demo.html — une page autonome, pour les tests
node scripts/build-site.mjs       # dist/site-yiri/ — les neuf fichiers à déployer
```

## Éprouver

```
node scripts/test-unitaires.mjs           # fonctions pures
node scripts/<suite>-e2e.mjs              # 13 suites dans un navigateur réel
node scripts/tamper-check.mjs             # aucun accès ne peut être forgé depuis la page
node scripts/sri.test.mjs                 # l'empreinte bloque réellement un fichier remplacé
node scripts/sw-push.test.mjs             # le service worker : affichage et clic des alertes
node --experimental-strip-types scripts/cles-vapid.test.mjs                     # les clés fabriquées sont utilisables
node --experimental-strip-types supabase/functions/tests/push.test.mjs          # chiffrement Web Push, vérifié en déchiffrant
node --experimental-strip-types supabase/functions/tests/signature.test.mjs     # signature du prestataire de paiement
bash supabase/tests/run-local.sh          # migrations + tests SQL sur PostgreSQL local
node scripts/fonctions-attendues.mjs      # vérifie qu'aucune migration n'a été oubliée
```

## Un principe, un seul

Les droits ne sont **jamais** décidés par la page. Le navigateur affiche, la base autorise.
Un écran peut être contourné ; une politique RLS ne peut pas. Les tests de `supabase/tests/`
visent les règles, ceux de `scripts/` visent ce que l'utilisateur voit.

La clé `anon` est publique par conception. La clé `service_role` ne doit **jamais** apparaître
dans l'application.

Déploiement, réglages et ce qui reste à faire : `DEPLOIEMENT.md`.
