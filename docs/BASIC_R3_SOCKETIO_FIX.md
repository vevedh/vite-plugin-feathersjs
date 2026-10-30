# Basic r3 — Socket.IO initialization order

## Symptom

`[vite-plugin-feathersjs] reload failed: TypeError: service.publish is not a function` on Vitesse Basic r2; `/api/health` returns 404 and clients cannot connect to Socket.IO.

## Root cause and correction

Feathers services should register event publishers after configuring the Socket.IO adapter. `src/app.ts` now configures Socket.IO before loading service modules; the user’s `configure` callback and module registrations continue afterward. No unsafe `as unknown as PublishApi` runtime workaround or global unauthenticated broadcaster is added.

## Certification

From package root: `npm run check:release && npm run check:security`. This now includes live service registration and an actual `notes created` event test for both Koa and Express. Then start `examples/basic` using the existing pnpm installation; do **not** reinstall dependencies unnecessarily. Confirm `/api/health` reports `ok`, Socket.IO is connected, and creating a note produces an event.

## Scope

Development-only in-memory demo. Live clients must not be exposed without authentication and channel authorization.
