# daisyUI SSR — FeathersJS v5

Exemple de rendu SSR avec Vue 3, Pinia, Vite 7 et Tailwind CSS/daisyUI. Le service FeathersJS v5 est exécuté dans un processus indépendant. Les pages statiques ne contiennent pas de notes ni de secrets. Données de démonstration uniquement, sans authentification.

```powershell
corepack pnpm install
# Terminal 1 : API Feathers
corepack pnpm run dev:api
# Terminal 2 : frontend
corepack pnpm run dev
```

```powershell
corepack pnpm run typecheck
corepack pnpm run build
corepack pnpm run serve:production
```

Le serveur de développement et de production rend deux routes (`/`, `/about`) avec un état Pinia distinct à chaque requête.

La certification Windows complète reste à exécuter. Ne pas exposer publiquement l’API de démonstration en mémoire, sans authentification.
