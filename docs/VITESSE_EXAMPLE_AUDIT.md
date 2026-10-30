# Vitesse sample audit — 0.2.6 example integration

## Source reviewed
- `vitesse-main.zip` (100 archive entries), file-based router, Vue 3, Pinia, UnoCSS, i18n, Markdown, PWA, Vue macros, Vite SSG, Cypress and Vitest.
- No original Vitesse page or plugin removed. Added `/feathers`, `/server` demo and one link in `about.md`.
- Feathers plugin is imported into `vite.config.ts`, targeting `/api` and dedicated socket port 3031.

## Critical compatibility finding
- Vitesse source catalog declares Vite `^8.3.3` while Feathers plugin 0.2.6 peer declares Vite up to `^7.0.0` only.
- Candidate changes example catalog to `^7.3.6`; no verification that the newest Vitesse plugins support downgrade. A proper Vite 8 support release of the plugin is the alternative, after E2E certification.
- Vitesse requires Node >=22.22.2 within 22.x; developer's previously used 22.20.0 is insufficient.
- Vitesse `pnpm-lock.yaml` removed after changing catalog; regenerate with supported Node/pnpm.
- Runtime Feathers is dev-only, not bundled into Vite SSG production output.

## Certification
- Static source contract: implemented, runnable without dependencies.
- pnpm install, Vue typecheck, browser smoke, REST/Socket.IO: pending Windows.
- Original Feathers 0.2.6 Windows 23/23 and audit 0 are user-certified; example itself is not.
