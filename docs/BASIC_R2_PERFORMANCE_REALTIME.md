# Basic r2 — Performance and real-time audit (2026-10-17)

Baseline: vite-plugin-feathersjs 0.2.6, previously certified Windows 23/23 tests, 0 npm advisories. Vitesse basic successful browser screenshot, Node 22.23.2 and Vite 7.3.7.

Observed initial install: 7m47.2s including a 4m52.4s Cypress postinstall. Initial dev-ready: 75.175s; web fonts fetched during startup. These are measurements of the **previous** candidate, not of r2.

r2 scope: (1) optional Cypress binary-free installation, (2) remove remote webfont downloads, (3) in-memory notes CRUD, stricter title/id validation, (4) Socket.IO method calls, event display and demo channel broadcasts, (5) source-contract check and documentation. No change to main plugin package runtime.

Security limits: demo broadcast is intentionally public, no data persistence, no authentication. Do not deploy as-is. Never enable general public event broadcasts for private services.

Remaining validation: pnpm install (fast), source contract, vue-tsc, Vite startup, browser call create/patch/remove, two-tab broadcast, build, production and development npm audit. Peer warnings unchanged until verified separately. Keep a checked lockfile after installation.
