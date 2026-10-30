[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist/ssr'
if (!(Test-Path (Join-Path $dist 'package.json') -PathType Leaf)) {
  throw 'Build absent: execute corepack pnpm run build:ssr first'
}
# Quasar produces its own deployment manifest: install there, not in examples/quasar-ssr.
Push-Location $dist
try {
  corepack pnpm install --prod --ignore-scripts --no-frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'Installing compiled SSR runtime dependencies failed' }
} finally { Pop-Location }
Set-Location $root
node scripts/production-deps.mjs
if ($LASTEXITCODE -ne 0) { throw 'SSR runtime dependencies verification FAILED' }
Write-Host 'PASS: compiled SSR production dependencies prepared'
