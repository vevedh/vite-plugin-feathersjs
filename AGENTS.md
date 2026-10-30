# Project agent — vite-plugin-feathersjs

Scope: Vite 7, Vue 3, TypeScript strict, FeathersJS **v5 Dove**, optional Koa/Express and Socket.IO, Pinia. **No Nuxt or Nitro**.

Read `.agents/skills/vevedh-full-web-stack-vite/SKILL.md` before editing. If an MCP result conflicts with installed Feathers v5 packages, prefer Feathers v5 source and the project's passing contracts; FeathersMCP currently indexes **v6** documentation, so treat it as comparative reference only.

## Implementation order

1. Preserve `vite-plugin-feathersjs` 0.2.6 plugin behavior and `examples/basic` four modes.
2. Shared typed contract -> server service -> typed Feathers client -> associated Pinia store -> Vue UI -> tests -> documentation.
3. Service-first generator: `examples/basic/feathers.services.json` is a registry, not a permission system; validate on server regardless of client types.
4. Feathers service methods and events are the only business API; Vite dev middleware is orchestration, not a data store.
5. Socket.IO is optional. REST-only must work identically, except for server-push events.
6. Never expose an unauthenticated production service, secrets, or public MCP endpoint. Do not assume authentication/RBAC exists where it does not.
7. TypeScript strict; no `any`, implicit untyped service IDs, or hidden retries of side-effectful requests.
8. Windows PowerShell 5.1+ and Node 22; test on Windows/Edge first. Keep LF in generated files.
9. Maintain public docs neutrally and privately track implementation decisions and evidence.
10. Never push, publish, change credentials, or auto-upgrade dependencies without explicit approval.

## Minimal gates

From `examples/basic`: `node scripts/test-vite-agent-setup.mjs`, `npm run check:basic:blueprints`, then `npm run check:basic:release` after dependencies are installed. Root plugin: `npm run check:release` when dependencies exist. Record verified versus pending gates.

## MCP

Local Feathers v5 MCP (stdio, manifest/dry-run) + FeathersMCP (stdio, v6 docs for comparison only) + Antfu Vite MCP (SSE, opt-in local only). Examples in `.vscode/mcp.json` and `.cursor/mcp.json`; package versions are pinned, auto-update of MCP config is disabled. See private agent references and `docs-private/maintenance/vite-agents-r13-r1.md`.

## FeathersJS v5 local MCP

`examples/basic/scripts/feathers-v5-mcp.mjs` exposes three strictly read-only stdio tools: `list_feathers_v5_services`, `inspect_feathers_v5_service`, and `preview_feathers_v5_service`. The preview delegates to the existing CLI generator with `--dry-run`; this local source of truth complements (not replaces) external documentation. Test via `npm run test:feathers:local-mcp`.

## Interface des exemples (candidate R16)

Pour les pages Vue/Vite ou Quasar SSR, voir l’agent local `.agents/agents/vite-ui-ux-designer.md` et la référence du skill `references/ui-ux-pro-max-codeandchill.md`. Les modèles CodeAndChill sont des références de conception uniquement ; ne jamais intégrer de code ou de ressources commerciales sans droits adaptés. Préserver les sélecteurs des tests, les stores Pinia et les cycles de vie SSR.

## ECC (optional only)

Use `.agents/skills/vevedh-full-web-stack-vite/references/ecc-setup.md` for the **reviewed, selective** ECC engineering workflow. Do not auto-install ECC or enable external agents/hooks. The project FeathersJS v5 service-first contract, R16 freeze, Windows Edge gates and Git exclusion rules take precedence. `scripts/ecc/setup-ecc.ps1` defaults to a no-network plan. Explicit Preview/Install are user-controlled; no project change requires ECC installation.
