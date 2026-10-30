# Basic r15 — Project CLI capability matrix (planning prototype)

This candidate fixes the Windows HTML-preload E2E environment regression and establishes a **read-only capability plan** for a future application generator. It does **not** generate an application, connect to a database, register auth providers or add UI framework packages. `vite-plugin-feathersjs` remains `0.2.6` and Feathers v5 service discovery is unchanged.

## HTML E2E fix

`FEATHERS_R10_CONFIG_LOADER` may be inherited from the Windows process environment with an empty or whitespace-only string. `check-basic-e2e.mjs` now uses `boundedEnvChoice(...)`: unset, empty and whitespace fall back to `bundle`; nonempty `bundle` and `runner` are valid; any other value fails. The HTML E2E wrapper explicitly sets `bundle` to avoid ambient A/B benchmark settings affecting this gate. The existing E2E timeout is not increased to hide underlying startup problems.

```powershell
corepack pnpm run test:feathers:env
corepack pnpm run check:basic:r14-html-e2e
```

## Project CLI choices

Run from `examples/basic`:

```powershell
node scripts/plan-feathers-project.mjs --name demo-portail --ui quasar2 --pwa on --schema typebox --auth jwt,local,oauth --db main:mongodb,audit:postgresql --primary main --transport both --json
```

An alternative (including planned integrations requiring additional implementation):

```powershell
node scripts/plan-feathers-project.mjs --name portail-public --ui daisyui-kit --pwa off --schema zod --auth jwt,oidc,ldap --db main:mariadb,analytics:sqlite --primary main --dry-run
```

Options/constraints:

| Choice | Values | Generation readiness and caveats |
| --- | --- | --- |
| UI | `quasar2`, `daisyui`, `daisyui-kit` | Quasar 2 + Vite 7 needs `@quasar/vite-plugin` **1.x** (v2 plugin requires Vite 8+). The Vite plugin only supports SPA, so `--ui quasar2 --render ssg --engine vite` is rejected; `--engine auto` selects Quasar CLI with Vite (integration not generated). daisyUI uses Tailwind CSS + Vite. `daisyui-kit` is a reference for an externally licensed kit; no kit files are bundled. |
| Rendering | `spa`, `ssr`, `ssg` | Quasar standalone Vite plugin: SPA only. Quasar CLI + Vite is the planned engine for Quasar SSR/SSG (SSG beta). daisyUI SSR requires Vue SSR integration; SSG requires pre-rendering. Planning only. |
| PWA | `on`, `off` | `off` by default for new project plans; must separately implement and verify manifest, update and offline lifecycle. **Not** the same as `FEATHERS_FAST_DEV` for the current example. |
| Schema | `typebox`, `json`, `zod` | TypeBox and plain JSON Schema can use `@feathersjs/schema` with Ajv. Zod requires a separately implemented and tested Feathers v5 hook/validator/resolver bridge; planning the option does not mean the runtime supports it. |
| Authentication | `none`, multiple of `jwt,local,oauth,oidc,ldap` | JWT/local/OAuth are Feathers core strategies; local/OAuth automatically plan JWT. OIDC and LDAP are **custom integration required**. The future CLI needs issuer verification, callback allowlists, secret storage, user mapping, auth hooks and RBAC tests. |
| Database | `alias:memory|mongodb|postgresql|mariadb|mysql|sqlite` | Multiple named connections via comma lists. Each service must explicitly name a database connection. SQL uses Knex; MongoDB uses the Feathers MongoDB adapter; SQLite driver needs separate certification. No automatic cross-db transactions. |
| Transport | `rest`, `socketio`, `both` | Planning only; backend plugin remains independently configurable with Koa/Express and optional Socket.IO. |

The machine-readable JSON plan is deterministic and has `status: "planning-only"`, `writesFiles: false`. It exposes **environment variable names only** (such as `FEATHERS_DB_MAIN_URL`), not credentials. Neither the planner nor its tests writes to `feathers.services.json`.

## Proposed implementation stages

1. **r15**: validate the capability choices, incompatibilities and read-only JSON plan; fix HTML gate. This archive.
2. **r16**: generate a minimal Vite/Vue3/Pinia SPA with Quasar 2 or daisyUI, with optional PWA and a fully certified build.
3. **r17**: generate Feathers services with end-to-end tested TypeBox/JSON/Zod validators and security hooks.
4. **r18**: implement named database connection factories and per-service bindings, migrations and integration tests using isolated databases.
5. **r19**: add and certify multi-strategy authentication, per-service RBAC, account mapping and provider callbacks. Enable OIDC/LDAP only after the adapters pass tests.

No silent dependency upgrade or transitive package install is made during the planning stage.

## References

- Vite 7 config loader: https://v7.vite.dev/config/
- Feathers schema: https://feathersjs.com/api/schema/
- Feathers authentication: https://feathersjs.com/api/authentication/
- Feathers adapters: https://feathersjs.com/api/databases/adapters
- Quasar Vite plugin version requirements and SPA limitation: https://quasar.dev/start/vite-plugin/
- daisyUI Vite installation: https://daisyui.com/docs/install/vite/

For r15-r1 rendering-engine choices and Windows regression verification, see [BASIC_R15_R1_HTML_E2E_AND_RENDERING.md](BASIC_R15_R1_HTML_E2E_AND_RENDERING.md).
