# R16 visual update — Vitesse and Quasar SSR (candidate)

Scope: visual layer + project skill. The Feathers runtime, Koa/Express adapters, Socket.IO, service generator and proxy were **not modified**. R15-r1 Windows release remains prior certified baseline; r16 SSR must be certified.

## Public references assessed (28 Oct 2026)

- https://codeandchill.store/templates/orrery : developer console hierarchy / operations UI.
- https://codeandchill.store/templates/fernly : project dashboard navigation + data summary.
- https://codeandchill.store/templates/sprig : multi-page CRM with notes and data tables.
- https://github.com/nextlevelbuilder/ui-ux-pro-max-skill : design-system methodology, semantic tokens and accessibility review.

These are **pattern references only**. No purchased template code, images, SVGs, font files or commercial assets have been copied. The optional upstream skill is not bundled. Layout and CSS here are original.

## Modified experience

- `examples/basic`: shared `ExampleShell` instead of duplicate layouts; branded dashboard; service-first visual explanation; real REST and Socket.IO status; CRUD interface with error/empty/event states; light/dark semantic tokens.
- `examples/quasar-ssr`: dashboard with dark navigation and measured/actual store data; SSR proof string retained; health fetch after mounting; notes SSR prefetch preserved; real Pinia/Feathers create; dashboard/empty/error/404 states.
- Accessibility: labels, keyboard focus, responsive breakpoints, reduced-motion support, no external fonts or JS dependencies.

## Contract controls

- Basic static UI contract: `corepack pnpm run test:feathers:r16-design`.
- Quasar static/UI: `corepack pnpm run check:contracts` (includes `tests/design.test.mjs`).
- Basic real TS and E2E: `corepack pnpm run check:basic:release`.
- Quasar real SSR build / HTTP and 2-browser Pinia: see `examples/quasar-ssr/README.md` and `CERTIFY_R16_WINDOWS.ps1`.

## Pending (not certified here)

- `vue-tsc` against user's pinned Vitesse node_modules.
- `quasar build -m ssr` with Quasar CLI installed.
- HTML 200 SSR content, CSR hydration warnings, desktop/mobile Edge screenshots, 2 sessions and websocket client synchronization.
- Lighthouse/Web Vitals or cold-start timing; CSS-only changes make no startup performance claims.
