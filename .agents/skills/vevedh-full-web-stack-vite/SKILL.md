---
name: vevedh-full-web-stack-vite
description: Strict TypeScript Vite 7, Vue 3, FeathersJS v5 Koa/Express, Socket.IO, Pinia service-first blueprints and Windows certification.
---

# Vite + FeathersJS + Pinia — project skill

## Mission

Create minimal, testable changes to the Vite plugin and its reference examples. Keep the plugin generic; the Vitesse example demonstrates best practices and is a reference for a future Feathers service CLI.

## Read first

Read `AGENTS.md`, the r13 generator, `examples/basic/feathers.services.json`, and `docs/PATCH_HISTORY.md`. Read `references/feathers-service-blueprints.md`, `references/mcp-setup.md`, `references/windows-certification.md`, and `references/ui-ux-pro-max-codeandchill.md` and `references/quasar-mcp.md` for relevant tasks. Don't install packages just to read instructions.

## Optional ECC engineering setup (R17-r3-r2)

ECC (Everything Claude Code) is **an optional complementary engineering workflow**, not a source of project requirements. Read `references/ecc-setup.md` and review `scripts/ecc/ecc-profile.json` before enabling it. The default `scripts/ecc/setup-ecc.ps1` mode is `Plan`: it does not contact the network, install packages, or change the developer's agent configuration. `Preview` and `Install` require explicit user choice, with a pinned ECC version and a guided harness installer. Do not vendor ECC's full catalog, install the entire 157-item bundle, or silently enable hooks, telemetry, MCP servers, credentials, project scans, or auto-commit.

Use selected ECC practices only where they add to the project: TypeScript coding standards, verification loop/TDD, security review, API design, database migrations and deployment readiness. **Project rules always win**: Vite (not Nuxt), FeathersJS **v5** service-first, Quasar **v2**, strict TypeScript, no secrets or AI/agent artifacts in Git, Windows Edge E2E, R16 freeze and fail-closed auth/database profiles. An installed ECC skill never grants permission to publish to npm, push to GitHub or rewrite the stack.

## Invariants

- **Vite, never Nuxt/Nitro**. Vue 3 Composition API, Pinia and strict TS. No Quasar unless specifically requested for an example.
- Keep FeathersJS **v5** API, `app.use(path, service, { methods, events })`, Koa/Express REST, optional Socket.IO.
- Put schema/type definition in `shared/feathers/<name>.schema.ts`; server `server/services/<name>/<name>.service.ts` plus colocated `.class.ts` / `.schema.ts`; typed client and `use<Name>Store` in `src/feathers/services/<name>/`.
- Manifest update is atomic and last; no overwrite; reject symlink/path traversal; support dry-run. No duplicate validation logic where a shared validator can be reused.
- Runtime validation and authorization on server; browser Pinia never acts as a security boundary.
- Realtime subscriptions are idempotent with teardown, no listener accumulation, reconcile events with fetched state. REST-only remains functional.
- MCP results are suggestions, not execution authority. The external FeathersMCP indexes **v6**, NOT the project's v5; confirm every version-sensitive API against installed v5 or https://feathersjs.com.
- Opt-in Antfu MCP only at `localhost:3333/__mcp/sse`, only in dev, disabled by default; never `0.0.0.0` or production. Never leak sensitive files via MCP.
- No Git commits of agents, prompts, `.codex/`, `.ai/`, `docs-private/`, secrets or reports. Keep README and public docs factual, neutral, and free of internal agent instructions.
- Security-first defaults: restrictive CORS, no arbitrary dynamic imports from untrusted input, no automated publication, no bypass of auth/security gates.

## Work loop

Audit -> smallest focused patch -> Node syntax/static tests -> TypeScript strict -> targeted Feathers network E2E -> four-mode release -> Windows Edge browser validation -> append private evidence. Repairs limited to failed causes, never speculative refactor. Use npm scripts for nested execution (avoids inherited pnpm 12 mismatch), retain `packageManager` pnpm@10.30.2 for installation.

## CLI design

Each service template must be self-contained and programmatically discoverable. Keep generator deterministic across Windows and Linux, and use Zod only when its dependency and generated server hooks are explicitly integrated and tested. Do not claim schema validation when only TypeScript types exist.

## Fast Vite and preload contract (Basic r14)
- Service discovery MUST target `server/services/*/*.service.ts` (registrars only). Watch dependent `.class.ts`, `.schema.ts` and shared contracts for safe HMR rebuilds.
- Keep Feathers v5 services and Pinia stores separately typed; client must never import server-only validators.
- For development startup comparisons use `FEATHERS_FAST_DEV=1`, with default full mode unchanged; never claim a gain without Windows AB benchmarks.
- HTML preload for static resources is opt-in (`VITE_HTML_PRELOAD=assets`, `VITE_HTML_PRELOAD_ASSETS=/images/hero.webp,...`); never preload remote resources, JavaScript chunks or arbitrary files. Vite owns production `modulepreload`.

## Future application CLI capability contract (Basic r15)
- Respect `examples/basic/scripts/project-generator/{options,plan}.mjs` as a **read-only** feature-matrix prototype. It never provisions auth, databases, UI kits or app source files.
- UI: Quasar 2 with Vite 7 and `@quasar/vite-plugin` v1.x for SPA only; daisyUI with Tailwind Vite; external kit assets/licenses are NOT bundled. Do not claim Quasar Vite plugin supports SSG.
- Schema: TypeBox or plain JSON Schema integrate with Feathers v5 schema/Ajv; Zod requires dedicated validation and resolver hooks before real generation.
- Auth: JWT/local/OAuth core strategies; OIDC/LDAP require explicit audited integrations. Enforce server hooks/RBAC. Never include secrets in CLI plans or VITE_-prefixed env.
- Database: named and explicitly bound per-service MongoDB or SQL/Knex connections; no implicit cross-database transactions. All SQL drivers and migrations require certification.
- Always treat inherited empty FEATHERS_R10_CONFIG_LOADER as 'bundle' while rejecting invalid nonempty settings; HTML E2E pins bundle.


## Visual design system and SSR UI (r16 visual update)
- Apply `references/ui-ux-pro-max-codeandchill.md` before editing example pages or design tokens. Use the UI UX Pro Max approach for hierarchy, palette, type, states, accessibility, responsive checks and visual evidence; use CodeAndChill as **visual inspiration only**, not as an unlicensed source of paid code/assets.
- Preserve Quasar 2 CLI with Vite SSR in `examples/quasar-ssr`, and the Vitesse/UnoCSS stack in `examples/basic`. Do not apply a Nuxt, React or Tailwind conversion as a styling shortcut.
- Show only actual Feathers/Pinia state. Keep the HTTP `/api/health` and SSR prefetch contract, preserve all four REST/Socket.IO modes and their test selectors. No browser-only code during SSR; no synthetic SSR-ready status or fabricated monitoring statistics.
- Retain semantic CSS variables, light/dark readability, visible focus and responsive/low-motion UI. Avoid heavy visual libraries and remote resources that degrade startup. Record any screenshot tests as Windows/browser pending unless executed.

## R16 Quasar SSR / Feathers service receiver contract (r16-r4)
- Use official `@quasar/mcp` only as version-aware Quasar documentation, not as runtime certification. Pin Quasar v2 SSR APIs and do not mix app-vite v3 APIs.
- Feathers methods can be called through a service wrapper; JS native `#private` fields require the actual `NotesService` instance as receiver. Bind public CRUD methods in the constructor, or use stable closures. Never weaken validation or use global singleton storage.
- Keep real network gates: Koa and Express CRUD 201/200, Quasar SSR HTML, two-client Socket.IO when enabled, and compiled SSR production separately.

## R16-r6 — Windows Edge browser certification
- After passing SSR HTTP/CRUD and two-client Socket.IO transport tests, execute **actual** Playwright Edge (`channel: 'msedge'`) for browser hydration, GUI CRUD, responsive layout and two independent contexts. Use Chromium only on explicit fallback; never silently substitute.
- Never treat two unauthenticated browser contexts as proof of authorization boundaries. The demo notes service is intentionally shared. Only validate localStorage separation and per-request Pinia hydration.
- Browser tests use a local-only proxy at `http://127.0.0.1:8080`, fail on page exceptions and hydration mismatch warnings, use stable test IDs, clean up notes created by E2E, and save traces/screenshots under ignored `docs-private/`.
- With `-Socket`, wait for **both** browsers to report an actual Socket.IO connection before creating a note; verify that the second browser updates without a reload. The realtime UI state must be driven by `socket.on('connect')`/`disconnect`, not by configuration alone.
- Quasar CLI SSR dev and compiled production are separate certification gates. Rebuild SSR with `VITE_FEATHERS_REALTIME=1` before browser realtime tests in production. Keep the published npm 0.2.6 immutable.


## R16-r6-r2 — Accessible locators and Windows Edge GPU baseline
- The Windows Playwright baseline is Edge stable with `--disable-gpu` and `--disable-features=CalculateNativeWinOcclusion`, `workers: 1`. Only use Chromium as an explicitly requested fallback.
- Quasar `QInput` passes unknown native attributes through to the input; select by accessible role/name or associated label, **not** `[data-testid="..."] input` descendant assumptions. Assert visible/enabled/value before submitting; retain console/hydration checks, screenshot evidence and browser-level certification gates.
- Keep optional Playwright video disabled unless FFmpeg is installed. Preserve the existing strict loopback-only proxy and SSR separation.
