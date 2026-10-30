# Basic r5 — REST-only runtime fix (2026-10-17)

## Windows diagnosis

Vitesse `-Adapter koa -RestOnly` and `-Adapter express -RestOnly` failed with `TypeError: service.publish is not a function`. This kept `/api/health` at 404 because registration aborted. The screenshot correctly showed Socket.IO disabled, but REST was not initialized.

## Resolution

`examples/basic/server/notes.ts` registers a Feathers event publisher and connection channel only if the service actually exposes `publish()`, which is installed by the Socket.IO transport. In REST-only mode, CRUD registration remains enabled and publication is skipped. Socket-enabled modes retain the same publish/channel logic. No changes to package dependencies or to the primary plugin transport.

## Regression

`tests/transport.integration.test.ts` now runs real HTTP requests with the genuine Vitesse `health` and `notes` service modules in both REST-only modes: health, initial find, create, patch, remove. The existing real Socket.IO publisher tests remain.

## Windows acceptance

1. `npm run check:release` (expected: 19 unit + 8 integration tests)
2. `npm run check:security`
3. In `examples/basic`: `corepack pnpm run typecheck`
4. Start `./scripts/DEV_MODE.ps1 -Adapter koa -RestOnly`, check `/api/health` and `/feathers`, stop, repeat Express.
5. Restart both Socket.IO modes and ensure `notes created` is still broadcast.

This patch is unverified locally because npm dependencies are not installed here. Windows certification pending.
