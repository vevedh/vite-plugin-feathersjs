# Source audit — vite-plugin-express 1.0.3 → vite-plugin-feathersjs 0.1.0

Source: uploaded archive `vite-plugin-express-master.zip` (dated 2022-08-24). Contents: index.ts, package.json, tsconfig.json, README.md, yarn.lock, .gitignore.

## Findings

| ID | Severity | Location | Problem | Action |
| --- | --- | --- | --- | --- |
| A01 | High | index.ts watcher | `startApp` can execute concurrently on overlapping filesystem changes | serialize rebuild operations |
| A02 | High | index.ts watcher | event `unlink` ignored, removed modules remain live | track removals and rebuild |
| A03 | High | index.ts watcher | no disposal of watcher on Vite shutdown | unregister watcher, clear timers |
| A04 | Medium | index.ts | Promise.all registers routes nondeterministically | stable sequential registration |
| A05 | High | index.ts | errors on SSR module reload not handled | preserve working app and log error |
| A06 | Medium | index.ts | defaults apply CORS only to GET prefix, not complete API | explicit CORS options; disabled by default |
| A07 | Medium | index.ts | no request-body size governance | configurable JSON limit |
| A08 | Medium | index.ts | no service abstraction, hooks, provider | Feathers v5 application + REST transport |
| A09 | Medium | package.json | no tests or modern declaration packaging | test scaffolding, dist exports, strict TS |
| A10 | Medium | lifecycle | source assumes dev-only but lacks production guidance | explicit scope boundaries |

## Compatibility decisions

Breaking changes: old `middlewareFiles`, `prefixUrl`, `defaultMiddlewares` replaced with `serviceFiles`, `prefix`, `configure`/`afterRegister`. Former Express route middleware exports are **not** compatible: migrate to Feathers service registration functions.

`@feathersjs/express` remains the supported Feathers v5 REST transport and internally depends on Express. Therefore removing **the application's direct Express API** is feasible; removing the Express HTTP dependency requires another transport (Koa) and is not achieved by this release.

## Remaining risks / roadmap

- Ensure `app.setup()` and teardown semantics for custom service lifecycle hooks in a separate runtime contract before adding realtime support.
- Add integration tests using a real Vite dev server and HTTP requests, including cross-platform Windows watch semantics.
- Pin a lockfile and run dependency/audit checks when npm registry access is available.
- Validate Node/Vite combinations in CI, and verify release against latest actual Feathers v5.
- Preview is intentionally unsupported; use a standalone production Feathers application.
