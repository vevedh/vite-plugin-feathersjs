# npm-quasar-spa

Projet quasar2 SPA avec Vue 3, Pinia et FeathersJS v5 (koa, rest).

Le frontend est une SPA Vite. L’API Feathers s’exécute séparément.

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

Les données sont en mémoire, sans authentification. Cet exemple est réservé au laboratoire local et ne doit pas être exposé sur Internet.
