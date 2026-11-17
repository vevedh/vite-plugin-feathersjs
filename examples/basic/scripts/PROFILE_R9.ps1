[CmdletBinding()]
param([ValidateRange(1,5)][int]$Runs = 2)
$ErrorActionPreference = 'Stop'
$original = [Environment]::GetEnvironmentVariable('FEATHERS_R9_VITE_DEBUG', 'Process')
try {
  [Environment]::SetEnvironmentVariable('FEATHERS_R9_VITE_DEBUG', '1', 'Process')
  & (Join-Path $PSScriptRoot 'PROFILE_R8.ps1') -Runs $Runs
  if ($LASTEXITCODE -ne 0) { throw "Profiling failed ($LASTEXITCODE)" }
  & node (Join-Path $PSScriptRoot 'analyze-r9.mjs')
  if ($LASTEXITCODE -ne 0) { throw "Analysis failed ($LASTEXITCODE)" }
}
finally { [Environment]::SetEnvironmentVariable('FEATHERS_R9_VITE_DEBUG', $original, 'Process') }
