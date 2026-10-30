# R16-r5-r1 — Root TypeScript and service entrypoints

This cumulative maintenance update fixes the **seven TypeScript errors** reported on Windows in `npm run check:release`, while preserving `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.

## Changes

- `src/app.ts`: narrow `options.socketio` once to `socketOptions` inside `start()`, then capture the guaranteed port/host in the asynchronous HTTP `listen()` callback. Both the loopback and legacy listener paths use this same value. No `!` assertions were added.
- `tests/options.test.ts`: construct a separately typed `SocketTransportOptions` object before varying the hostname. This prevents spreading the `false | SocketTransportOptions` union and accidentally making `port` or `origins` optional. Invalid hosts are deliberately cast only at the test boundary to exercise runtime rejection.
- `tests/transport.integration.test.ts`: load the R14 canonical registration modules (`server/services/<name>/<name>.service.ts`) through `vi.importActual<ModuleNamespace>()` instead of the deleted flat `server/notes.js` and `server/health.js`. Vitest performs the actual Vite transformation while the root `NodeNext` typecheck does not pull the example’s bundler-style source imports into its compilation scope. The Socket.IO publishing test still exercises the actual Vitesse registration module, as do the REST-only cases.
- `scripts/check-r16-r5-r1-regressions.mjs`: zero-dependency source contract check integrated at the beginning of `check:release`.

## Windows certification

From the repository root:

```powershell
npm run check:r16-r5-r1
npm run typecheck
npm run test:unit
npm run test:integration
npm run check:release
```

Then in `examples/quasar-ssr`:

```powershell
corepack pnpm run sync:plugin
corepack pnpm run check:contracts
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter koa -Socket
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter express -Socket
```

For compiled SSR with realtime enabled, set `VITE_FEATHERS_REALTIME=1` **before** `build:ssr`, then run `PREPARE_R16_PRODUCTION.ps1` and both production certification modes. Run the loopback demo in an isolated development environment; it deliberately has no authentication.

## Certification status

Static source contract and syntax checks are available without dependencies. The full TypeScript, Vitest network suite, and SSR/Socket.IO gates must run on Windows with installed dependencies. The last certified Vitesse/Quasar REST-only baselines are not modified.
