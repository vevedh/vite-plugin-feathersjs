# UI/UX Pro Max + CodeAndChill: Vite/Feathers examples

## Purpose and boundary

Use this guide when building or improving the **interface** of Vite/Vue/Quasar/Pinia examples. Feathers server services, service manifests, SSR hydration behavior and socket lifecycle are invariants. This reference is independent of Nuxt and Nitro.

External inspiration/catalogue: <https://codeandchill.store/>. Source rights: <https://codeandchill.store/license>. **Do not copy template source, paid CSS/JS, icons, screenshots or purchased assets from demonstrations into this repository.** Refer to publicly visible layouts, information hierarchies and interactions as abstract patterns, then implement original Vue/Quasar code. A paid license is required before integrating an actual purchased template and should be reviewed for redistribution constraints. Design inspiration does NOT mean that the project includes a paid template.

UI UX Pro Max official project: <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill>. This repository references the methodology but **does not vendor or pretend to install the entire external skill**. An authorized developer may install the official CLI separately, review its scripts and use its local design-system search. Do not import its generated React/Tailwind code into Vue or Quasar without adaptation and verification.

The machine-readable reference-only catalogue is `../templates/codeandchill-reference-catalog.json`. The catalogue does not contain template source or assets.

## Inspiration routing (references only)

| Need | Reference | Extract only the pattern |
| --- | --- | --- |
| Developer API service dashboard, request log, API keys | `Orrery` — https://codeandchill.store/templates/orrery | Dense readable developer console; server-sourced badges; clear nav |
| Project and task administration | `Fernly` — https://codeandchill.store/templates/fernly | Workspace header, compact summary, project list and secondary panel |
| Multi-page agency CRM / notes | `Sprig` — https://codeandchill.store/templates/sprig | Data lists, form composition, master/detail task flow |
| Workflow generation CLI preview | `Noria` — https://codeandchill.store/templates/noria | Explicit progression, empty states and non-destructive previews |
| Feedback / state controls | `Opal`, `Swell`, `Scry` components | Subtle nav, hover or search semantics; don't copy animation/source |

## Design-system workflow (UI UX Pro Max adapted)

1. Inventory installed UI stack and version: Vue 3, Quasar 2 CLI SSR or Vitesse/UnoCSS, Pinia and router. Keep the installed styling system. Do NOT add Tailwind/daisyUI/Quasar to an existing example solely for visual styling.
2. Read existing `--vf-*` tokens in `examples/basic/src/styles/main.css`, and `.console-*` roles in `examples/quasar-ssr/src/css/app.css`. Maintain a **single semantic color system per example**, with surfaces, foreground, muted, border, primary, success, error and focus.
3. Choose one clear information hierarchy: brand, page purpose, primary action, live service status, primary list, details/help. Design page-specific empty/loading/error/disconnected states, never invented KPI numbers.
4. Vue: Composition API + Pinia store; no direct Feathers client in views. Quasar: use existing Quasar components (`QInput`, `QBtn`, `QList`, `QBadge`); do not fake an SSR-capable `@quasar/vite-plugin` route.
5. SSR: deterministic initial markup, no browser globals before mounted, no persistent module-level user state. Prefetch only into per-request Pinia. Socket subscription starts in `onMounted()` and is cleaned in `onUnmounted()`.
6. Design responsive at 320, 390, 768, 1280 px. Verify horizontal overflow, legible density and touch sizes. Include keyboard focus, labels, `aria-live`/`role=alert` on state changes, contrast target WCAG AA and `prefers-reduced-motion` fallbacks.
7. Performance: CSS variables and system font by default; no remote fonts, hero images, GSAP or bulky UI/chart libraries without a demonstrated need. Keep `VITE_HTML_PRELOAD` opt-in for real critical local assets; preload is not a fix for slow Vite startup.
8. Before closing, run design-contract checks, Vue strict TS, four Feathers transports, Quasar `node --test`/SSR build, and Edge/Playwright desktop + mobile screenshots where available. Do not claim visual/browser certification from static checks alone.

## Current original design for r16 examples

- `basic`: Feathers Workspace; indigo/teal light/dark tokens, service-first pipeline, dynamic notes/service status, responsive cards.
- `quasar-ssr`: Feathers Console; dark side navigation, light SSR workspace, dynamic real-data summary, SSR-safe Pinia and realtime only after mount.
- No template source or paid asset is shipped. User interactions in demo forms remain backed by Feathers services and Pinia.
