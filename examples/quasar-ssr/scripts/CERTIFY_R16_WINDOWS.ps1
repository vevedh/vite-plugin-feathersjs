[CmdletBinding()]
param(
  [ValidateSet('koa', 'express')][string]$Adapter = 'koa',
  [switch]$Socket,
  [switch]$Browser,
  [switch]$Video,
  [ValidateSet('Dev', 'Production')][string]$Stage = 'Dev',
  [ValidateRange(30, 1200)][int]$TimeoutSeconds = 420
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$logs = Join-Path $root 'docs-private/r16'
New-Item -ItemType Directory -Force $logs | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$env:FEATHERS_ADAPTER = $Adapter
$env:FEATHERS_SOCKETIO = if ($Socket) { '1' } else { '0' }
$env:FEATHERS_PUBLIC_ORIGIN = 'http://127.0.0.1:8080'
$env:VITE_FEATHERS_REALTIME = if ($Socket) { '1' } else { '0' }
$processes = @()

function Start-Logged([string]$FilePath, [string[]]$Arguments, [string]$Name) {
  $stdout = Join-Path $logs "$stamp-$Name.stdout.log"
  $stderr = Join-Path $logs "$stamp-$Name.stderr.log"
  $proc = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $root -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $script:processes += [pscustomobject]@{ Name = $Name; Process = $proc; Stderr = $stderr; Stdout = $stdout }
  Write-Host "START $Name PID=$($proc.Id) stdout=$stdout"
}
function Is-Ready([string]$Url) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return ($response.StatusCode -eq 200)
  } catch { return $false }
}
function Check-Children {
  foreach ($item in $script:processes) {
    $item.Process.Refresh()
    if ($item.Process.HasExited) {
      Write-Host "--- $($item.Name) stderr (last 35 lines) ---"
      if (Test-Path $item.Stderr) { Get-Content -Path $item.Stderr -Tail 35 | Out-Host }
      Write-Host "--- $($item.Name) stdout (last 20 lines) ---"
      if (Test-Path $item.Stdout) { Get-Content -Path $item.Stdout -Tail 20 | Out-Host }
      throw "Process $($item.Name) exited before readiness (exit=$($item.Process.ExitCode))."
    }
  }
}
try {
  node scripts/preflight-r16.mjs "--stage=$($Stage.ToLowerInvariant())"
  if ($LASTEXITCODE -ne 0) { throw 'R16 preflight FAILED' }
  if ($Video -and -not $Browser) { throw '-Video requires -Browser' }
  if ($Browser) {
    $env:R16_BROWSER_VIDEO = if ($Video) { '1' } else { '0' }
    node scripts/check-browser-prereqs.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Browser prerequisite check FAILED' }
  }
  # Fail closed if a prior dev server is occupying one of the expected loopback ports.
  $ports = @(8080, 3030, 9100)
  if ($Socket) { $ports += 3031 }
  foreach ($port in $ports) {
    $existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($existing) { throw "Port $port already in use; stop the existing process before certification" }
  }
  $productionEntry = $null
  if ($Stage -eq 'Production') {
    node scripts/production-deps.mjs
    if ($LASTEXITCODE -ne 0) { throw 'SSR compiled dependencies missing: run .\scripts\PREPARE_R16_PRODUCTION.ps1 first' }
    $productionEntry = (node scripts/ssr-entry.mjs | Select-Object -Last 1).Trim()
    if ($LASTEXITCODE -ne 0 -or !(Test-Path $productionEntry)) { throw 'SSR production entry not verified' }
  }
  Start-Logged -FilePath 'node.exe' -Arguments @('api/server.mjs') -Name 'api'
  if ($Stage -eq 'Dev') {
    Start-Logged -FilePath 'cmd.exe' -Arguments @('/d', '/c', 'corepack pnpm run dev:ssr') -Name 'ssr'
  } else {
    Start-Logged -FilePath 'node.exe' -Arguments @('"' + $productionEntry + '"') -Name 'ssr'
  }
  Start-Logged -FilePath 'node.exe' -Arguments @('scripts/edge-proxy.mjs') -Name 'edge'
  $ready = $false
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    Check-Children
    if ((Is-Ready 'http://127.0.0.1:8080/api/health') -and (Is-Ready 'http://127.0.0.1:8080/')) { $ready = $true; break }
    Start-Sleep -Seconds 2
  }
  if (!$ready) { throw "Readiness timeout. Consultez les journaux sous $logs" }
  node scripts/check-runtime.mjs
  if ($LASTEXITCODE -ne 0) { throw 'HTTP/SSR/CRUD FAILED' }
  if ($Socket) {
    node scripts/check-realtime.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Two-client Socket.IO FAILED' }
  }
  if ($Browser) {
    $env:R16_BROWSER_SOCKET = if ($Socket) { '1' } else { '0' }
    $env:R16_BROWSER_STAGE = $Stage.ToLowerInvariant()
    $env:R16_BROWSER_ADAPTER = $Adapter
    $env:R16_BROWSER_BASE_URL = 'http://127.0.0.1:8080'
    Write-Host "BROWSER: $Stage $Adapter Socket=$Socket; channel=$($env:R16_BROWSER_CHANNEL)"
    corepack pnpm run check:browser
    if ($LASTEXITCODE -ne 0) { throw 'Playwright Edge hydration/CRUD/realtime FAILED; see docs-private/r16/browser-results.json' }
  }
  Write-Host "PASS: R16 $Stage $Adapter Socket=$Socket Browser=$Browser"
} finally {
  foreach ($item in $processes) {
    try { & taskkill.exe /PID $item.Process.Id /T /F 2>$null | Out-Null } catch {}
  }
}
