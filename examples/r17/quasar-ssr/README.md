# Quasar 2 SSR — Exemple certifié R16

**Projet exécutable :** [`../../quasar-ssr`](../../quasar-ssr). Il n'est pas dupliqué : cela permet de préserver la baseline R16 certifiée et son manifeste SHA-256.

Depuis `examples/quasar-ssr` :

```powershell
corepack pnpm install
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter koa -Socket -Browser
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter express -Socket -Browser
$env:VITE_FEATHERS_REALTIME = '1'
corepack pnpm run build:ssr
.\scripts\PREPARE_R16_PRODUCTION.ps1
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Production -Adapter koa -Socket -Browser
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Production -Adapter express -Socket -Browser
Remove-Item Env:VITE_FEATHERS_REALTIME -ErrorAction SilentlyContinue
```

Ce cas est déjà certifié sur Windows (10/10 tests Playwright Edge en production). Il utilise Quasar CLI v2.6.2, et non le plugin Vite autonome réservé au SPA.
