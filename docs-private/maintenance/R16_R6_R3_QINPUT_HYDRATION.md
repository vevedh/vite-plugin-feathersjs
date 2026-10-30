# R16-r6-r3 — Quasar QInput SSR hydration mismatch

## Windows evidence

On R16-r6-r2, Edge with GPU disabled passed three out of four executed browser scenarios on the Koa dev server. The remaining responsive test reported `Hydration style mismatch` at `QInput`: server `caret-color: transparent !important;`, client empty style, followed by `Hydration completed but contains mismatches.` The realtime browser test was skipped because `-Socket` was not enabled. The complete Express result was not included in that log.

## Corrective scope

The notes store already performs `onServerPrefetch()` per SSR request, and browser CRUD works. Do not alter it. Put only the interactive `QInput` inside a Quasar `QNoSsr` boundary with a server placeholder. Leave `form`, `q-btn`, notes, and status cards in normal SSR. Keep Playwright strict on page errors and hydration warnings; add an assertion that the textbox appears after hydration, including on both responsive widths. Maintain the Edge GPU-disabled baseline.

## Verification commands on Windows

From `examples/quasar-ssr` after applying the cumulative patch:

```powershell
corepack pnpm run check:browser:contracts
corepack pnpm run check:contracts
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter koa -Browser
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter express -Browser
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter koa -Socket -Browser
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter express -Socket -Browser
```

Do not mark the browser or realtime gate certified until these commands succeed. For production browser gate, rebuild with `VITE_FEATHERS_REALTIME=1`, prepare production deps, then test both adapters with `-Stage Production -Socket -Browser`.

References: https://quasar.dev/vue-components/no-ssr/ ; https://quasar.dev/quasar-cli-vite/developing-ssr/client-side-hydration/ .
