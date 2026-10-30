# Blueprint service Feathers v5

Reference example: `examples/basic/feathers.services.json`, `shared/feathers/notes.schema.ts`, `server/services/notes/notes.service.ts` + `notes.class.ts` + `notes.schema.ts`, `src/feathers/services/notes/store.ts`, `src/lib/feathers-client.ts`.

Generated service contract:
- stable kebab-case name, route and identifier type; explicit exposed methods
- shared TypeScript types for service data, patch and result; server runtime validators required before accepting untrusted input
- server implementation + explicit method declarations; hooks and RBAC if enabled; no unrestricted publish
- typed client using official `@feathersjs/rest-client` or `@feathersjs/socketio-client`
- Pinia store for CRUD, loading/error, reconciliation, listener cleanup, SSR browser guards
- deterministic manifest registration, dry-run, transactional filesystem changes, no symlink traversal
- `--store none` supported for health/metrics; realtime is optional and requires actual Socket.IO transport

Use `node scripts/generate-feathers-service.mjs articles --store pinia --realtime --dry-run` first; run generator tests before and after. The r13 generator uses in-memory demo services, **not persistence or Zod/RBAC**; do not claim such capabilities until introduced and tested.

Discovery: `serviceFiles: 'server/services/*/*.service.ts'`; HMR watches `server/services` and `shared/feathers`. Each generated service contributes exactly one registration entry; never glob all `.ts` files once classes and validators are colocated.
