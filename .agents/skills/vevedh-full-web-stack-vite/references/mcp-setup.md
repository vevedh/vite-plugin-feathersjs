# Local MCP integration — opt-in

## FeathersJS MCP

`feathersjs-mcp@1.0.16` is a stdio MCP server from FeathersJS ecosystem. **Its indexed documentation is FeathersJS v6. This repository targets FeathersJS v5**, so treat results as comparative and verify version-sensitive claims in v5 docs / installed packages. Do not let suggestions silently migrate APIs to v6.

VS Code: `.vscode/mcp.json` -> `servers.feathersjs`, stdio npx args `-y feathersjs-mcp@1.0.16`. Cursor: `.cursor/mcp.json` -> `mcpServers.feathersjs`. No auto-update. MCP package downloaded only when started with user approval in their editor.

## Anthony Fu Vite MCP

`vite-plugin-mcp@0.3.2` is experimental. Enable only explicitly with `npm run dev:mcp` / `corepack pnpm run dev:mcp` in `examples/basic`, after installing dependencies. Normal `dev`, tests and builds never initialize it. The helper uses a deferred import; no MCP installation required for baseline tests.

SSE endpoint: `http://localhost:3333/__mcp/sse` on the **localhost-bound** Vite server; do not expose via tunnel, reverse proxy, container bridge or public interfaces. `updateConfig: false` prevents writes to editor configs or home. Do not enable when private tokens/source secrets might be exposed via module inspection.

`vite-plugin-mcp` is disabled by default. In the MCP-enabled dev command, port 3333 is strict. If another process holds the port, stop it rather than running on a random public port.

## Validation

1. `node scripts/test-vite-agent-setup.mjs`: exact pins, guards and editor config shape.
2. `corepack pnpm run dev:mcp` after installation and explicit consent; check SSE endpoint locally.
3. VS Code: `MCP: List Servers`; start `feathersjs` and `vite-local` manually in Agent mode.
4. Review permissions, tool output and any suggested changes before applying; MCP is not a trusted authority.

Documentation references:
- https://github.com/feathersjs-ecosystem/FeathersMCP
- https://github.com/antfu/nuxt-mcp-dev/tree/main/packages/vite-plugin-mcp
- https://feathersjs.com/guides/whats-new

## FeathersJS v5 local MCP

`examples/basic/scripts/feathers-v5-mcp.mjs` exposes three strictly read-only stdio tools: `list_feathers_v5_services`, `inspect_feathers_v5_service`, and `preview_feathers_v5_service`. The preview delegates to the existing CLI generator with `--dry-run`; this local source of truth complements (not replaces) external documentation. Test via `npm run test:feathers:local-mcp`.
