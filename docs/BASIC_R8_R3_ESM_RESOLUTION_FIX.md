# Basic r8-r3 — ESM package resolution (2026-10-17)

## Incident

`prepare:feathers:local` failed with `ERR_PACKAGE_PATH_NOT_EXPORTED` because its use of `createRequire(...).resolve('vite-plugin-feathersjs')` requests the CommonJS resolution condition, whereas this package only declares `exports['.'].import`.

## Fix

Resolve the local pnpm dependency **directory** at `examples/basic/node_modules/vite-plugin-feathersjs`, without loading the package entrypoint or relaxing its exports. Verify the installed package name/version and the resolved real path under the example's `node_modules`; only then copy compiled `dist` files into the pnpm snapshot. The source build still runs first and verifies `index.js`, `app.js`, and `performance.js` exist.

## Regression

`test:feathers:local-resolution` sets up an import-only package inside a temporary simulated pnpm store and validates filesystem resolution. Added to `check:basic:release` before preparation. Existing four-mode E2E scenarios remain unchanged and must be certified under Windows.

## No changes

No Feathers application or transport behavior, runtime package exports, external dependencies or published version changed.
