# npm-daisyui-ssg

Projet daisyui SSG avec Vue 3, Pinia et FeathersJS v5 (koa, rest).

Le build pré-rend les routes publiques / et /about. Les notes restent dynamiques via /api.

## Démarrage local (Windows / PowerShell)

```powershell
corepack pnpm install
corepack pnpm run dev:all
```

Ouvrir http://127.0.0.1:5173. L’API utilise http://127.0.0.1:3030.

```powershell
corepack pnpm run typecheck
corepack pnpm run build
```

Pour vérifier le build, lancer `corepack pnpm run serve:production` avec l’API active.

Les données sont en mémoire, sans authentification. Cet exemple est réservé au laboratoire local et ne doit pas être exposé sur Internet.
