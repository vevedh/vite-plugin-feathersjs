# Quasar official MCP — version-scoped project documentation

Use the **official** `@quasar/mcp` stdio tool to look up the installed Quasar version when adjusting `examples/quasar-ssr`, Quasar UI components and SSR configuration. Project configurations are included in `examples/quasar-ssr/.vscode/mcp.json` and `examples/quasar-ssr/.cursor/mcp.json` (intentionally ignored by Git). No project dependency or production service is added.

Official upstream configuration: https://quasar.dev/start/vs-code-configuration/

```
npx -y --fetch-retries=0 @quasar/mcp@1.0.0 --project ./examples/quasar-ssr
```

Open `examples/quasar-ssr` as the editor workspace; this preserves the root MCP configuration and the Vitesse agent contract. For a root workspace, merge the Quasar server entry into the root workspace MCP file and set `--project` to `${workspaceFolder}/examples/quasar-ssr`. `@quasar/mcp` provides project-version-aware `search_docs`, `get_page`, `list_api`, `get_api`, etc.; it does **not** run or certify Quasar SSR, FeathersJS services, or browser hydration.

**Important version limitation:** our certified candidate uses `quasar` 2.35.2 and `@quasar/app-vite` 2.6.2. The Quasar documentation bundle shipped for `@quasar/app-vite` is available in newer 3.9+ lines; the MCP server may report a missing CLI doc for the pinned v2 branch. In that case inspect the installed `node_modules/@quasar/app-vite` SSR wrappers (or v2 official docs), not a v3 signature.

For `Cannot read private member #nextId` consult FeathersJS v5 service registration and JS private receiver semantics (not a Quasar UI API). All service methods accessing native JS `#private` fields must preserve the original instance receiver even through Feathers v5 wrappers, using bound methods or equivalent closures. Require a real Feathers v5 network test and separately a Quasar SSR hydration test on Windows.

No code, configuration, output or secrets from MCP tools may be committed or exposed in public documentation. Never grant an MCP server filesystem write access merely to consult docs.
