# Windows Node/PowerShell certification

Prerequisites: Node version matching Vitesse engines, pnpm **10.30.2** via Corepack. Do not `pnpm self-update`, bypass strict version enforcement, or regenerate the dependency graph without reviewing lockfile changes.

From `C:\devs\vite-plugin-feathersjs\examples\basic`:

```powershell
corepack pnpm --version  # expected 10.30.2
corepack pnpm run test:feathers:agent-setup
corepack pnpm run test:feathers:local-mcp
corepack pnpm run check:basic:blueprints
corepack pnpm run check:basic:release
node scripts/generate-feathers-service.mjs articles --store pinia --realtime --dry-run
```

Composite checks deliberately call `npm run` internally, never a global nested `pnpm run`, so npm executes existing scripts from the Vitesse `node_modules` without running a mismatched pnpm 12 child. Installation remains Corepack pnpm 10.30.2. No `onFail=ignore`.

If dependencies are absent, run `corepack pnpm install` after checking changes. Optional Vite MCP integration adds `vite-plugin-mcp@0.3.2` and requires an install; do not run MCP in normal E2E or a production deployment.

Certification gate order: local setup -> service generator (TypeScript shim in test only) -> Vue `vue-tsc --noEmit` against real dependencies -> all four network modes -> optionally browser Edge/Chromium -> release artifacts. Capture command, Node/pnpm versions, exit code and JSON evidence; don't infer browser outcomes from static tests.

## Quasar SSR browser certification (R16-r6-r3)

Use **Microsoft Edge** (`channel: 'msedge'`) by default on Windows 11, single Playwright worker, with launch arguments `--disable-gpu` and `--disable-features=CalculateNativeWinOcclusion`. Chromium fallback must be selected explicitly and does not override the Edge baseline. Never use `--no-sandbox` as a general remedy.

With Quasar 2 `QInput`, unknown native attributes can be forwarded directly to the underlying `<input>`. Do not write fragile descendant selectors such as `[data-testid="note-title-input"] input`. Prefer Playwright `getByRole('textbox', { name: 'Titre de la nouvelle note', exact: true })` or a correctly associated `getByLabel`; check visibility and value before submitting. Do not fix selectors by disabling accessibility checks.

Run `corepack pnpm run check:browser:preflight`, `corepack pnpm run check:browser:contracts`, then `CERTIFY_R16_WINDOWS.ps1` with `-Browser` for each adapter. Enable `-Socket` to exercise realtime in Edge and build production SSR with `VITE_FEATHERS_REALTIME=1` before production realtime browser runs. Record JSON results and screenshots under ignored `docs-private/r16`. Passing Node-only contracts does not equal a Playwright browser pass.

Keep video optional (`-Video` requires the installed Playwright FFmpeg revision); traces and screenshots remain available when video is off.

### Hydration-sensitive Quasar form controls

On Quasar 2 SSR, investigate any `Hydration style mismatch` from `QInput` or other controls instead of filtering browser console warnings or setting a broad `data-allow-mismatch` escape hatch. For a form field with demonstrably divergent native inline styles during initial server render, isolate **only that interactive field** with `QNoSsr` and a stable placeholder. Do not wrap SSR-prefetched service content or the full page; keep the Pinia server data and surrounding form rendered on the server. Check both the static HTML and the post-hydration accessible input using Edge with GPU disabled at desktop and mobile sizes. This is a targeted compatibility workaround, not a blanket requirement for Quasar `QInput`.
