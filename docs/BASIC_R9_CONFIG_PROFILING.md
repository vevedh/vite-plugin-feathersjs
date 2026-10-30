# Basic r9 — Vite configuration diagnostics

## Baseline
Basic r8-r4: Windows E2E four configurations PASS; R8 traces showed most time consumed before `vite.config.resolved`. No application or transport change in r9.

## Changes
- Opt-in `FEATHERS_R9_VITE_DEBUG=1` captures bounded **duration-only** Vite config DEBUG events, avoiding disclosure of paths and environment variables in JSON reports.
- Adds offline stage analysis of `basic-r8-alternated-profile.json` to `basic-r9-stage-analysis.json` with per-run totals and per-mode medians.
- `PROFILE_R9.ps1 -Runs 2` performs alternated Full/Transport benchmark then analyzes. Use `-Runs 3` for comparison with r8. Potentially expensive: 4 modes × 2 profiles × runs.

## Windows acceptance
```powershell
Set-Location C:\devs\vite-plugin-feathersjs\examples\basic
corepack pnpm run test:feathers:r9-contract
corepack pnpm run profile:r9:analyze
# Optional additional diagnostic run, costly:
.\scripts\PROFILE_R9.ps1 -Runs 2
```

## Interpretation
`beforeConfigMs` is **wall-clock time from child spawn until the plugin's vite.config.resolved trace**, not necessarily exclusively time executing vite.config.ts. Node process startup, resolution, Vite dependency initialization and other plugin work may contribute. `viteConfigDebug` is best effort; an empty list is supported, not a test failure.

## Limitations
- No claim of CPU attribution, per-plugin isolation, or achieved <15 s.
- Do not disable Windows Defender or change app capabilities.
- Certification of r9 on Windows is pending.
