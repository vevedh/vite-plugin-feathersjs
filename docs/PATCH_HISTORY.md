## R17-r1-r2 — Windows Playwright CLI resolution (candidate, 2026-10-29)

- Windows feedback R17-r1-r1: `FAIL: Playwright CLI unavailable` even though Playwright Edge ran in R16.
- Root cause: private `playwright/cli` resolution through @playwright/test; pnpm strict module graph + Playwright exports map reject that subpath.
- Fix: use documented `@playwright/test/cli` export, resolved from the R16 Quasar test project's package scope; preserve no-network preflight and Edge GPU-disabled config.
- Add deterministic fixture tests for exported CLI resolution and missing-package diagnostics.
- Core `src/`, npm 0.2.6, R16 freeze and `examples/basic` remain unchanged. Live Windows R17 certification pending.

## R16 — Clôture de certification Windows (2026-10-28)

- `@vevedh/vite-plugin-feathersjs@0.2.6` publié, installé en projet indépendant ; intégrité du registre et signatures vérifiées par le mainteneur.
- Plugin racine : TypeScript, 22/22 unitaires, 10/10 intégration, build, paquet scoped et audit runtime PASS.
- Quasar 2 SSR : 8/8 contrats navigateur, 35/35 contrats Node, Edge Dev Koa/Express 5/5 avec Socket.IO, Edge Production Koa/Express 5/5 avec Socket.IO.
- SSR compilé et dépendances 17/17 déclarées PASS ; aucune erreur d'hydratation Vue détectée lors des tests Edge.
- Sources de l'exemple R16 figées ; matrice, limites, preuves et empreintes dans `docs-private/maintenance/R16_CERTIFICATION_FINAL_2026-10-28.md` et `r16-freeze-manifest.json`.
- R17 ouvert avec un générateur de projets réutilisant le planificateur R15 ; **aucun moteur SPA/SSG nouveau n'est certifié à ce stade**.

## R16-r4 — FeathersJS native-private method receiver and Quasar MCP (2026-10-28)

- Windows r16-r3: 15/15 contracts and Quasar 2 SSR build PASS; Koa and Express `POST /api/notes` returned 500 because an unbound method accessed `#nextId` with a Feathers facade receiver.
- Bind the public NotesService methods to their owning service instance, preserving JS native private slots and per-instance memory state; no changes to the plugin runtime or Vitesse baseline.
- Add tests for detached/facade invocation, full CRUD, validation, isolation and Feathers v5 service registration (the latter runs when dependencies are installed).
- Keep the Quasar app-vite v2 SSR signatures, startup scripts and the production dependency installation contract unchanged.
- Candidate: actual Windows Quasar SSR HTTP/CRUD and production gates remain to be certified.

## R16-r3 — Quasar SSR v2 lifecycle and production dependencies (candidate)

- Use Quasar v2 SSR callback signatures for static mount and listen, keep loopback binding.
- Declare serialize-javascript in the generated SSR manifest and install dependencies under dist/ssr explicitly.
- Fail-fast checks, 4 lifecycle regression tests; avoid verbose dev SSR errors.
- Baseline examples/basic unchanged.

# Patch history and certification

## 0.1.0 — 2026-10-17
- Baseline: vite-plugin-express 1.0.3 (archive supplied).
- Implemented Feathers v5 REST adapter, Feathers 404 errors, deterministic module loader, HMR restart queue, file unlink watch, TypeScript strict package, tests and example.
- Verification: structural checks and zip validation in isolated sandbox.
- NOT CERTIFIED: npm install, typecheck, Vitest, HTTP E2E, Windows/Edge, and release publish. The environment cannot reach registry.npmjs.org. Do not claim those checks have passed.

## Next patch checklist
1. Read this file and `docs/AUDIT.md` before any change.
2. Verify Feathers service setup/lifecycle, hook ordering, validation, authorization and hydration edge cases.
3. Run `npm ci`, `npm run check`, Vite dev integration E2E on Windows/Node22.
4. Record command logs, failure conditions, corrections and version here.

## 0.2.0 — Three transport modes (candidate)
- Koa default and Express alternative, both Feathers v5 REST transports.
- Optional Feathers Socket.IO on dedicated port; no Vite WebSocket hijacking.
- Runtime startup, teardown and rebuild serialization.
- Explicit socket origins, port validation and non-public-channel defaults.
- Typecheck, package installation and E2E not certified in this environment.
- Known issue: Socket.IO HMR requires a port restart; a failed replacement cannot preserve the previous live port.

## 0.2.1-r1 — Windows TypeScript build correction (17 October 2026)

- Replace nonexistent Vite `closeServer` Plugin hook with HTTP `close` listener.
- Adapt the Feathers Express v5 factory across NodeNext module typing; use named Feathers middleware exports.
- Normalize readonly CORS origin arrays to mutable arrays.
- Provide explicit Express request/response/next parameter types.
- Remove unused socketServer local; Feathers app.teardown handles the listener.
- No auth bypass or wildcard Socket.IO origin added.
- Pending: Windows certification, actual HTTP/socket E2E, and `npm audit --json` triage.

## 0.2.2-r2 — Feathers Express REST configurator type bridge

- Correction ciblée de `TS2345` sur `web.configure(rest())` avec `exactOptionalPropertyTypes`.
- Alignement local de la signature de `rest()` sur le callback attendu par `web.configure`, sans modification de son comportement runtime.
- Maintien des adaptateurs Koa, Express, Socket.IO et de TypeScript strict.
- Validation Windows (`npm run typecheck`, `npm run test`, `npm run build`) à exécuter par le mainteneur.

## 0.2.3 — Transport E2E / fast checks
- Added real loopback HTTP CRUD tests for Koa and Express and Socket.IO client tests for each adapter.
- Added bounded-worker fast/release test scripts for quicker Windows iteration.
- Added production-only audit command, preserving the ability to distinguish runtime vs development vulnerabilities.
- Security gate: review `npm audit --json` locally; do not use `npm audit fix --force`.
- Baseline 0.2.2: Windows typecheck, 15 tests, build and npm pack dry-run PASS (user-verified).
- 0.2.3: candidate; Windows validation pending.

## 0.2.4-r1 — dependency security and glob performance
- Baseline Windows 0.2.3-r1 certifiée (15 tests unitaires + 4 intégration, compilation et pack).
- Remplacement de globby par tinyglobby pour réduire la profondeur de dépendances et traiter le chemin vulnérable de globbing.
- Mise à niveau candidate Vitest 5.0.5, à certifier sous Windows.
- Audit de sécurité documenté: `docs/SECURITY_AUDIT.md`.
- Aucune affirmation de certification 0.2.4 ou d'audit zéro sans exécution npm.

## 0.2.4-r2 — Security audit follow-up (17 October 2026)

Windows evidence for 0.2.4-r1: `npm audit --omit=dev` reported 0, full audit reports 3 high findings (`nanoid`, `postcss`, `source-map-js`). This release provides `scripts/SECURITY_FIX.ps1`, a guarded PowerShell 5.1/7 remediation with backups, non-forced `npm audit fix`, both audit gates and release certification. No dependency versions were forcibly overridden; run the script on the existing Windows workspace so npm updates its actual lockfile. The script deliberately fails closed. No test results for r2 claimed in advance.

## 0.2.5-r1 — HMR inventory filter and versions audit (2026-10-17)

- Baseline: 0.2.4 Windows PASS (19 tests; npm audits 0/0, build and pack PASS).
- Avoid unnecessary application rebuilds after unrelated file additions/removals by comparing the newly discovered glob set with registered modules.
- Existing tracked service edits still trigger a full runtime rebuild. A restart of Socket.IO remains necessary; persistent sockets are **not** guaranteed.
- Added pure HMR predicate tests; optional faster Vitest run using `--no-isolate` (must validate isolation first).
- Added `versions:check` to inspect actual npm registry latest versions without automatic upgrades or lockfile mutations.
- No dependency range changes; registry access was unavailable in the authoring runtime.
- Known caveat: security fixes applied by SECURITY_FIX.ps1 to package-lock.json in Windows are not embedded in this source archive. On Windows, preserve the validated lockfile and rerun audits.

### 0.2.6-r1 — in-place Socket.IO HMR contract and dependency alignment
- Introduce explicit `hotUpdate(app)` contract for tracked, modified service modules; retain live sockets only if every changed module opts in.
- Changes that add/remove modules or lack `hotUpdate` retain safe restart.
- Ignore directory notifications (file notifications still trigger inventory lookup).
- Align development Feathers packages to 5.0.50, Socket.IO client 4.8.4, CORS 2.8.6 and @types/cors 2.8.19; peer ranges remain compatible with Feathers v5.
- Preserve lockfile from validated Windows installation; verify npm audit and check:release again.
- No assertion of local npm tests: environment has no installed npm dependencies.

## 0.2.6 Vitesse integration candidate
Integrated supplied Vitesse as `examples/basic`, with dev-only Feathers endpoints and Socket.IO client status UI. Documented Vite 8 peer mismatch, downgraded example Vite catalog to 7, removed stale lockfile, and documented Windows acceptance. No changes to plugin runtime.

## Basic r2 (2026-10-17)
- Optimized optional Cypress install, eliminated external UnoCSS font fetch, added socket CRUD/event demo and controlled source checks. Plugin version remains 0.2.6. See BASIC_R2_PERFORMANCE_REALTIME.md.

## Basic r3 — 2026-10-17 — Socket.IO publisher ordering

- Bug Windows: Vitesse demo failed on boot with `TypeError: service.publish is not a function`; REST remained 404 and browser Socket.IO disconnected.
- Root cause: Socket.IO adapter configured only AFTER service registration. Feathers injects channel publishing support when socket transport is configured.
- Fix: configure Socket.IO before user modules; retain explicit demo channel `demo-notes`, no public broadcast by default in library.
- Tests: two new live integration cases (Koa and Express) register the real Vitesse notes module and require a Socket.IO `notes created` event.
- Status: candidate, Windows validation required. The earlier static contracts did not cover runtime publication.

## Basic r4 — Windows TypeScript fix and four adapter/transport combinations
- `notes.ts`: strongly typed Feathers `RealTimeConnection` instead of `unknown` for channel membership.
- Vite environment mode selection, REST-only UI, PowerShell switch script, contract and documentation.
- No package versions changed. Candidate pending Windows certification.

## Basic r5 — 2026-10-17 — REST-only publisher guard
- Fixed startup failure for REST-only Express and Koa: only register demo channels and service publisher when Socket.IO added `publish()`.
- Added two live REST-only service tests using actual Vitesse modules (health and notes, including CRUD).
- Preserves 0.2.6 core and Socket.IO modes; Windows verification pending. See `docs/BASIC_R5_REST_ONLY_FIX.md`.


## Basic r6 — 2026-10-17
- Ajout E2E quatre modes, CRUD HTTP/Socket.IO, double client et mesure du temps de disponibilité.
- Ports Socket.IO configurables pour l’isolation des tests ; interface Vitesse synchronisée.
- Fermeture ciblée des processus enfants Windows ; rapport de certification privé.
- Pas de modification du runtime `vite-plugin-feathersjs@0.2.6`.
- État : candidate, certification Windows requise.

## Basic r6-r1 — 2026-10-17 — Dynamic Socket Port Contract Fix
- Correction du test `test:feathers:contract` devenu obsolète après ajout de `FEATHERS_SOCKET_PORT`.
- Contrôle explicite du port par défaut 3031, de `port: socketPort`, de l'activation conditionnelle Socket.IO et de `FEATHERS_TEST_ORIGIN`.
- Préserve la matrice E2E et les ports isolés sans figer la configuration dans `vite.config.ts`.
- Contrats statiques et syntaxe E2E validés localement ; tests réseau complets à valider sous Windows.

## Basic r7 — 2026-10-17
- Benchmark répétable et médianes pour les quatre modes, référence r6 conservée.
- Profil opt-in transport-only PWA/DevTools exclues pour diagnostic ; défaut Vitesse inchangé.
- Script PowerShell 5.1 avec restauration de l’environnement, rapports distincts.
- Tests live restent exécutés pour chaque scénario et le profil complet reste obligatoire.

## Basic r8 — 2026-10-17
- Startup tracing opt-in for Vite/Feathers phases, alternating Full/Transport benchmark, JSON report. Baseline r7 retained. Windows certification pending.

## Basic r8-r1 — 2026-10-17
- Strict bounded shared parser for blank/missing FEATHERS_E2E_RUNS and FEATHERS_R8_RUNS; regression tests; four-mode certification remains required on Windows.

## Basic r8-r2 — 2026-10-17
- Fix du build manquant `dist/performance.js` dans le snapshot local pnpm `file:../..`.
- Préflight build + synchronisation sélective du `dist` avant certification et profilage ; pas de réinstallation.
- Certification E2E Windows en attente.

## Basic r8-r3 — ESM package resolution (2026-10-17)
- Replaced CommonJS `require.resolve` of ESM-only `vite-plugin-feathersjs` in `examples/basic/scripts/prepare-local-plugin.mjs` with direct package-directory resolution and manifest/realpath validation.
- Added simulated-pnpm regression test `test:feathers:local-resolution` to the Basic release checks.
- Runtime/exports unchanged; Windows end-to-end re-certification pending. Details: `docs/BASIC_R8_R3_ESM_RESOLUTION_FIX.md`.

## Basic r8-r4 — 2026-10-17

- Résolution du `ERR_FS_CP_EINVAL` lors de la préparation du package local pnpm sous Windows : détection des fichiers source/destination de même identité et synchronisation idempotente.
- Ajout du test `test:feathers:local-dist-sync` pour hardlinks, copie indépendante et symlink de répertoire.
- Contrats Express/Koa/Socket.IO et version 0.2.6 inchangés ; certification E2E Windows requise.

## Basic r9 — Config startup diagnostics (candidate, 2026-10-17)
- Baseline r8-r4 Windows 4/4 network cases and 24/24 alternating cases PASS.
- Opt-in, redacted Vite config debug duration capture; stage analysis and Windows benchmark wrapper.
- No changes to service adapters or runtime. Windows r9 benchmark pending.

## Basic r10 — Config loader A/B candidate (2026-10-17)
- Added explicit, opt-in Vite config-loader comparison (`bundle` default, `runner` experimental), with four-mode network E2E and timestamped JSON reports. Runtime Feathers unchanged.
- Regression contract and documented rollback to bundle; Windows certification pending.

## Basic r11 — Feathers v5 client + Pinia (2026-10-17)
- Introduced browser-only official Feathers REST/Socket.IO clients and a typed Pinia store for notes.
- Replaced raw socket.emit usage in Vitesse UI with store CRUD and event subscriptions.
- Kept all four adapter modes, added static contract and documentation.
- Requires Windows pnpm installation, vue-tsc and E2E certification.

## Basic r12 — Service-first Feathers + Pinia blueprint
Shared notes/health contracts, service-owned notes store, versioned services manifest and structural checks. Preserves backend auto-discovery, old Pinia import, and four transport modes.

## Basic r13 — Local service generator and shared transport (2026-10-27)

- Added a local CLI (`examples/basic/scripts/generate-feathers-service.mjs`) backed by a deterministic service-first template: contract, Feathers server, typed client and optional Pinia store.
- Supports `--name`, `--path`, `--methods`, `--id number|string`, `--store pinia|none`, `--realtime`, and `--dry-run`.
- Updates `feathers.services.json` last in a staged transaction, with refusal to overwrite, symlink checks, process lock and rollback on failure.
- Added strict generated-TS and generator security regression tests, wired into Basic blueprint and release checks.
- Refactored the existing notes client to use a shared Feathers v5 transport factory, preserving `createNotesApi()` and `useNotesStore()` imports. Corrected the REST transport base to `${window.location.origin}/api` for the Vite middleware prefix.
- No published runtime or dependency version changes. Windows full typecheck and live E2E remain to be certified by the maintainer.

## Basic r13-r1 — Vite project setup and nested script invocation (2026-10-28)

- Keep plugin and service-generator behavior unchanged; replace nested pnpm script calls with npm script runner so the project pin `pnpm@10.30.2` remains valid even when a global pnpm 12 is on PATH.
- Preserve explicit opt-in development-only inspection tooling and local-only networking; no change to production transport, version or published dependencies.
- Add a project-local static contract for startup settings, service-first generation and package manager pin. Full Windows certification pending.

## Basic r14 — Feathers service folders, fast dev and HTML preload (2026-10-28)

- Preserve `vite-plugin-feathersjs` 0.2.6 and the four Koa/Express + REST/Socket.IO variants. Reorganize note and health demo services into `server/services/<name>/<name>.service.ts`, `.class.ts`, `.schema.ts` with shared browser-safe DTOs.
- Narrow `serviceFiles` to registration entries; add validated `watchDirectories` option to rebuild on service implementation/contract changes, not on arbitrary client edits. No unconditional service hot replacement or authentication changes.
- Update the r13 generator to emit the same directory layout, retaining atomic manifest updates, strict TS generation, Pinia stores and MCP read-only preview.
- Add opt-in `FEATHERS_FAST_DEV` with conditional PWA/DevTools/Shiki imports. Default Full Vitesse behavior unchanged. Add opt-in `FEATHERS_DEV_WARMUP` with a small Vite client warmup list.
- Add `.env.local`-compatible HTML preloading with fail-closed local font/image paths only; leave native Vite modulePreload untouched and disable extra preload by default.
- Add static/strict-generation/HMR-preload regression coverage, PowerShell alternating Full/Fast benchmark, and HTML-injection E2E gate. Windows `vue-tsc` and network certification still required.

## Basic r14-r1 — Windows overlay, schema and PWA fast mode

- Add hash-allowlisted migration of old flat `server/notes.ts` and `server/health.ts` registrations left by `Expand-Archive -Force`.
- Fix duplicate `healthMethods` export in shared schema and enforce a unique declaration in the structural test.
- Alias `virtual:pwa-register` to a typed no-op when PWA is disabled and avoid attempting service worker registration.
- Add negative regression tests for unknown files, links and idempotent migration.
- Keep FeathersJS v5 REST/Koa/Express/Socket.IO, Pinia stores, HTML preload defaults and dependency pins unchanged.
- Requires Windows typecheck and network certification.

## Basic r14-r2 — Vite 7 async UserConfig types (Windows TS2769)

- Contextually type the async config factory with `Promise<UserConfig>` and use
  `satisfies UserConfig` on the returned object. Do not cast away diagnostics.
- Add a static test to prevent loss of Vite config typing and verify that
  optional MCP/PWA/preload features remain in place.
- Preserve the r14-r1 migration, Feathers v5 services, Pinia, fast mode,
  package manager pin and all backend transport behavior unchanged.
- Windows `vue-tsc --noEmit` and network E2E certification remain required.

## Basic r15 — HTML E2E environment fix and future CLI choice planner (2026-10-28)

- Correct empty/inherited `FEATHERS_R10_CONFIG_LOADER` handling in `check-basic-e2e.mjs` through `boundedEnvChoice`, keeping invalid nonempty values rejected; force `bundle` for `check-r14-html-e2e.mjs`.
- Add a read-only `plan-feathers-project.mjs` capability planning CLI with deterministic JSON support for Quasar 2/daisyUI/daisyUI-kit, optional PWA, TypeBox/plain JSON Schema/Zod, multiple authentication strategies and named multi-database connections.
- Enforce Vite 7 + Quasar plugin v1 SPA constraint; surface Zod, OIDC, LDAP and kit licensing requirements instead of claiming operational support.
- Add test coverage for defaults, safety, conflicts, package recommendations and refusal to write the service manifest. Integrate into blueprint/release tests.
- Preserve the plugin version 0.2.6, r14-r2 services/Pinia/MCP architecture and runtime dependencies. Full Windows HTML E2E and four-mode certification are pending for this candidate.

## Basic r15-r1 — Windows HTML E2E isolation and SPA/SSR/SSG plan (2026-10-28)

- Fix release E2E config pollution: child process pins `VITE_HTML_PRELOAD=off`/empty assets, `bundle` loader, Full profile, one repetition; HTML preload gate independently pins `assets`, Fast profile, and a known local image. The parent environment is untouched; benchmarks remain independent.
- Treat blank HTML preload mode as `off`, while refusing invalid nonempty choices and preserving strict local-asset restrictions. Detect an early child exit instead of waiting for HTTP readiness timeout.
- Extend the read-only CLI plan to `spa`, `ssr`, `ssg`, with automatically chosen or explicitly requested `vite` / `quasar-cli-vite` rendering engines. Quasar standalone Vite plugin remains SPA-only; Quasar CLI with Vite is required for Quasar SSR/SSG (SSG beta).
- Record renderer, deployment and hydration considerations, privacy warnings, and not-yet-certified integration status; no claim of a functioning SSR/SSG scaffold. Preserve existing Feathers v5, Pinia, schemas, multi-auth, multi-database and PWA contracts.
- Add regression tests and documentation. No npm dependency upgrades or runtime transport changes. Windows typecheck and network E2E remain pending for this candidate.

## R16 — Quasar 2 / Vite SSR certification candidate (28/10/2026)

Ajout de `examples/quasar-ssr` sans changer le runtime du plugin ni la baseline Vitesse r15-r1. Frontend Quasar CLI v2 SSR + Pinia isolé par rendu, API indépendante exploitant l'export `createFeathersRuntime` du plugin 0.2.6, proxy loopback HTTP/WebSocket et tests dédiés. Contrôles Node statiques et proxy HTTP : PASS localement. La certification réelle du build Quasar, de l'API Feathers et de la production SSR reste à exécuter sur Windows.

### R16 visual candidate — Vite UI/UX + Quasar SSR example

- Mise à jour des pages des exemples Basic et Quasar SSR avec une hiérarchie visuelle responsive, des états réels provenant des services FeathersJS/Pinia, et la prise en charge du clavier/mouvement réduit.
- UI de Basic factorisée dans `ExampleShell.vue`, design tokens clair/sombre ; tableau de bord Quasar SSR et page 404 dédiés.
- Source d'inspiration : structures générales de consoles d'administration et bonnes pratiques d'accessibilité. Aucune ressource commerciale tiers embarquée.
- Tests de contrat visuel ajoutés ; aucun changement des services, transports, schémas ou du runtime FeathersJS 0.2.6.
- La certification du rendu Quasar SSR de production reste à effectuer sous Windows.


### R16-r2 — Quasar SSR certification hardening (2026-10-28)
- Preserve the last Windows-certified Vitesse/Feathers basic example; no runtime plugin changes.
- Fix Quasar CLI SSR `index.html` mount contract (`<!-- quasar:entry-point -->`).
- Add deterministic local pnpm plugin dist synchronization and Quasar v2 preflight.
- Windows certification detects process exits and port conflicts; prints log tails and cleans up child process trees.
- Production startup derives the compiled entry from generated `dist/ssr/package.json`, with path confinement checks.
- Add three automated tests; all 11 Quasar local Node tests pass.
- Still pending: real Quasar prepare/build, SSR hydration/Edge, Feathers API HTTP and Socket.IO on Windows.

## R16-r5 — Socket.IO private bind (2026-10-28)
Optional host loopback Socket.IO transport, Quasar SSR demo binding, two-adapter integration test and isolated G3 certification instructions. See `examples/quasar-ssr/docs-private/r16/R16_R5_SOCKET_LOOPBACK.md`.

## R16-r5-r1 — Root TypeScript / R14 service entrypoint compatibility (2026-10-28)

- Resolve TypeScript `false | SocketTransportOptions` errors in the async `listen` callback and in option-validation tests while preserving `exactOptionalPropertyTypes`.
- Update integration tests to import the canonical R14 Feathers service registration entrypoints rather than files removed in the layout migration.
- Add a zero-dependency regression gate at the start of `check:release`.
- No changes to examples/basic, examples/quasar-ssr, runtime transport semantics or package version 0.2.6. Windows network certification required.

## R16-r5-r2 — Strict optional Socket.IO hostname test type (2026-10-28)

- Fix one remaining Windows TypeScript `TS2322` in `tests/options.test.ts`: optional `host?` indexed-access type included `undefined` even when the invalid host test provided an explicit value.
- Replace the test-only cast with `NonNullable<SocketTransportOptions['host']>`; preserve runtime validation and `exactOptionalPropertyTypes`.
- Extend the root `check:r16-r5-r1` regression gate so the incorrect cast cannot return.
- No changes to production code, examples or dependency versions; full typecheck and network tests require Windows confirmation.

## R16-r6 — Quasar SSR Microsoft Edge / Playwright certification candidate (2026-10-28)

- Previous maintainer evidence: plugin `@vevedh/vite-plugin-feathersjs@0.2.6` published and externally installable, 22+10 root tests PASS; Quasar SSR Dev/Production Koa+Express REST CRUD PASS; Dev Socket.IO two-client Koa+Express PASS.
- Add Edge/Playwright 1.64.1 **only to private example devDependencies**, not to published npm package; isolate `http://127.0.0.1:8080`.
- Add real-browser SSR hydration/no-console-error, UI CRUD, two contexts, two-client UI realtime (opt-in), and responsive screenshot checks. Browser command is run *inside* the existing Windows process-lifecycle script with `-Browser` switch.
- Pinia exposes only the true Socket.IO connection state and never serializes the socket during SSR. Legacy Socket.IO contract test now matches the narrowed `socketOptions` source.
- Local candidate validation is static/Node only; real Windows Playwright and Quasar rebuild/typecheck remain to certify. Published npm `0.2.6` remains unchanged.

## R16-r6-r1 — 2026-10-28 — Windows Edge FFmpeg optional

- Correctif de la certification Quasar SSR : vidéo Playwright désactivée par défaut pour ne pas exiger FFmpeg lors des contrôles Edge essentiels.
- Option explicite `-Browser -Video` avec préflight de la révision FFmpeg attendue avant lancement des serveurs.
- Traces, captures sur échec et captures responsive restent actives ; tests de préflight ajoutés.
- Racine du plugin, package npm public 0.2.6 et `examples/basic` inchangés ; certification Windows navigateur requise.


## R16-r6-r2 — 2026-10-28 — Quasar accessible input selector + Edge GPU baseline

- Windows r16-r6-r1 evidence: Quasar 2 SSR HTTP/CRUD Koa and Express PASS; Edge SSR hydration, separate browser contexts and responsive PASS (3/5 each); one skipped test without `-Socket`; GUI CRUD failure was a Playwright selector timeout waiting for `[data-testid="note-title-input"] input`, not a demonstrated Feathers/Pinia failure.
- Fix the shared Playwright CRUD helper to find the Quasar QInput by its accessible name `Titre de la nouvelle note` and assert visible/enabled/filled state before submitting. Quasar forwards unknown native attributes (including `data-testid`) to its native input; the former descendant assumption was invalid.
- Set Edge flags `--disable-gpu` and `--disable-features=CalculateNativeWinOcclusion` with a single worker; keep Chromium an explicit fallback and Playwright video optional.
- Extend Node regression tests to prevent reintroduction of the broken descendant selector and enforce Windows Edge settings. Update Vite skill Windows guidance and the Quasar private certification procedure.
- No changes to FeathersJS runtime, the published scoped npm 0.2.6 package or Vitesse Basic reference. Real Windows E2E CRUD and two-context realtime tests on Koa/Express remain to certify for r16-r6-r2.


### R16-r6-r3 — Quasar SSR QInput hydration alignment (2026-10-28)

- Windows Edge R16-r6-r2: SSR-prefetched notes, UI CRUD, and separate browser contexts PASS on Koa. The responsive test found a real Quasar `QInput` hydration style mismatch: SSR `caret-color: transparent !important` versus client empty style. The Socket.IO browser test was not run in that log.
- Scope a `QNoSsr` placeholder to the interactive note-title `QInput` only. The surrounding form, service notes, SSR Pinia prefetch, and status cards remain server-rendered. Avoid suppressing Vue hydration warnings or changing the Feathers runtime.
- Preserve accessible Playwright textbox selection and strict warning capture, including checks at 390 px and 1280 px. Add a structural contract covering the narrow client-only boundary.
- Quasar and Vue document `QNoSsr` for browser-only content. R16-r6-r3 requires Windows Playwright execution before its hydration fix can be declared certified; Vitesse Basic and published npm 0.2.6 remain unchanged.

## R17-r2 — create-feathers-app CLI packaging and VitePress documentation (2026-10-29)

- New independent candidate package `@vevedh/create-feathers-app@0.1.0-rc.1` with a `create-feathers-app` npm bin. Repository root and plugin runtime remain unchanged; npm publication is not performed.
- Share the R15-based generator engine between the repository and the CLI package. Generate Quasar 2 SPA and daisyUI SPA/SSR/SSG, with Koa/Express, REST, and optional SPA Socket.IO. Unsupported choices fail explicitly.
- Add `dev:all` to generated projects and preserve safe, offline-first generation with no overwrite, no symlink destinations, and restricted project paths.
- Ensure the published tarball contains real `.gitignore` assets via `gitignore.template`, as npm pack excludes `.gitignore`.
- Add the public VitePress 1.6.4 documentation source in `docs/cli` and release/installation guidance.
- Preserve the 20-file R16 freeze manifest and all Windows-certified runtime code. New CLI and VitePress builds require Windows certification before npm publication.
