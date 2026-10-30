# Déployer VitePress sur GitHub Pages

La documentation publique est séparée des sources du plugin. Le dépôt GitHub `vevedh/vite-plugin-feathersjs` possède actuellement un historique différent de la branche de laboratoire : **ne copiez pas toute l’archive R17 dans `main`**. Seuls les fichiers `docs/cli` et le workflow `.github/workflows/cli-vitepress-pages.yml` sont destinés à ce dépôt.

## 1. Vérifier la documentation sur Windows

Dans une session PowerShell avec Git et Node.js installés :

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
.\scripts\r17\certify-and-stage-pages-windows.ps1
```

Cette commande contrôle le gel du projet, les pages, le périmètre de publication, puis construit le site avec le préfixe `/vite-plugin-feathersjs/`. Elle prépare une branche **sans la pousser** pour permettre une relecture.

## 2. Publier les sources de documentation

Après relecture et avec votre compte GitHub autorisé :

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
.\scripts\r17\certify-and-stage-pages-windows.ps1 -Push
```

Le script clone le dépôt GitHub dans un répertoire temporaire indépendant. Il crée une branche de correction dédiée (par défaut `docs/vitepress-postcss-isolation-r17-r3-r6`), n'ajoute que les sources publiques VitePress et son workflow, puis la pousse. Ouvrez ensuite une pull request ciblant `main`, vérifiez la liste des fichiers et fusionnez-la.

## 3. Activer GitHub Pages

1. Dans le dépôt GitHub, ouvrez **Settings → Pages**.
2. Sous **Build and deployment → Source**, choisissez **GitHub Actions**.
3. Dans **Actions**, vérifiez le workflow **CLI Documentation (VitePress / GitHub Pages)**. En cas de besoin, lancez-le avec **Run workflow** sur `main`.
4. Vérifiez que les étapes build et deploy sont toutes deux vertes, puis ouvrez `https://vevedh.github.io/vite-plugin-feathersjs/`.

Le workflow utilise `actions/configure-pages`, `actions/upload-pages-artifact` et `actions/deploy-pages` et ne publie pas de secrets npm. Il est déclenché par les modifications apportées à `docs/cli` ou au workflow lui-même.

::: warning
Un build local réussi ou une branche GitHub poussée ne prouvent **pas** que le site est en ligne. Il faut confirmer le résultat du workflow et ouvrir l'URL publique.
:::

## 4. Si GitHub Actions échoue sur `postcss-nesting`

La documentation et le plugin historique utilisent des configurations CSS différentes. Sur GitHub, VitePress peut tenter de charger une configuration PostCSS appartenant au `package.json` de la racine. Le fichier `docs/cli/postcss.config.cjs` évite cette confusion en donnant à la documentation sa propre configuration, sans plugin externe.

Ne modifiez pas le `package.json` du plugin historique et n'installez pas `postcss-nesting` inutilement pour masquer cette erreur. Relancez la construction dans **Actions**, et confirmez que les deux étapes `build` et `deploy` sont réussies.
