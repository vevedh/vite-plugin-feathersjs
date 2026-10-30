# daisyUI — SSR et SSG

## SSR : rendre les pages à la demande

```powershell
create-feathers-app portail-ssr --ui daisyui --render ssr --adapter koa --transport rest
Set-Location .\portail-ssr
corepack pnpm install
corepack pnpm run dev:all
```

Le serveur Node répond pour `/` et `/about`. Pour chaque requête, Vue et Pinia obtiennent un état indépendant. Le navigateur hydrate ensuite la page. Les notes sont chargées en client depuis l'API ; aucun jeton ni contenu personnel n'est injecté dans le HTML SSR.

```powershell
corepack pnpm run typecheck
corepack pnpm run build
corepack pnpm run serve:production
```

## SSG : pré-rendre les pages publiques

```powershell
create-feathers-app portail-ssg --ui daisyui --render ssg --adapter express --transport rest
Set-Location .\portail-ssg
corepack pnpm install
corepack pnpm run build
```

Le build doit créer `dist/ssg/index.html` et `dist/ssg/about/index.html`, sans notes privées. Vous pouvez les prévisualiser avec `corepack pnpm run serve:production`, après avoir démarré Feathers avec `corepack pnpm run dev:api`.

::: warning
Le mode SSR et le mode SSG sont **REST uniquement** dans le CLI actuel. La configuration Socket.IO en production nécessite un proxy WebSocket spécifique, non livré dans ces modèles.
:::
