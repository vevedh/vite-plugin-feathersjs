[CmdletBinding()]
param(
  [ValidateSet('koa', 'express')]
  [string] $Adapter = 'koa',
  [switch] $RestOnly
)
$ErrorActionPreference = 'Stop'
$previousAdapter = [Environment]::GetEnvironmentVariable('FEATHERS_ADAPTER', 'Process')
$previousSocket = [Environment]::GetEnvironmentVariable('FEATHERS_SOCKETIO', 'Process')
try {
  [Environment]::SetEnvironmentVariable('FEATHERS_ADAPTER', $Adapter, 'Process')
  [Environment]::SetEnvironmentVariable('FEATHERS_SOCKETIO', $(if ($RestOnly) { '0' } else { '1' }), 'Process')
  Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
  Write-Host "Starting Feathers HTTP=$Adapter Socket.IO=$(-not $RestOnly)"
  & corepack pnpm run dev
  if ($LASTEXITCODE -ne 0) { throw "Vite exited with status $LASTEXITCODE" }
}
finally {
  [Environment]::SetEnvironmentVariable('FEATHERS_ADAPTER', $previousAdapter, 'Process')
  [Environment]::SetEnvironmentVariable('FEATHERS_SOCKETIO', $previousSocket, 'Process')
}
