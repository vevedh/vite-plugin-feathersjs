# R17-r1-r2 — Windows : lanceur Playwright, API et frontend

Le générateur R17-r1 fonctionne. Les tests HTTP et Playwright doivent en revanche disposer **d'une API Feathers et d'un serveur frontend déjà démarrés**, ou utiliser le lanceur ci-dessous. `ECONNREFUSED 127.0.0.1:3030` signifie qu'aucun processus API ne répond. Un champ invisible sur `5173` ne prouve rien si une autre application ou une page d'erreur occupe ce port.

## Préparation (une seule fois pour chaque exemple)

Depuis `C:\devs\vite-plugin-feathersjs` :

```powershell
node scripts/check-r16-freeze.mjs
node --test tests/r17-generator.test.mjs tests/r17-runner.test.mjs

# Installer l'exemple SPA Quasar
Set-Location examples/r17/generated/r17-quasar-spa
corepack pnpm install
corepack pnpm run typecheck
corepack pnpm run build

# Playwright Edge est installé dans l'exemple SSR de référence.
Set-Location ../../../quasar-ssr
corepack pnpm install

Set-Location ../..
```

Attention : les répertoires exemples ont **leurs propres dépendances**. Ne pas supposer que le `node_modules` racine les remplace. Le package npm `@vevedh/vite-plugin-feathersjs@0.2.6` est conservé. Les démonstrations sont locales, sans authentification ; ne pas exposer ces ports au réseau.

## Vérifier les prérequis R17 avant les tests

Depuis la racine, avant de démarrer les services :

```powershell
Set-Location C:\devs\vite-plugin-feathersjs\examples\quasar-ssr
corepack pnpm exec playwright --version

Set-Location C:\devs\vite-plugin-feathersjs
node examples/r17/scripts/certify-r17.mjs --case quasar-spa --adapter koa --preflight
```

**R17-r1-r2 corrige la détection de Playwright** : la commande est désormais résolue par son export public `@playwright/test/cli`, depuis l'installation du projet `examples/quasar-ssr`. L'ancien préflight recherchait le sous-chemin non public `playwright/cli` et pouvait échouer même quand `corepack pnpm exec playwright test` fonctionnait. Le préflight ne démarre aucun service et ne modifie aucune dépendance.

Si l'exécution manuelle de Playwright fonctionne mais pas ce préflight, conservez la sortie complète et le chemin de l'installation locale : ne réinstallez pas Edge automatiquement.

## Un seul lancement : API + frontend + CRUD HTTP + Playwright Edge

```powershell
Set-Location C:\devs\vite-plugin-feathersjs

node examples/r17/scripts/certify-r17.mjs --case quasar-spa --adapter koa
node examples/r17/scripts/certify-r17.mjs --case quasar-spa --adapter express

# Deux clients Socket.IO, SPA seulement (optionnel)
node examples/r17/scripts/certify-r17.mjs --case quasar-spa --adapter koa --socket
node examples/r17/scripts/certify-r17.mjs --case quasar-spa --adapter express --socket
```

À chaque exécution, le lanceur vérifie que **3030 et 5173** (et 3031 pour Socket.IO) sont libres, démarre ses propres processus sur `127.0.0.1`, attend le service Feathers, contrôle la signature HTML de l'exemple, exécute les opérations REST CRUD puis Edge avec GPU désactivé, et arrête les processus qu'il a créés. Il refuse de tester un serveur étranger. Les journaux sont écrits dans `examples/r17/docs-private/certifications/` (non destinés au dépôt public).

## Pour les autres exemples

```powershell
# Installer chaque projet avant sa certification
Set-Location C:\devs\vite-plugin-feathersjs\examples\r17\generated\r17-daisyui-spa
corepack pnpm install
corepack pnpm run typecheck
corepack pnpm run build

Set-Location C:\devs\vite-plugin-feathersjs\examples\r17\daisyui-ssr
corepack pnpm install
corepack pnpm run typecheck
corepack pnpm run build

Set-Location C:\devs\vite-plugin-feathersjs\examples\r17\daisyui-ssg
corepack pnpm install
corepack pnpm run typecheck
corepack pnpm run build

Set-Location C:\devs\vite-plugin-feathersjs
node examples/r17/scripts/certify-r17.mjs --case daisyui-spa --adapter koa
node examples/r17/scripts/certify-r17.mjs --case daisyui-spa --adapter express
node examples/r17/scripts/certify-r17.mjs --case daisyui-ssr --adapter koa
node examples/r17/scripts/certify-r17.mjs --case daisyui-ssr --adapter express --production
node examples/r17/scripts/certify-r17.mjs --case daisyui-ssg --adapter koa
```

Quasar SSR conserve son `CERTIFY_R16_WINDOWS.ps1` déjà certifié. Quasar SSG reste **bloqué** tant que sa toolchain n'est pas qualifiée. Socket.IO sur SSR/SSG daisyUI n'est **pas encore certifié**, donc `--socket` est explicitement refusé dans ces cas.

## Alternative : lancement manuel

Deux terminaux, dans le dossier de l'exemple SPA :

```powershell
# Terminal 1 :
corepack pnpm run dev:api
# Terminal 2 :
corepack pnpm run dev
```

Dans un troisième terminal, depuis la racine :

```powershell
node examples/r17/scripts/check-feathers-http.mjs
```

Playwright manuel exige `R17_CASE` (identité du projet), `R17_MODE` et `R17_BASE_URL` :

```powershell
Set-Location C:\devs\vite-plugin-feathersjs\examples\quasar-ssr
$env:R17_CASE='quasar-spa'
$env:R17_MODE='spa'
$env:R17_BASE_URL='http://127.0.0.1:5173'
$env:R17_SOCKET='0'
corepack pnpm exec playwright test --config playwright.r17.config.mjs
Remove-Item Env:R17_CASE,Env:R17_MODE,Env:R17_BASE_URL,Env:R17_SOCKET -ErrorAction SilentlyContinue
```

Le lanceur est préférable : sans lui, vous devez garantir vous-même l'identité des services, le nettoyage des ports et le démarrage effectif de l'API. Un `404` reste un échec ; il n'est ni filtré ni ignoré par les tests. Les pages des exemples ont désormais un favicon inline afin de ne pas provoquer de requête implicite vers `/favicon.ico`.

## Projet généré à la demande

Une nouvelle génération R17-r1-r1 insère un marqueur `r17-example` dans `index.html`. Pour un ancien projet déjà généré, ajouter ce marqueur (par exemple `<meta name="r17-example" content="quasar-spa">`) à son HTML, puis utiliser `--project portail-quasar` avec `--case quasar-spa`. Le générateur ne remplace jamais un projet existant.
