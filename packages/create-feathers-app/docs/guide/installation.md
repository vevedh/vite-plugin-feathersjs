# Démarrer avec Create Feathers App

Le CLI s'appelle **`@vevedh/create-feathers-app`** sur npm et expose les exécutables `create-feathers-app` et `cfapp` dans la prochaine version à certifier. Node.js **22.12 ou supérieur** est requis par le manifeste du CLI.

::: warning Vérifier le canal npm
Les exemples utilisent `@next` **seulement si ce dist-tag existe**. Vérifiez-le avec `npm view @vevedh/create-feathers-app dist-tags --json` avant l'installation. Pour une CI, remplacez le tag par une version exacte. Le guide décrit la source `0.1.0-rc.10` sans présumer de la version actuellement publiée.
:::

## 1. Créer une application (avec le canal npm vérifié)

```powershell
npx --yes --package=@vevedh/create-feathers-app@next create-feathers-app mon-projet --ui daisyui --render spa
```

L'option `--dry-run` permet de voir le plan **sans écrire de fichiers** :

```powershell
npx --yes --package=@vevedh/create-feathers-app@next cfapp mon-projet --dry-run --json
```

## 2. Installer et démarrer

Depuis le répertoire parent du projet :

```powershell
Set-Location mon-projet
corepack pnpm install
corepack pnpm run dev:all
```

Pour le profil SPA `--dev-api vite`, Vite sert l'interface et l'API de développement. Le rendu de production nécessite un serveur API réellement déployé.

## 3. Consulter l'aide

```powershell
npx --yes --package=@vevedh/create-feathers-app@next cfapp --help
```

L'alias `cfapp` est défini dans le même package : **`npx cfapp` tout seul est ambigu** et peut invoquer un autre package npm. Utilisez toujours `--package=@vevedh/create-feathers-app@VERSION` pour cibler notre binaire. En CI, remplacez `@next` par une version exacte.

## Tester la RC10 directement depuis le dépôt (sans npm)

```powershell
Set-Location CHEMIN_VERS_LE_DEPOT
node packages/create-feathers-app/bin/create-feathers-app.mjs --help
node packages/create-feathers-app/bin/create-feathers-app.mjs mon-projet --dry-run --json
```

Ces commandes nécessitent le dépôt source complet. Pour les versions disponibles et leur installation, voir la [page de distribution](/maintenance/publication).

## Et ensuite ?

[Choisir Quasar ou daisyUI](/guide/rendus), [générer un service](/guide/services) et [comprendre les profils identité/base](/guide/identites-bases).
