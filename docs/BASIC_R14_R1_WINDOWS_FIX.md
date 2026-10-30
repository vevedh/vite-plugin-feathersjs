# Basic r14-r1 — Windows overlay and fast PWA fix

## Failure causes

1. `Expand-Archive -Force` replaces matching files but does **not** remove old ones. An r13 overlay may retain `server/notes.ts` and `server/health.ts`. This does not affect `serviceFiles: server/services/*/*.service.ts`, but a strict structural test correctly requires the old files to be absent. `npm run prepare:feathers:migration` now removes **only** exact known r11–r13 hashes. Edited or linked files cause a safe failure and require manual review.
2. `shared/feathers/health.schema.ts` had two identical `healthMethods` declarations. The duplicate has been removed; `check-r14-structure.mjs` enforces exactly one declaration.
3. With `FEATHERS_FAST_DEV=1` or `FEATHERS_TRANSPORT_PROFILE=1`, Vite PWA is absent but `src/modules/pwa.ts` eagerly enters the Vue module graph. A dynamic `import('virtual:pwa-register')` is resolved during transformation even if runtime never executes it. The disabled-PWA configuration now aliases this virtual import to a local typed no-op and defines `__FEATHERS_PWA_ENABLED__=false`.

## Upgrade on Windows

```powershell
Expand-Archive -LiteralPath 'C:\perso\vite-plugin-feathersjs-0.2.6-vitesse-basic-r14-r1-windows-fixes.zip' -DestinationPath 'C:\devs' -Force
Set-Location C:\devs\vite-plugin-feathersjs\examples\basic
corepack pnpm run test:feathers:r14-migration
corepack pnpm run prepare:feathers:migration
corepack pnpm run test:feathers:r14-structure
corepack pnpm run check:basic:blueprints
corepack pnpm run check:basic:release
corepack pnpm run check:basic:r14-html-e2e
```

No lockfile or adapter changes, and no fresh dependency install is required if the r14 environment is intact. When a modified legacy file is reported, back it up outside the service discovery tree before removing it yourself; the migration refuses deletion.

## E2E status

The previous r14 Windows HTML test reported a startup duration of 74.384 s and failed `health` transformation. The transform and disabled PWA import errors are corrected here. The actual four-mode network readiness, HTML preload validation, and Full/Fast performance must still be re-certified on Windows. Keep the existing bounded timeout and do not infer a speed improvement from this functional hotfix.
