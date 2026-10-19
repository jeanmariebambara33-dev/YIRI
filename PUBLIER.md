# Publier une nouvelle version

Le site publié est à la **racine** de ce dépôt : `index.html` et ses huit fichiers voisins.
Les sources sont dans `src/`, `supabase/`, `scripts/` et `assets/`, et ne sont jamais publiées
(voir `.vercelignore`).

## Mettre à jour le site

```
node scripts/build-site.mjs
cp dist/site-yiri/* .
git add -A && git commit -m "…" && git push
```

Vercel détecte le nouveau commit et déploie tout seul. L'adresse ne change pas.

**Les neuf fichiers partent ensemble.** `index.html` seul suffit à afficher le site, mais sans
`vercel.json` aucun en-tête de sécurité n'est appliqué, et sans `manifest.webmanifest`, `sw.js`
et les quatre icônes l'installation sur téléphone ne marche plus.

## Réglage Vercel, à faire une seule fois

Import Git Repository → ce dépôt → Deploy, sans rien changer :

- Framework Preset : **Other**
- Build Command : **vide**
- Output Directory : **vide** (la racine)
- Install Command : **vide**

Vercel ne construit rien : il sert les fichiers déjà construits.

## Après le premier déploiement

Reporter la nouvelle adresse dans :

1. Supabase → Authentication → URL Configuration (Site URL + Redirect URLs)
2. Le secret `SITE_URL` des fonctions serveur

L'adresse du webhook de paiement, elle, ne change pas : elle est chez Supabase, pas sur le site.
