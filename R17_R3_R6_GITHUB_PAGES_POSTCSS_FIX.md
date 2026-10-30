# R17-r3-r6 — GitHub Pages PostCSS isolation

## Source failure

GitHub Actions workflow on merged documentation commit `14b967ee` (2026-10-30) fails during `npm run build` with `Cannot find module postcss-nesting`. The original repository `package.json` contains a PostCSS plugin configuration, while docs dependencies are installed only in `docs/cli`. Vite searches parent directories for PostCSS configuration.

## Correction

Add `docs/cli/postcss.config.cjs` with an empty plugin list. This takes precedence over the root-level PostCSS section and keeps the original package untouched. No dependency installation or settings to the historical plugin required.

Update documentation-only Git publishing to copy this file, publish from a new branch, and verify the invariant in unit tests.

## Validation

Execute from Windows:

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
node scripts/check-r16-freeze.mjs
node --test tests/r17-r3-r6-postcss-isolation.test.mjs tests/r17-r3-r3-pages.test.mjs
node scripts/check-r17-docs.mjs
.\scripts\r17\certify-and-stage-pages-windows.ps1
# Only after all checks PASS:
.\scripts\r17\certify-and-stage-pages-windows.ps1 -Push
```

The script uses an isolated clone and the branch `docs/vitepress-postcss-isolation-r17-r3-r6`, leaving the original Git index untouched. Create and merge a docs-only PR, then confirm GitHub Actions `build` + `deploy` PASS and HTTP 200 on the public URL.

## Not changed

The R16 frozen files, CLI candidate `0.1.0-rc.2`, and GitHub root `package.json` are unchanged. The previous Quasar SSR HTTP + Playwright Edge Koa/Express certification remains valid.
