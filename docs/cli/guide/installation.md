# Installer le CLI

Il existe deux packages différents :

- `@vevedh/vite-plugin-feathersjs` fournit l'intégration FeathersJS/Vite, version **0.2.6** publiée.
- `@vevedh/create-feathers-app` fournit le **générateur de projets**, préversion `0.1.0-rc.1` publiée et candidate `0.1.0-rc.2` en certification.

## Depuis npm (après publication du CLI)

```powershell
npm exec --package=@vevedh/create-feathers-app@next -- create-feathers-app portail --ui daisyui --render spa --adapter koa
```

La préversion `0.1.0-rc.1` est disponible sur npm. Le modèle Quasar SSR et les nouveaux profils appartiennent à `0.1.0-rc.2`, encore non publié : pour les tester, utilisez l'archive locale (voir [Publication](/maintenance/publication)).

## Windows, à partir de l'archive de développement

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
node scripts/stage-r17-cli.mjs
node .release/create-feathers-app/bin/create-feathers-app.mjs --help
```

Pour générer dans un nouveau dossier **à partir du répertoire courant**, placez-vous dans le dossier parent voulu avant de lancer le CLI.

```powershell
Set-Location C:\devs
node C:\devs\vite-plugin-feathersjs\.release\create-feathers-app\bin\create-feathers-app.mjs mon-portail --ui quasar2 --render spa
Set-Location .\mon-portail
corepack pnpm install
corepack pnpm run dev:all
```

Ouvrez `http://127.0.0.1:5173`. L'API Feathers écoute uniquement sur `127.0.0.1:3030`.

::: tip
Une génération refuse d'écraser un dossier existant. Commencez par `--dry-run --json` pour connaître la liste des fichiers créés.
:::
