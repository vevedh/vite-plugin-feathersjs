# Vitesse Basic — FeathersJS v5 + Pinia

`/feathers` uses a **typed Feathers client** and a **Pinia composition store**.

- `src/lib/feathers-client.ts`: official Feathers REST/Socket.IO transport, typed notes contract, validation.
- `src/stores/notes.ts`: Pinia state, CRUD, realtime event merge, socket lifecycle and cleanup.
- `src/pages/feathers.vue`: UI, no direct socket emit calls.
- `server/services/notes/notes.service.ts`: original public in-memory demo service (not suitable for production).

The client is configured **only on mount**, avoiding browser references during SSG/SSR. In REST-only mode the same Pinia store provides CRUD without sockets. In realtime mode the Socket.IO transport provides both methods and events; REST is not redundantly configured on the same Feathers client.

## Windows setup

From `examples/basic` run:

```powershell
$env:CYPRESS_INSTALL_BINARY = '0'
corepack pnpm install
if ($LASTEXITCODE -ne 0) { throw 'Install failed' }
corepack pnpm run test:feathers:pinia-contract
if ($LASTEXITCODE -ne 0) { throw 'Contract failed' }
corepack pnpm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed' }
corepack pnpm run check:basic:release
if ($LASTEXITCODE -ne 0) { throw 'E2E failed' }
```

Note that the existing source-contract checks cover server transports, and the network E2E verifies the API but **does not yet automate a browser rendering test of the new Pinia UI**. Test `/feathers` manually in both REST-only and Socket.IO modes.

## Security

Server notes are public/ephemeral. Add authenticated Feathers channels, validation hooks, authorization and protected persistence before using this pattern in production. Never put tokens into public Vite environment variables.

## Generating a service with its associated store (Basic r13)

Generate a complete example using the same source layout as `notes`:

```powershell
node scripts/generate-feathers-service.mjs articles --store pinia --realtime --dry-run
node scripts/generate-feathers-service.mjs articles --store pinia --realtime
corepack pnpm run check:basic:blueprints
```

The generator creates a Feathers server registration, a shared contract, a typed Feathers client and a Pinia store, then updates `feathers.services.json`. It never overwrites existing services. For a server-only service, use `--store none`; for a read-only service, use `--methods find,get`.

See `../../docs/BASIC_R13_SERVICE_GENERATOR.md` for detailed conventions, restrictions and the roadmap to a standalone CLI. Services are intentionally in-memory and unauthenticated examples, not deployable production blueprints.
