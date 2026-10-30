# R16-r5-r2 — Strict optional Socket.IO host in tests

## Cause

Windows `npm run typecheck` on R16-r5-r1 failed with `TS2322` in `tests/options.test.ts:31`. The type `SocketTransportOptions['host']` includes `undefined` because the interface declares `host?`. With `exactOptionalPropertyTypes: true`, a **present** `host` property cannot be assigned that potentially undefined union. This was a test-only type assertion; no runtime or Socket.IO host handling change was needed.

## Fix

The negative-path test now casts the deliberately invalid runtime value as `NonNullable<SocketTransportOptions['host']>` rather than `SocketTransportOptions['host']`. This preserves type safety at the assignment boundary while still testing that runtime validation rejects invalid hostnames. Required `port` and `origins` remain present and strict optional-property checking remains enabled.

The repository regression check `npm run check:r16-r5-r1`, which runs before `check:release`, now verifies this exact boundary and rejects the previous faulty cast. No npm dependencies, APIs, Vite/Quasar examples, Socket.IO transport behavior, or baseline version were changed.

## Windows verification

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
npm run check:r16-r5-r1
if ($LASTEXITCODE -ne 0) { throw 'Regression FAILED' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck FAILED' }
npm run check:release
if ($LASTEXITCODE -ne 0) { throw 'Release FAILED' }
```

Next gate (only if root release passes):

```powershell
Set-Location C:\devs\vite-plugin-feathersjs\examples\quasar-ssr
corepack pnpm run sync:plugin
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter koa -Socket
.\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Dev -Adapter express -Socket
```

## Validation scope

The zero-dependency regression gate and TypeScript syntax checks can run in the build container. The full project typecheck and E2E network certification need the installed dependencies in Windows. This candidate is not yet Windows-certified.
