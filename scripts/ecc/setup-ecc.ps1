# Optional ECC installer for the local developer. Default is a NO-NETWORK plan.
# Review https://ecc.tools/skills and https://github.com/affaan-m/ECC first.
[CmdletBinding()]
param(
  [ValidateSet('codex','claude','kimi')]
  [string]$Harness = 'codex',
  [ValidateSet('Plan','Preview','Install')]
  [string]$Mode = 'Plan'
)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$profilePath = Join-Path $PSScriptRoot 'ecc-profile.json'
$profile = Get-Content -LiteralPath $profilePath -Raw | ConvertFrom-Json
if ($profile.package -cne 'ecc-universal' -or $profile.version -notmatch '^2\.2\.3$' -or $profile.strategy -cne 'guided-opt-in') {
  throw 'ECC pinned setup profile unexpectedly changed; security review required'
}
if ($null -eq ($profile.harnesses | Where-Object { $_ -ceq $Harness })) {
  throw "Unsupported ECC harness: $Harness"
}
$package = 'ecc-universal@' + $profile.version
$argv = @($package, 'install', '--guided', '--harness', $Harness)
Write-Host "ECC source: $($profile.upstream)"
Write-Host "ECC optional profile: $($profile.name)"
Write-Host "ECC pinned package: $package ; harness: $Harness ; mode: $Mode"
Write-Host 'The existing Feathers v5 / Vite / R16 project rules take priority.'
Write-Host 'Review existing plugin/skills and hooks; use only one installation method per harness.'
if ($Mode -eq 'Plan') {
  Write-Host "PREVIEW: npx $($argv -join ' ') --dry-run"
  Write-Host "INSTALL (interactive, only if approved): npx $($argv -join ' ')"
  Write-Host 'PLAN ONLY: no external command ran and no files were changed.'
  return
}
# npx may fetch and execute an external package. Never do this in Plan mode.
$npx = Get-Command npx -ErrorAction Stop
if ($Mode -eq 'Preview') {
  $argv += '--dry-run'
  Write-Host 'Preview explicitly requested: npx may download ECC. No ECC setup changes are intended.'
}
else {
  Write-Warning 'Interactive ECC install explicitly requested. Review every path and hook proposal before accepting.'
}
& $npx.Source @argv
if ($LASTEXITCODE -ne 0) { throw "ECC $Mode failed with exit code $LASTEXITCODE" }
Write-Host "PASS: ECC $Mode command completed. Verify actual installed resources manually."
