# r17-quasar-ssr

Projet quasar2 SSR avec Vue 3, Pinia et FeathersJS v5 (koa, rest).

Le serveur Node effectue le SSR avec un état Pinia distinct par requête.

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

Profil: schema typebox; auth none; databases main:memory. Les profils d'identité et les bases externes nécessitent un raccordement explicite.

Quasar SSR : ouvrir http://127.0.0.1:8080 (reverse proxy local). Ne pas exposer le serveur SSR directement.

Les données de démonstration sont en mémoire ; sans authentification les services ne doivent pas être exposés publiquement.
