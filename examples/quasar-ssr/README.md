# Quasar 2 CLI (Vite) SSR + FeathersJS v5 — r16 certification candidate

This is an isolated certification example. It intentionally does not copy the supplied Firebase starter, `.env` or private configuration. The Vitesse `examples/basic` baseline is untouched.

## Architecture

- Quasar CLI v2 SSR on loopback port 9100; one Pinia instance per SSR request.
- FeathersJS v5 on 3030, from the **same `createFeathersRuntime` export** used by the Vite plugin; REST routes are mounted at `/api`.
- Optional Socket.IO on 3031. The Quasar demo sets `host: 127.0.0.1` and the plugin attaches to an explicitly loopback-bound HTTP server. The legacy default without `host` remains unchanged. The demo channel has no authentication; this example is strictly local-only.
- Local edge on 8080 forwards `/api` to Feathers, `/socket.io` to Socket.IO and all other requests to Quasar SSR. This is a **development / certification proxy**, not a hardened reverse proxy for production.

The SSR production server never relies on Vite `configureServer` or `ssrLoadModule`. Feathers service instances are created once per backend process, not once per HTML request. This candidate uses an in-memory notes service and an unauthenticated demonstration channel: **never expose it to an untrusted network**.

## R16-r2 certification fixes

- `index.html` now uses Quasar CLI's required `<!-- quasar:entry-point -->` marker, replacing the incompatible manual `#q-app` mount element.
- `scripts/preflight-r16.mjs` checks the installed Quasar CLI v2 and compiled plugin exports before starting processes.
- `scripts/sync-plugin-dist.mjs` synchronizes the *local pnpm package snapshot* after building the repository plugin; never copies identical pnpm hardlinked files onto themselves.
- The Windows certification checks ports and aborts immediately if one of the child processes fails, printing recent stdout/stderr lines.
- Production startup is resolved from Quasar's generated `dist/ssr/package.json` start command. The script never guesses an arbitrary SSR executable.

These checks do **not** certify an SSR build by themselves. Neither Quasar dependencies nor an actual SSR server are available in the current authoring environment.

## Windows procedure

From repository root, after installing dependencies of the main plugin:

```powershell
npm run build
Set-Location examples/quasar-ssr
corepack pnpm install
corepack pnpm run sync:plugin
corepack pnpm run check:contracts
corepack pnpm run check:preflight
corepack pnpm exec quasar prepare
corepack pnpm run build:ssr
corepack pnpm run check:production-entry
```

Open three separate PowerShell terminals (from `examples/quasar-ssr`):

```powershell
# Terminal A: HTTP FeathersJS backend
$env:FEATHERS_ADAPTER = 'koa'
$env:FEATHERS_SOCKETIO = '0'
node api/server.mjs

# Terminal B: Quasar SSR
corepack pnpm run dev:ssr

# Terminal C: local edge proxy
node scripts/edge-proxy.mjs
```

Then in a fourth terminal:

```powershell
corepack pnpm run check:runtime
```

For production SSR, stop the dev Quasar process, build with `corepack pnpm run build:ssr`, then launch the built server using the entry declared in `dist/ssr/package.json > scripts.start` (validated by `scripts/ssr-entry.mjs`). Restart the local edge and rerun `check:runtime`, then `check:production`. Check the emitted layout before setting the startup command; it can differ by CLI version.

For a second set of transport checks repeat with `FEATHERS_ADAPTER=express` and with `FEATHERS_SOCKETIO=1`. The demo socket uses origin http://127.0.0.1:8080 but CORS alone does not prevent other clients from connecting; verify firewall restrictions before enabling Socket.IO. Set `VITE_FEATHERS_REALTIME=1` at Quasar build/development startup to enable browser listeners. Realtime between two browsers has NOT yet been automatically certified by this example.

## Acceptance gates

- G0: `check:contracts`, `check:preflight`, `check:production-entry` and Quasar SSR build PASS; Quasar SSR returns HTML 200.
- G1: `check:runtime` PASS via the proxy; `/api/health`, notes CRUD, SSR HTML with prefetched note.
- G2: test Koa / Express and Socket.IO on/off; exercise websocket using browser clients.
- G3: no client hydration warnings; two isolated browsers; no JWT/cookies in server markup.
- G4: stop Quasar dev, start compiled SSR production; rerun G1-G3.
- G5: warm/cold timing separately for API and SSR; compare baseline without forced plugin reinitialization.

The starter was intentionally reduced to a clean benchmark rather than copying Firebase auth pages. The future CLI can generate this SSR variant while keeping the SPA and daisyUI options separate.

**NOTE:** `@quasar/app-vite` v2 is retained to match the user's Vite 7 era. Quasar CLI v3 currently uses Vite 8; migrating the plugin's peer range requires separate certification.


## R16-r3 — Windows runtime hotfix

Your Windows build of Quasar SSR **passed**, but its actual boot revealed two
issues that static tests could not detect:

1. `serveStaticContent` and `listen` still used the pre-v2 callback signatures.
   They now use `({ app, resolve }) => ({ urlPath, pathToServe, opts }) => { ... }`
   and `({ app, devHttpsApp, port })`, respectively. The SSR server is bound to
   loopback for local certification.
2. The compiled `dist/ssr/index.js` imports `serialize-javascript` from its own
   runtime. pnpm's root dev dependencies do not make it a declared runtime
   dependency. `ssr.extendPackageJson()` now declares it in the output manifest.
   After *every rebuild*, execute `scripts/PREPARE_R16_PRODUCTION.ps1` to
   install the manifest's dependencies under `dist/ssr` (production-only; scripts
   disabled), then run `corepack pnpm run check:production-deps`.

Run in `examples/quasar-ssr`:

```powershell
corepack pnpm run check:contracts
corepack pnpm run build:ssr
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter koa
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter express
.\scripts\PREPARE_R16_PRODUCTION.ps1
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Production -Adapter koa
```

The test script deliberately **does not** install runtime dependencies at
certificate time; preparation is a separate explicit action. The v2 development
error page has been disabled in the custom render middleware, because older
Quasar SSR debug handlers can expose environment variables. Maintain loopback
binding and avoid secrets in local dev until a separately audited v3 migration.

Historical R16-r3 limitation: at that stage, Quasar hydration and Windows SSR boot had not yet been certified. Subsequent Windows evidence confirms Dev/Production SSR and REST CRUD; R16-r6 introduces the remaining browser hydration certification.

## R16-r6 — Certification navigateur Edge

La certification HTTP seule ne prouve pas que l'hydratation Vue/Pinia est correcte.
Le test Playwright se lance **après** les contrôles REST et, éventuellement, Socket.IO, sur
les trois processus locaux démarrés par `CERTIFY_R16_WINDOWS.ps1`.

Depuis Windows 11, dans ce répertoire :

```powershell
corepack pnpm install
corepack pnpm run check:browser:contracts
corepack pnpm run check:contracts

# Développement : SSR + CRUD + deux navigateurs Edge
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter koa -Browser
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter express -Browser

# Développement : navigateur Edge + Socket.IO de bout en bout
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter koa -Socket -Browser
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter express -Socket -Browser
```

Edge stable doit être présent. Playwright utilise par défaut le canal officiel `msedge`,
avec GPU désactivé pour limiter les problèmes connus de pilotes Windows en laboratoire.
Si Edge est bloqué par une politique de l'entreprise, le repli Chromium est **explicite** :

```powershell
corepack pnpm exec playwright install chromium
$env:R16_BROWSER_CHANNEL = 'chromium'
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter koa -Browser
Remove-Item Env:R16_BROWSER_CHANNEL -ErrorAction SilentlyContinue
```

Pour le serveur SSR compilé, reconstruire avant chaque certification, avec Socket.IO
activé au **build** pour les scénarios temps réel :

```powershell
$env:VITE_FEATHERS_REALTIME = '1'
corepack pnpm run build:ssr
.\scripts\PREPARE_R16_PRODUCTION.ps1
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Production -Adapter koa -Socket -Browser
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Production -Adapter express -Socket -Browser
Remove-Item Env:VITE_FEATHERS_REALTIME -ErrorAction SilentlyContinue
```

Pour le mode production REST seul, construire avec `VITE_FEATHERS_REALTIME=0`,
réinstaller les dépendances compilées, puis appeler `-Stage Production -Browser`
sans `-Socket`. Les modifications du code SSR imposent toujours de reconstruire.

Les tests contrôlent l'HTML préchargé, l'hydratation sans erreur de console,
le CRUD via l'interface, les contextes de stockage séparés, le passage d'un événement
entre deux navigateurs et la largeur responsive (390/1280 px). Les rapports JSON,
traces et captures sont écrites sous `docs-private/r16/`, non suivies par Git.
La vidéo est désactivée par défaut : elle nécessite le FFmpeg fourni séparément par Playwright.
Pour enregistrer une vidéo en cas d’échec, exécuter
`corepack pnpm exec playwright install ffmpeg`, puis ajouter `-Video` aux appels `-Browser`.
Le préflight `corepack pnpm run check:browser:preflight` détecte les prérequis sans démarrer les serveurs ;
le script de certification contrôle FFmpeg avant les démarrages si `-Video` est demandé.
Le test Socket.IO est déclaré **skipped** lorsque `-Socket` n'est pas utilisé : il ne
compte jamais comme preuve d'un test temps réel exécuté.

Le serveur de notes partage volontairement les enregistrements entre les deux clients
et ne contient pas d'authentification. Les deux contextes Playwright ne certifient
**pas** l'isolation de données de deux utilisateurs ou le RBAC. L'exemple est strictement
réservé au loopback ; le proxy n'est pas destiné à une exposition publique.


### Microsoft Edge browser verification

Browser certification uses Playwright with Microsoft Edge and GPU disabled. For the SSR form, tests locate the Quasar title input by its accessible name, rather than depending on Quasar's internal DOM structure. Run `corepack pnpm run check:browser:contracts`, then `scripts/CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter koa -Browser` (or `-Adapter express`). For two-browser realtime checks, add `-Socket`. The test logs and responsive screenshots are stored under the ignored `docs-private/r16` directory.
