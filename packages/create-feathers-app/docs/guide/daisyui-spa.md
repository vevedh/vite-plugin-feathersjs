# daisyUI — application SPA

```powershell
create-feathers-app portail-daisy --ui daisyui --render spa --adapter express --transport rest
Set-Location .\portail-daisy
corepack pnpm install
corepack pnpm run dev:all
```

L'interface utilise Vue 3, Tailwind CSS 4 et daisyUI 5. Le serveur FeathersJS est indépendant du build Vite. L'application conserve les notes en mémoire : elles disparaissent à l'arrêt de l'API.

Pour un laboratoire temps réel, sélectionnez `--transport both`. Les variantes Koa/Express avec Socket.IO ont été certifiées sur Windows dans les exemples du dépôt.
