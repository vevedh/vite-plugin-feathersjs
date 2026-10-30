# R17-r3 Windows gates

1. `node scripts/check-r16-freeze.mjs`
2. `node --test tests/r17-cli-package.test.mjs tests/r17-generator.test.mjs tests/r17-runner.test.mjs tests/r17-r3-features.test.mjs`
3. `node scripts/check-r17-docs.mjs`, followed by `corepack pnpm run build` under `docs/cli`.
4. `node scripts/stage-r17-cli.mjs` then `npm pack --dry-run --json .release/create-feathers-app`: no `node_modules`, `dist`, `.env` or private documents.
5. Generate Quasar 2 SSR into a fresh directory from the **staged CLI**. Install pnpm deps; run typecheck and build: SSR; then start API + SSR + reverse proxy, run R16 Playwright Edge against `http://127.0.0.1:8080`. Do not promote to stable without successful browser runs.
6. From the **published `0.1.0-rc.1` npm version**, run `scripts/r17/certify-published-npm-windows.ps1 -Adapter koa` and again with `-Adapter express`; this builds and checks generated SPA, SSR and SSG with HTTP and Edge E2E.
7. For a new generated project, `service add tickets --schema zod`; reinstall dependencies, test CRUD and reject invalid title. Repeat TypeBox and JSON Schema cases.
8. For external identity and SQL/Mongo profiles, verify the API refuses to start; do not call these modes certified.
9. `scripts/r17/prepare-gh-pages-branch.ps1` inspects docs staging; use `-Push` only when ready. Merge PR and enable GitHub Pages Actions in repository settings. Verify site HTTP and links.
10. Publish **new** `@vevedh/create-feathers-app@0.1.0-rc.2` only after gates pass; never re-publish immutable `0.1.0-rc.1`.
