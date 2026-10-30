# R17-r3-r2 — ECC optional setup, project-first

Date : 2026-10-29 (Martinique)

## Scope

Integrate https://ecc.tools/skills into the existing local project skill `.agents/skills/vevedh-full-web-stack-vite/` without changing the plugin `0.2.6`, the CLI `@vevedh/create-feathers-app@0.1.0-rc.2` candidate, GitHub Pages public content or npm publication state.

## Changed / added

- `SKILL.md`: ECC adapter reading requirement and architecture precedence.
- `references/ecc-setup.md`: French selective catalog and guided installation instructions.
- `scripts/ecc/ecc-profile.json`: approved list (10 skill identifiers), version pin `ecc-universal@2.2.3`, default `Plan`, opt-in policy.
- `scripts/ecc/setup-ecc.ps1`: no-network `Plan` by default; `Preview` and interactive `Install` explicit.
- `scripts/ecc/verify-ecc-contract.mjs`: offline structural/security test.
- `tests/r17-ecc-setup.test.mjs`: no runtime npm/CLI dependency, source-integrity checks.
- `AGENTS.md`, `SKILLS.md`, `.gitignore`: local guidance and ignore rules for optional agent configs.

ECC is NOT auto-installed in the developer environment. No remote installer, MCP server, hooks, telemetry, GitHub push or npm publish have been run by this patch.

## Evidence in this build environment

- `node scripts/check-r16-freeze.mjs`: PASS, 20/20 frozen files.
- `node scripts/check-r17-docs.mjs`: PASS, 16 pages, source/navigation policy.
- `node scripts/ecc/verify-ecc-contract.mjs`: PASS, ten curated skills, pinned installer.
- `node --test tests/r17-generator.test.mjs tests/r17-runner.test.mjs tests/r17-r3-features.test.mjs tests/r17-cli-package.test.mjs tests/r17-ecc-setup.test.mjs`: 25/25 PASS.
- `node scripts/stage-r17-cli.mjs`: PASS, 95 clean files.
- `npm pack --dry-run --json .release/create-feathers-app`: PASS, 95 files, ~35 KB; no ECC content.

## Windows and release gates still required

- Re-run tests and static checks on Windows 11 / Node 22.
- Run `scripts/ecc/setup-ecc.ps1` with default plan and **review**; real ECC preview/install is user-controlled and needs local verification.
- Re-certify Quasar SSR runtime using Edge browser and API-service tests for both Koa and Express; typecheck and build were confirmed in the user's previous Windows transcript.
- Continue GitHub Pages public deployment from the isolated whitelist checkout when approved.
- `@vevedh/create-feathers-app@0.1.0-rc.2` candidate is NOT published; `0.1.0-rc.1` remains the installed npm release. Do not republish the same version with changed bits.
