# Basic r15-r1 — Deterministic HTML E2E and CLI rendering plans

## Why this patch

The r15 Windows HTML gate passed for all four Feathers modes, but `check:basic:release` subsequently failed during Vite config evaluation with `VITE_HTML_PRELOAD must be off or assets`. The general release command inherited an uncontrolled `VITE_HTML_PRELOAD` value, whereas the HTML gate pinned `assets`. This was a **configuration failure before Feathers API readiness**, not a Feathers CRUD or Socket.IO failure.

## Environment isolation

- `check-release-e2e.mjs` now launches the standard four-mode release gate with `VITE_HTML_PRELOAD=off`, an empty asset list, `FEATHERS_R10_CONFIG_LOADER=bundle`, Full mode and an isolated report path. Only the spawned child environment is changed.
- `check-r14-html-e2e.mjs` retains a dedicated gate with Fast mode and `/pwa-192x192.png` in `assets` mode. It writes its own report.
- Empty or whitespace-only `VITE_HTML_PRELOAD` defaults to `off` in the HTML plugin; any **nonempty** unexpected value still fails closed. URLs, missing assets, symlinks, traversals and scripts remain rejected.
- On config failure, the E2E poller now notices a terminated child rather than waiting for the full HTTP deadline.
- Benchmark `PROFILE_R14.ps1` remains independent and still pins its own startup environment.

The existing public config variables `FEATHERS_FAST_DEV`, `FEATHERS_DEV_WARMUP`, `VITE_HTML_PRELOAD` and `VITE_HTML_PRELOAD_ASSETS` retain their meanings.

## Planned rendering compatibility

| UI selection | SPA | SSR | SSG | Framework/engine |
| --- | --- | --- | --- | --- |
| `daisyui`, `daisyui-kit` | Candidate | Planned | Planned | Vite + Vue 3 (`vite`, `@vue/server-renderer`, or `vite-ssg`) |
| `quasar2` | Candidate | — | — | standalone `@quasar/vite-plugin` v1.x with Vite 7 |
| `quasar2` | Planned | Planned | Planned (beta) | Quasar CLI with Vite (`@quasar/app-vite`) |

`--engine auto` selects Vite for daisyUI and Quasar SPA, Quasar CLI with Vite for Quasar SSR/SSG. Use `--engine vite|quasar-cli-vite` to request the path explicitly. `--ui quasar2 --render ssr --engine vite` fails because Quasar's standalone Vite plugin does not support SSR or SSG. The planner returns `rendering.integrationStatus: not-generated-or-certified`: it does **not** generate applications, implement SSR/SSG hydration, or demonstrate that this Feathers plugin works under Quasar CLI.

- Vue SSR needs a per-request Pinia instance, server-side routing/entry and hydration. Never serialize credentials, JWTs, secrets or private data into HTML.
- SSG should only pre-render public routes. Protected/private views must render on the client or use an authenticated API dynamically, not be baked into static pages.
- SSR requires a Node server and production deployment/caching validation; SSG frontend pages can be served statically but Feathers dynamic REST/Socket.IO still requires a deployed backend.
- PWA is a separate option; Quasar CLI PWA takeover and Vite PWA require independent certification. Quasar CLI SSG is **beta**.
- UI kit licensing and SSR-compatibility are not automatically guaranteed.

This planning extension preserves the TypeBox/JSON Schema/Zod, JWT/Local/OAuth/OIDC/LDAP, named multi-database, REST/Socket.IO choices and never writes credentials or service manifests.

## Windows verification

```powershell
Set-Location C:\devs\vite-plugin-feathersjs\examples\basic
corepack pnpm run test:feathers:r15r1-env-isolation
corepack pnpm run test:feathers:project-plan
corepack pnpm run test:feathers:html-preload
corepack pnpm run typecheck
corepack pnpm run check:basic:release
corepack pnpm run check:basic:r14-html-e2e
```

Example plans (read-only):

```powershell
node scripts/plan-feathers-project.mjs --name portail --ui quasar2 --render ssr --pwa on --auth jwt,local --json
node scripts/plan-feathers-project.mjs --name vitrine --ui daisyui --render ssg --schema zod --json
```

## Certification status

Static/regression tests and Node script syntax are verified locally. **Windows `vue-tsc`, the four live E2E modes and SSR/SSG runtimes are not certified by this archive.** The previous r15 HTML E2E on Windows passed, whereas its general release gate failed because of the preload environment.

## External documentation

- https://quasar.dev/start/vite-plugin/
- https://quasar.dev/quasar-cli-vite/developing-ssr/configuring-ssr/
- https://quasar.dev/quasar-cli-vite/developing-ssg/configuring-ssg/
- https://vite.dev/guide/ssr
