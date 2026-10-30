param(
  [ValidateSet('quasar-spa','quasar-ssr','quasar-ssg','daisyui-spa','daisyui-ssr','daisyui-ssg')]
  [string]$Case='quasar-spa',
  [ValidateSet('koa','express')][string]$Adapter='koa',
  [string]$Project='',
  [switch]$Socket,
  [switch]$Production,
  [switch]$Preflight
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $root
try {
  node scripts/check-r16-freeze.mjs
  if ($LASTEXITCODE -ne 0) { throw 'R16 freeze FAILED' }
  node --test tests/r17-generator.test.mjs tests/r17-runner.test.mjs
  if ($LASTEXITCODE -ne 0) { throw 'R17 contracts FAILED' }
  if ($Case -eq 'quasar-ssg') { throw 'BLOCKED: Quasar CLI v2 SSG is not certified. See examples/r17/quasar-ssg/README.md' }
  if ($Case -eq 'quasar-ssr') {
    Write-Host 'Quasar SSR is certified with its dedicated R16 Windows runner.'
    Write-Host 'Run examples\quasar-ssr\scripts\CERTIFY_R16_WINDOWS.ps1 -Stage Production -Adapter koa -Socket -Browser'
    return
  }
  $argsList = @('examples/r17/scripts/certify-r17.mjs', '--case', $Case, '--adapter', $Adapter)
  if ($Project) { $argsList += @('--project', $Project) }
  if ($Socket) { $argsList += '--socket' }
  if ($Production) { $argsList += '--production' }
  if ($Preflight) { $argsList += '--preflight' }
  & node @argsList
  if ($LASTEXITCODE -ne 0) { throw 'R17 browser certification FAILED; read examples/r17/docs-private/certifications logs' }
} finally { Pop-Location }
