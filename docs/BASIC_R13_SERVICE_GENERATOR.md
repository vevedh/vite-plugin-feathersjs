# Basic r13 — FeathersJS v5 service generator

## Purpose

`examples/basic` is a reusable **service-first** blueprint. It demonstrates the sequence used by Feathers v5: shared contract → backend service registration → typed client → optional Pinia store. The Vite plugin continues to auto-discover `server/services/*/*.service.ts`; neither Express nor Koa nor Socket.IO needs additional registration in `vite.config.ts`.

The local generator has no new runtime dependencies and does not alter the published plugin version (`0.2.6`). It is **not** a general Feathers CLI and does **not** replace `nuxt-feathers-zod`. The generated model is deliberately limited to a validated `title` field with an in-memory Map; future revisions can introduce Zod schemas, database adapters, hooks, authentication and authorization.

## Usage (Windows PowerShell)

From `examples/basic`:

```powershell
# Print all files first, without modifying the repository
node scripts/generate-feathers-service.mjs articles --store pinia --realtime --dry-run

# Generate a CRUD service, shared schema, typed client and Pinia store
node scripts/generate-feathers-service.mjs articles --store pinia --realtime

# Read-only service without a browser store
node scripts/generate-feathers-service.mjs metrics --store none --methods find

# Read-only store with string identifiers
node scripts/generate-feathers-service.mjs documents --id string --methods find,get --store pinia

# Validate generated sources
corepack pnpm run test:feathers:blueprints
corepack pnpm run test:feathers:generator
corepack pnpm run typecheck
```

Or, equivalently, `corepack pnpm run generate:feathers:service -- articles --store pinia --dry-run`.

The server auto-registers through Vite, so restart `pnpm dev` after adding a service if the watcher does not pick up a newly created file. A generator operation never overwrites an existing module.

## Generated layout

```text
examples/basic/
├── feathers.services.json                  # Machine-readable registry (v1)
├── server/services/articles/
│   ├── articles.service.ts                 # Feathers app.use + allowed methods
│   ├── articles.class.ts                   # Service logic and storage
│   └── articles.schema.ts                  # Server-only validators
├── shared/feathers/articles.schema.ts      # Contract usable in browser and server
└── src/feathers/services/articles/
    ├── client.ts                           # Official Feathers REST / Socket.IO adapter
    └── store.ts                            # Pinia useArticlesStore
```

Each generated client uses the common `createFeathersServiceApi()` factory. REST endpoints are mounted under `/api` on the Vite port; Socket.IO uses its dedicated port when explicitly enabled. A service generated without `--realtime` uses REST transport even if the overall example enables Socket.IO. The generated store has a browser-only `connect()` lifecycle, cleanup via `disconnect()`, a reactive `records` collection and the selected method actions.

Example Vue component usage:

```ts
import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useArticlesStore } from '~/feathers/services/articles/store'

const store = useArticlesStore()
const { records, loading, error, status } = storeToRefs(store)
onMounted(() => store.connect())
onUnmounted(() => store.disconnect())
```

Actions are selected by `--methods`. The default list is `find,get,create,patch,remove`; `update` is also supported. The store requires `find`, as it is used for hydration and reconnect refresh. ID types supported in r13 are `number` (default) or `string` (UUID when generated). Field definitions are intentionally not yet configurable.

## Safety and failure behavior

- Validates service name and path as lowercase kebab-case, maximum 48 characters. Rejects traversal, arbitrary JavaScript or TypeScript identifiers, duplicate manifest entries and conflicting files.
- Checks ancestor paths for symbolic links, including link destinations outside the example project.
- `--dry-run` makes no changes. Real generation builds everything in a temporary directory, then moves files into place, updating the manifest **last**. On failure, generated files are rolled back; existing files are never deliberately overwritten.
- Uses a `.feathers-generate.lock` file for serialization. A crash may leave the lock file behind; investigate before removing it manually.
- Demo services are public and in-memory. `--realtime` creates a **demonstration-only broadcast channel**; do not use that channel for private or multi-tenant data. Introduce authenticated channels, hooks, RBAC, durable persistence and server-side schema validation before deployment.
- No secrets are embedded into generated files, and nothing is sent to external services.

## Testing and release gate

`test:feathers:generator` tests option validation, dry run, CRUD + realtime, readonly, string IDs, no-store, collisions, path traversal/symlink defenses and **strict TypeScript diagnostics on the generated source** (using the example's installed `typescript` development dependency). Existing notes and health continue to be the network E2E references.

```powershell
corepack pnpm run check:basic:blueprints
corepack pnpm run check:basic:release
```

Typecheck and E2E validation on Windows are required for the r13 candidate. Future integration E2E should exercise a newly generated CRUD service against both Koa and Express (with Socket.IO on and off), not merely check the generated source shape.

## CLI roadmap

1. Define schemas through a typed field DSL / Zod and derive client/server validators from the same source.
2. Add template versioning, deterministic `--check`, `--diff` and safe template upgrades.
3. Generate persistence adapters and Feathers hooks (authentication, authorization, query validation).
4. Generate Vitest / browser E2E fixtures and documentation per service.
5. Extract the proven local implementation to a dedicated CLI package without coupling its runtime to Vitesse or the Vite plugin.

**Structure actuelle (r14) :** les modèles r13 sont désormais répartis en `.service.ts` (registrar), `.class.ts` (implémentation) et `.schema.ts` (validation serveur), avec contrat DTO partagé inchangé. Le glob de découverte ne charge que les registrars et les classes/schémas sont surveillés pour HMR. Voir `docs/BASIC_R14_SERVICES_PRELOAD.md`.
