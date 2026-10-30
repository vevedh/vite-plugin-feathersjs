# Basic r10 — Configuration loader A/B

Baseline: Basic r9, all four modes PASS on Windows. Observed from the user-provided r9 report (16 starts): median API readiness ~38.46 s; median pre-`vite.config.resolved` ~36.05 s; median Vite `config.load` ~10.40 s; median Feathers ~1.39 s. The pre-config time is not entirely attributable to config loading.

## Candidate change

`FEATHERS_R10_CONFIG_LOADER` accepts `bundle` (default) or `runner` (experiment). The E2E test invokes Vite's `--configLoader` explicitly; the regular `dev` script is untouched. Runner compatibility with all Vitesse plugins is **not** assumed; every run must pass the four-mode REST/Socket.IO integration tests.

`examples/basic/scripts/PROFILE_R10.ps1 -Runs 1` runs bundle/runner/runner/bundle, performing 4 cases per batch. That is 16 Vite starts with Runs 1. Runs 2 results in 32 starts and may be time-consuming. Each batch writes its own JSON report in `docs-private/`, with a unique name. Compare medians under a stable system load; no production change before confirming results.

Do not disable Windows security features. Use `node scripts/test-r10-contract.mjs` first. For a fast smoke test: `$env:FEATHERS_R10_CONFIG_LOADER='runner'; corepack pnpm run test:feathers:e2e`; restore the environment variable afterwards.

## Risks

The `runner` loader may change how CJS/ESM plugins are interpreted, and may not work with all Vitesse plugins. If it fails, retain `bundle`. All four modes need to pass before considering a default change.
