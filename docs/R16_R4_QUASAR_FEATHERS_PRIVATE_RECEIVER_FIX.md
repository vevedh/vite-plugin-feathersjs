# R16-r4 — Quasar SSR service runtime correction

The Windows test of r16-r3 confirmed that Quasar 2 SSR builds and starts for both Koa and Express adapters. Its HTTP health endpoint responded, but POST `/api/notes` failed with status 500: `Cannot read private member #nextId from an object whose class did not declare it`.

The demo NotesService used native JavaScript `#private` fields and prototype methods. In FeathersJS v5, the call may run through an enriched service object rather than the original class instance; those private slots are not accessible through the wrong receiver. Binding the five CRUD methods in the service constructor keeps `this` as the original instance without weakening the private fields, validation or per-instance isolation. This change is limited to `examples/quasar-ssr`; the Vitesse baseline and plugin 0.2.6 remain unchanged.

Regression coverage includes CRUD, invalid input, missing IDs, receiver substitution and per-instance isolation. The real Feathers v5 integration test runs where dependencies are installed; it is reported as skipped otherwise.

## Windows gates

From `examples/quasar-ssr`:

```powershell
corepack pnpm run check:notes
corepack pnpm run check:contracts
corepack pnpm run build:ssr
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter koa
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter express
.\scripts\PREPARE_R16_PRODUCTION.ps1
corepack pnpm run check:production-deps
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Production -Adapter koa
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Production -Adapter express
```

After the REST/SSR gates pass, test Socket.IO with `-Socket` in an isolated loopback laboratory and verify SSR hydration in Microsoft Edge. Do not announce production readiness from build output alone.
