# Basic r14 — Conventional Feathers v5 service folders, fast development and HTML preloading

## Why the service layout changed

Feathers v5 generated applications separate the service registration, implementation class and schema. The example now uses one directory per service. The Vite plugin is a dev integration, so it discovers a deliberately strict `*.service.ts` filename rather than importing every `.ts` file as a registration function.

```text
examples/basic/
├── feathers.services.json
├── server/services/
│   ├── notes/
│   │   ├── notes.service.ts      # app.use, methods, optional Socket.IO publisher
│   │   ├── notes.class.ts        # CRUD, in-memory demo state
│   │   └── notes.schema.ts       # server-only data/id validation
│   └── health/
│       ├── health.service.ts
│       ├── health.class.ts
│       └── health.schema.ts
├── shared/feathers/notes.schema.ts  # browser-safe contract
└── src/feathers/services/notes/store.ts  # Pinia
```

The generator creates the same service folder, shared contract, typed client and optional Pinia store. It refuses overwrites, duplicate service paths and symlink destinations. A manual service MUST export a default registration function from `*.service.ts`. `serviceFiles: 'server/services/*/*.service.ts'` loads only these entry modules. `watchDirectories: ['server/services', 'shared/feathers']` rebuilds the service when implementation or contract files change, with no unsafe in-place Socket.IO replacement.

Do not import `server/services/**` into browser/client modules. Shared contracts must remain browser-safe. Production apps still require authentication, authorization, persistence, query validation and isolated channels; demo service memory and public event channels are not suitable for production.

## Startup: opt-in fast development

The full Vitesse profile remains the default. The startup diagnostics in r8–r10 identified the majority of HTTP readiness delay before Vite finished resolving its configuration; no causal speedup is assumed.

| Environment variable | Default | Purpose |
|---|---|---|
| `FEATHERS_FAST_DEV` | `0` | `1` avoids importing PWA and Vue DevTools and disables Shiki-based Markdown highlighting in development; Vue Router, Markdown parser, Feathers, Pinia remain active |
| `FEATHERS_DEV_WARMUP` | `0` | `1` pre-transforms the main entry and Feathers page with Vite `server.warmup`; may delay HTTP readiness |
| `VITE_HTML_PRELOAD` | `off` | `assets` activates selected public asset preload links in HTML |
| `VITE_HTML_PRELOAD_ASSETS` | empty | Comma-separated paths to **existing** `public/` font/image files, max 8 |

Variables can be set in PowerShell before starting Vite or placed in `.env.local` (copy `.env.example`). Restart Vite after changing them. Never put credentials in `VITE_`-prefixed variables.

Example (PowerShell, from `examples/basic`):

```powershell
$env:FEATHERS_FAST_DEV = '1'
$env:VITE_HTML_PRELOAD = 'assets'
$env:VITE_HTML_PRELOAD_ASSETS = '/pwa-192x192.png'
corepack pnpm run dev
```

`/pwa-192x192.png` is included only as a **functional example**; PWA icons are typically not critical rendering assets and should not be preloaded in production. Prefer an above-the-fold hero image or a locally hosted font that is actually used immediately. Keep the preload list empty otherwise.

The generated HTML contains a link such as `<link rel="preload" href="/images/hero.webp" as="image" type="image/webp">`; fonts add `crossorigin`. Paths must be absolute, local to `public/`, non-symlinked, and use allowed extensions (`woff`, `woff2`, `png`, `jpeg`, `webp`, `avif`, `svg`). No HTML injection or external resources are accepted. JavaScript chunk preloading remains under Vite's native `build.modulePreload` (default); the example does not inject speculative JS modulepreloads. HTML preload is not HTML SSR and does not pre-render the application.

## Performance testing and certification

```powershell
Set-Location C:\devs\vite-plugin-feathersjs\examples\basic
corepack pnpm run test:feathers:r14-structure
corepack pnpm run test:feathers:html-preload
corepack pnpm run test:feathers:generator
corepack pnpm run typecheck
corepack pnpm run check:basic:release
.\scripts\PROFILE_R14.ps1 -Runs 1
```

`PROFILE_R14.ps1` alternates **Full vs Fast** at each repetition and runs four network scenarios per profile. It leaves `VITE_HTML_PRELOAD=off` to isolate configuration-loading effects. It generates `docs-private/basic-r14-{full|fast}-runN.json` and `docs-private/basic-r14-performance-analysis.json` with recorded medians. This run is a comparison, not a guarantee of performance improvement. To independently verify HTML injection and REST/Socket.IO in all four modes:

```powershell
corepack pnpm run check:basic:r14-html-e2e
```

Build/SSG and browser preloading can also be checked with browser DevTools Network: inspect the HTML response and confirm the preloaded resource is fetched once, is actually used, and does not compete with the API or primary page assets.

The source syntax and targeted tests were checked when building the candidate ZIP. The actual Windows `vue-tsc`, production Vitesse build, four-mode E2E and elapsed-time comparison remain release gates before adopting defaults.

## Windows overlay hotfix r14-r1

For the `Expand-Archive -Force` migration of previous flat services, duplicate `healthMethods`, or missing `virtual:pwa-register` when `FEATHERS_FAST_DEV=1`, see [BASIC_R14_R1_WINDOWS_FIX.md](BASIC_R14_R1_WINDOWS_FIX.md). The version-preserving migration runs automatically before the structural test, and refuses modified legacy files.
