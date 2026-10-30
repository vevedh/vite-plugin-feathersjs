# Basic r13-r1 — Vite/Feathers MCP & pnpm nested command fix

Baseline: r13 service generator. Root `vite-plugin-feathersjs` remains 0.2.6. No library runtime changes.

## Evidence from user

- `test:feathers:generator`: PASS on Windows.
- `check:basic:blueprints` and `check:basic:release`: pnpm v12.15.0 spawned by nested `pnpm run` versus locked pnpm@10.30.2; fail before typecheck/E2E.
- Dry-run for articles printed the four expected files and manifest.

## Changes

- Replaced *nested* `pnpm run` script invocation with `npm run`. The initial command can stay `corepack pnpm run`; `packageManager` remains pinned to 10.30.2. No pnpm policy bypass.
- Added devDependency `vite-plugin-mcp@0.3.2` (optional dev use, install needed) and deferred opt-in `FEATHERS_VITE_MCP=1` loader, dev-only localhost:3333 strict port, no editor config rewrites. This is an experimental MCP integration, do not run in production.
- Added a dependency-free, read-only Feathers v5 blueprint MCP (stdio) and FeathersMCP v1.0.16 stdio connection (currently indexed **v6** docs). Agent forbids silent v5->v6 migration; verify in Feathers v5 official docs / actual package.
- Added agent/skill + service-first blueprint guide and Windows gates. Private .vscode/.cursor MCP configurations ignored by git.
- Added security/setup regression tests.

## Pending acceptance

- `corepack pnpm install` refreshes example environment for new dev-only MCP package, review new lockfile before committing.
- `corepack pnpm run test:feathers:agent-setup` PASS on Windows.
- `corepack pnpm run check:basic:blueprints` and `check:basic:release` PASS on Windows.
- `corepack pnpm run dev:mcp`, editor MCP connection and UI tests under Windows/Edge: NOT yet certified.

## Security boundaries

Do not expose SSE MCP to public network; do not enable its introspection on production servers. Do not store credentials in `.vscode`/`.cursor` files. `.gitignore` intentionally excludes private agent artifacts, not regular source/docs.

## FeathersJS v5 local MCP

`examples/basic/scripts/feathers-v5-mcp.mjs` exposes three strictly read-only stdio tools: `list_feathers_v5_services`, `inspect_feathers_v5_service`, and `preview_feathers_v5_service`. The preview delegates to the existing CLI generator with `--dry-run`; this local source of truth complements (not replaces) external documentation. Test via `npm run test:feathers:local-mcp`.

### Note sur TypeScript

`scripts/vite-mcp-loader.d.mts` declares the opt-in JS helper for strict TypeScript/Vite config checking.
