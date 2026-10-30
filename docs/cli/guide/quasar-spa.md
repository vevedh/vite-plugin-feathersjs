# Quasar 2 — application SPA

Une SPA charge ses composants dans le navigateur. Les notes sont ensuite récupérées depuis FeathersJS par `/api/notes`.

```powershell
create-feathers-app portail-quasar --ui quasar2 --render spa --adapter koa --transport both
Set-Location .\portail-quasar
corepack pnpm install
corepack pnpm run dev:all
```

Le choix `both` active le serveur Socket.IO sur le port 3031. Les événements permettent de rafraîchir la liste dans un deuxième onglet, sans rechargement. Pour REST uniquement, utilisez `--transport rest`.

## Vérifier

```powershell
Invoke-RestMethod http://127.0.0.1:3030/api/health
corepack pnpm run typecheck
corepack pnpm run build
```

Cet exemple repose sur le plugin Quasar pour Vite (SPA). **Le SSR Quasar 2** utilise un outillage différent (`@quasar/app-vite`) et dispose d'un exemple séparé, non généré par cette version du CLI.
