# Basic r12 — Feathers service-first blueprints

## Contract: one service, one schema, optional associated store

`examples/basic/feathers.services.json` is the machine-readable index for a future CLI.
This is a **contract/blueprint**, not a published CLI or full generic schema generator.

- `server/<service>.ts` — single auto-discovered Feathers v5 registration entry, compatible with existing `serviceFiles: server/**/*.ts`.
- `shared/feathers/<service>.schema.ts` — environment-neutral path, types, validation, events and method names.
- `src/feathers/services/<service>/store.ts` — service-owned Pinia store when the service needs browser state.
- `src/lib/feathers-client.ts` — existing official Feathers v5 transport selection, retained for r11 compatibility.
- `src/stores/notes.ts` — compatibility re-export, so current pages continue to work.

The Vite plugin itself remains provider-neutral: Express, Koa, REST-only and Socket.IO retain their behavior. The `notes` service is memory-backed and intentionally unauthenticated for demonstration only. **Do not deploy it publicly** without authentication, access controls, data validation and persistent adapters.

### Future CLI inputs

An interactive generator can ask for service name/path, ID type, CRUD method allowlist, transport, persistence adapter, schema shape, authentication and store/realtime options. It should first generate source into a staging directory, validate identifiers and paths, then atomically move files and update `feathers.services.json`. This manifest is a compatibility contract for the first iteration; do not assume it already describes field-level Zod schemas or database adapters.

### Verification

From `examples/basic`:

```powershell
corepack pnpm run test:feathers:blueprints
corepack pnpm run check:basic:blueprints
corepack pnpm run check:basic:release
```

This release does not introduce extra NPM dependencies, a new loader strategy or modifications to Feathers runtime.
