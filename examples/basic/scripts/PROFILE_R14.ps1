[CmdletBinding()]
param([ValidateRange(1,3)][int]$Runs = 1)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$basic = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$reports = (Resolve-Path (Join-Path $basic '..\..')).Path
$reports = Join-Path $reports 'docs-private'
New-Item -ItemType Directory -Force -Path $reports | Out-Null
$keys = @('FEATHERS_FAST_DEV', 'FEATHERS_TRANSPORT_PROFILE', 'FEATHERS_E2E_REPORT_PATH', 'FEATHERS_E2E_RUNS', 'FEATHERS_R10_CONFIG_LOADER', 'VITE_HTML_PRELOAD', 'VITE_HTML_PRELOAD_ASSETS')
$previous = @{}
foreach ($key in $keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
try {
    Set-Location $basic
    $env:FEATHERS_TRANSPORT_PROFILE = '0'
    $env:FEATHERS_E2E_RUNS = '1'
    $env:FEATHERS_R10_CONFIG_LOADER = 'bundle'
    $env:VITE_HTML_PRELOAD = 'off'
    $env:VITE_HTML_PRELOAD_ASSETS = ''
    for ($run = 1; $run -le $Runs; $run++) {
        $order = @('full', 'fast')
        if ($run % 2 -eq 0) { $order = @('fast', 'full') }
        foreach ($profile in $order) {
            $env:FEATHERS_FAST_DEV = if ($profile -eq 'fast') { '1' } else { '0' }
            $env:FEATHERS_E2E_REPORT_PATH = Join-Path $reports "basic-r14-$profile-run$run.json"
            Write-Host "R14 $profile run $run : four Feathers E2E modes"
            & node (Join-Path $PSScriptRoot 'check-basic-e2e.mjs')
            if ($LASTEXITCODE -ne 0) { throw "R14 $profile run $run failed" }
        }
    }
    & node (Join-Path $PSScriptRoot 'analyze-r14.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'R14 analysis failed' }
}
finally {
    foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
