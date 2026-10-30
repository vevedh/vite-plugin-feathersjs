# Basic r14-r2 — Vite 7 async configuration typecheck

## Windows issue
`corepack pnpm run check:basic:blueprints` failed with TypeScript TS2769
at `vite.config.ts:27` during `vue-tsc --noEmit`.
Previous gates passed (migration, Feathers v5 directory conventions,
Pinia, local MCP, generator and HTML-preload safety).

## Narrow correction
- Type the async Vite configuration callback as `Promise<UserConfig>`.
- Verify the returned object against `UserConfig` using the `satisfies` operator.
- Preserve the optional PWA, DevTools, Shiki, HTML preload, warmup and MCP paths.
- Keep dependency versions, backend services and pnpm lockfile unchanged.
- Add a static regression guard. **This guard does not replace `vue-tsc`.**

Vite 7 supports async configuration functions; typing the returned object
explicitly prevents the inference of widened string literals for options
such as `ssgOptions.script` and preserves strict plugin type checking.

## Windows certification (run from examples/basic)

```powershell
corepack pnpm run test:feathers:r14-config-typing
corepack pnpm run typecheck
corepack pnpm run check:basic:blueprints
corepack pnpm run check:basic:release
corepack pnpm run check:basic:r14-html-e2e
```

Qualification: the isolated source/static tests passed while building this
patch, but Windows `vue-tsc`, network E2E and Full/Fast profiling must be
confirmed by the operator before considering r14-r2 certified.
