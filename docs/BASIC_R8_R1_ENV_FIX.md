# Basic r8-r1 — Env parsing regression

On Windows the E2E check exited before Vite boot when an inherited `FEATHERS_E2E_RUNS` was an empty string. `Number('')` becomes `0`, violating the 1..5 contract.

The new shared bounded parser interprets absent, empty and whitespace-only environment variables as defaults (E2E=1, benchmark=3), rejects non-decimal/unsafe/out-of-range values and preserves explicit overrides.

Scope: `examples/basic/scripts` only. No Feathers runtime, transports, dependencies, or normal Vitesse configuration are modified.

Validation: `node scripts/test-e2e-env.mjs`, static contracts, typecheck, real four-mode E2E and alternating R8 benchmark on Windows.

The original Windows failure happened **before** any E2E network test; full 4-mode certification still requires rerunning.
