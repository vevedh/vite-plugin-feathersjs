# Windows PowerShell 5.1 / 7 certification

Run commands **individually** (abort on native failure):

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
npm install
if ($LASTEXITCODE -ne 0) { throw 'install failed' }
npm run check:fast
if ($LASTEXITCODE -ne 0) { throw 'fast checks failed' }
npm run check:release
if ($LASTEXITCODE -ne 0) { throw 'release checks failed' }
npm run audit:runtime
npm run audit:all
```

Security audit commands may return nonzero when vulnerabilities are detected. Capture full details with `npm audit --json > audit.json`; do not publish until runtime issues are reviewed. `npm install` need not be repeated for edits that do not alter dependencies.

`check:fast` excludes TCP integration tests to shorten edit/test iterations. `check:release` performs typecheck, unit and integration tests, build and npm pack dry-run. The live Socket.IO tests bind a local port: ensure host firewall permits loopback.

### Fast remediation after 0.2.4-r1 audit

```powershell
Set-Location C:\devs\vite-plugin-feathersjs
.\scripts\SECURITY_FIX.ps1 -ProjectRoot 'C:\devs\vite-plugin-feathersjs'
```

This includes `check:release`, so do not run it a second time. Archive version remains `0.2.4` (r2 is the remediation revision, not a separately published package version).
