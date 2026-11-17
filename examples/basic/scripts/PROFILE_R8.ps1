[CmdletBinding()]
param([ValidateRange(1,5)][int]$Runs = 3)
$ErrorActionPreference = 'Stop'
$previous = [Environment]::GetEnvironmentVariable('FEATHERS_R8_RUNS', 'Process')
try {
  [Environment]::SetEnvironmentVariable('FEATHERS_R8_RUNS', [string]$Runs, 'Process')
  & node (Join-Path $PSScriptRoot 'prepare-local-plugin.mjs')
  if ($LASTEXITCODE -ne 0) { throw "Local plugin preparation failed (exit ${LASTEXITCODE})" }
  & node (Join-Path $PSScriptRoot 'check-r8-benchmark.mjs')
  if ($LASTEXITCODE -ne 0) { throw "R8 benchmark failed (exit ${LASTEXITCODE})" }
}
finally {
  [Environment]::SetEnvironmentVariable('FEATHERS_R8_RUNS', $previous, 'Process')
}
