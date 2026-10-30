# Basic r2 — FeathersJS v5 + Vitesse

This is a **development-only** example with REST `/api/health`, `/api/notes` and Feathers Socket.IO on port `3031`. It keeps the original Vitesse application, at `/feathers` for this demonstration.

## Windows install, optimized

From the monorepo root, run `npm install; npm run build` once. Then in `examples/basic`:

```powershell
.\scripts\INSTALL_FAST.ps1
corepack pnpm run test:feathers:contract
corepack pnpm run test:feathers:realtime-contract
corepack pnpm run typecheck
corepack pnpm run dev
```

`INSTALL_FAST.ps1` skips only the **Cypress binary** download (`CYPRESS_INSTALL_BINARY=0`) and restores the process environment variable afterward. Cypress test runner usage will require installing its binary separately. For subsequent reproducible installations, keep `pnpm-lock.yaml` and run `INSTALL_FAST.ps1 -FrozenLockfile`. Do not remove the lockfile unnecessarily.

Remote UnoCSS webfont downloads were removed for offline-friendly startup. Typography now falls back to local system fonts.

## Demonstration

Open `http://localhost:3333/feathers`. REST loads health and notes; Socket.IO creates, renames, deletes and synchronizes notes, and displays received realtime events. Use a second browser tab to check broadcast delivery.

**Security:** this example intentionally allows unauthenticated, non-persistent note operations and broadcasts demo data to every connected client. Never deploy it as a production backend without authentication, authorization, rate limiting and channel isolation.

## Known upstream Vitesse peer warnings

The source Vitesse archive declares a different Vue Router major than `vite-plugin-vue-layouts` expects, a different `vue-tsc` minor than `@vue-macros/volar` requests, and a newer `beasties` than `vite-ssg` requests. Avoid forced peer migrations until a clean Vitesse upstream compatibility verification is available.

## Validation scope

The source-contract checks only inspect the relevant files. They do not replace a live client/server test. After installing locally, also verify `corepack pnpm run typecheck`, the actual Socket.IO actions, and the browser console. We have not measured cold-start performance with the revised font configuration.

### Basic r3 — REST 404 / disconnected after r2

The service publisher failed because the plugin configured Socket.IO after registering services. Basic r3 fixes this in `src/app.ts` and adds live Koa/Express regression tests. Rebuild the parent package (`npm run build` at repo root), restart Vite and refresh `/feathers`. Running only the static source contracts cannot detect transport initialization failures.

## Basic r4 — four supported runtime combinations

Run in `examples/basic` after rebuilding the root package (`npm run build`).

| Mode | PowerShell | REST | Socket.IO |
|---|---|---|---|
| Koa REST only | `./scripts/DEV_MODE.ps1 -Adapter koa -RestOnly` | yes | no |
| Express REST only | `./scripts/DEV_MODE.ps1 -Adapter express -RestOnly` | yes | no |
| Koa + Socket.IO | `./scripts/DEV_MODE.ps1 -Adapter koa` | yes | yes |
| Express + Socket.IO | `./scripts/DEV_MODE.ps1 -Adapter express` | yes | yes |

Stop the current dev server with Ctrl+C **before** switching modes.
The browser route `/feathers` displays the current HTTP adapter and disables Socket.IO controls in REST-only mode.
Use `corepack pnpm run test:feathers:modes-contract` to verify mode wiring. This is a static contract test, not live transport certification.

The source of `notes.ts` now types connection handlers as `RealTimeConnection` from `@feathersjs/feathers`. Typecheck the root package first: it includes the demo service in the transport integration test.

**Security:** The demo exposes notes without authentication; it is for local development only.

## Service-first (r14) and optional faster development

The reference services use `server/services/<service>/<service>.service.ts`, `.class.ts` and `.schema.ts` with shared client-safe contracts in `shared/feathers/`. The generator emits the same structure, plus a typed Feathers client and optional Pinia store. Only `.service.ts` files are discovered; class/schema changes are watched for HMR.

Copy `.env.example` to `.env.local`. `FEATHERS_FAST_DEV=1` opts out of PWA/DevTools and syntax-highlight setup while retaining Feathers transports, Vue Router, Markdown and Pinia. `VITE_HTML_PRELOAD=assets` with `VITE_HTML_PRELOAD_ASSETS=/images/hero.webp` opts into HTML preload for an existing public image, while `off` remains the default. Vite handles production JS modulepreload automatically. Use `scripts/PROFILE_R14.ps1 -Runs 1` to compare startup times.
