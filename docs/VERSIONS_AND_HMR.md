# Dependency and HMR review — 0.2.5-r1

## Validation (Windows PowerShell)

1. Preserve your certified `package-lock.json` from 0.2.4; this source archive does not bundle that locally modified lockfile.
2. `npm install --package-lock-only` followed by `npm ci` when the lockfile is consistent (or `npm install` if upgrading the manifest).
3. `npm run versions:check` (non-mutating; reports current npm dist-tag).
4. `npm run check:release` and then `npm run check:security`.
5. To evaluate test worker reuse: `npm run test:unit:quick`, then run it again and check for state interference. Do not use as the release gate yet.

## Dependency strategy

- Keep Feathers v5 major, do not use v6 pre-releases. Keep same minor/patch across Feathers adapters when upgrading.
- The declared `^5.0.0` Feathers ranges already permit v5 patch updates.
- `tinyglobby ^0.2.17` is current in npm results; no upgrade required.
- `socket.io-client` has an npm 4.8.4 release (in-range under ^4.8.1).
- `vite`, `vitest`, `typescript`: latest major releases may require intentional migrations; use the check script and test before changing bounds.
- `npm audit` after installation is mandatory. Do not use `npm audit fix --force` without reviewing breaks.

## HMR behavior

- Existing tracked service change: rebuild.
- File addition/removal or directory change: inventory scan, then rebuild only if the resolved glob file set changed.
- Unrelated file changes: ignored.
- Socket.IO runtime currently restarts when services reload. Connections may drop. Preserving connections requires a separate socket lifecycle architecture and dedicated end-to-end tests.
- Runtime error during Socket.IO replacement may interrupt the previous server: follow-up hardening required.
