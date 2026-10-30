[CmdletBinding()]
param(
  [ValidateSet('Full','Transport')][string]$Profile = 'Full',
  [ValidateRange(1,5)][int]$Runs = 3
)
$ErrorActionPreference = 'Stop'
$oldMode = [Environment]::GetEnvironmentVariable('FEATHERS_TRANSPORT_PROFILE', 'Process')
$oldRuns = [Environment]::GetEnvironmentVariable('FEATHERS_E2E_RUNS', 'Process')
try {
  [Environment]::SetEnvironmentVariable('FEATHERS_TRANSPORT_PROFILE', $(if ($Profile -eq 'Transport') { '1' } else { '0' }), 'Process')
  [Environment]::SetEnvironmentVariable('FEATHERS_E2E_RUNS', [string]$Runs, 'Process')
  & node (Join-Path $PSScriptRoot 'check-basic-e2e.mjs')
  if ($LASTEXITCODE -ne 0) { throw "R7 $Profile E2E failed (exit $LASTEXITCODE)" }
}
finally {
  [Environment]::SetEnvironmentVariable('FEATHERS_TRANSPORT_PROFILE', $oldMode, 'Process')
  [Environment]::SetEnvironmentVariable('FEATHERS_E2E_RUNS', $oldRuns, 'Process')
}
