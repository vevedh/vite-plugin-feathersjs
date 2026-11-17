[CmdletBinding()]
param([ValidateRange(1, 5)][int]$Runs = 2)
$ErrorActionPreference = 'Stop'
$keys = @('FEATHERS_R10_CONFIG_LOADER', 'FEATHERS_R8_TRACE', 'FEATHERS_R9_VITE_DEBUG', 'FEATHERS_E2E_REPORT_PATH', 'FEATHERS_E2E_PROFILE_LABEL', 'FEATHERS_E2E_RUNS')
$previous = @{}
foreach ($key in $keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
try {
  & node (Join-Path $PSScriptRoot 'prepare-local-plugin.mjs')
  if ($LASTEXITCODE -ne 0) { throw "Local build failed (${LASTEXITCODE})" }
  $root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\docs-private')).Path
  $sequence = @('bundle', 'runner', 'runner', 'bundle')
  foreach ($loader in $sequence) {
    [Environment]::SetEnvironmentVariable('FEATHERS_R10_CONFIG_LOADER', $loader, 'Process')
    [Environment]::SetEnvironmentVariable('FEATHERS_R8_TRACE', '1', 'Process')
    [Environment]::SetEnvironmentVariable('FEATHERS_R9_VITE_DEBUG', '1', 'Process')
    [Environment]::SetEnvironmentVariable('FEATHERS_E2E_RUNS', [string]$Runs, 'Process')
    [Environment]::SetEnvironmentVariable('FEATHERS_E2E_PROFILE_LABEL', "r10-$loader", 'Process')
    $report = Join-Path $root ("basic-r10-$loader-" + [guid]::NewGuid().ToString('N') + '.json')
    [Environment]::SetEnvironmentVariable('FEATHERS_E2E_REPORT_PATH', $report, 'Process')
    & node (Join-Path $PSScriptRoot 'check-basic-e2e.mjs')
    if ($LASTEXITCODE -ne 0) { throw "R10 $loader E2E failed (${LASTEXITCODE})" }
    Write-Host "R10 report ($loader): $report"
  }
}
finally {
  foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
