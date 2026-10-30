# Quasar SSR certification of the R17 CLI-generated candidate, not the frozen R16 sample.
# Requires locally installed Microsoft Edge and @playwright/test in examples/quasar-ssr.
[CmdletBinding()]
param(
 [ValidateSet('koa','express','both')][string]$Adapter='both',
 [string]$Project='examples/r17/generated/r17-quasar-ssr'
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$projectPath=Join-Path $root $Project
if(-not (Test-Path -LiteralPath (Join-Path $projectPath 'package.json'))){throw "Missing generated SSR project: $projectPath"}
Push-Location $projectPath
try {
 & corepack pnpm install --no-frozen-lockfile
 if($LASTEXITCODE -ne 0){throw 'Quasar SSR install FAILED'}
 & corepack pnpm run typecheck
 if($LASTEXITCODE -ne 0){throw 'Quasar SSR TypeScript FAILED'}
 & corepack pnpm run build
 if($LASTEXITCODE -ne 0){throw 'Quasar SSR build FAILED'}
}finally{Pop-Location}
Push-Location $root
try {
 foreach($mode in $(if($Adapter -eq 'both'){@('koa','express')}else{@($Adapter)})){
  Write-Host "=== Generated Quasar SSR HTTP + Edge: $mode ===" -ForegroundColor Cyan
  & node examples/r17/scripts/certify-quasar-ssr-generated.mjs --adapter $mode --project $Project
  if($LASTEXITCODE -ne 0){throw "Quasar SSR $mode HTTP/Edge FAILED"}
 }
 Write-Host 'PASS: Quasar SSR generated, strict TypeScript, SSR build, HTTP and Edge' -ForegroundColor Green
}finally{Pop-Location}
