#Requires -Version 5.1
[CmdletBinding()]
param([string] $ProjectRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $ProjectRoot
if (-not (Test-Path -LiteralPath 'package.json')) { throw 'package.json missing in ProjectRoot' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path -Path $ProjectRoot -ChildPath ('.security-backup-' + $stamp)
New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
foreach ($name in @('package.json', 'package-lock.json')) {
  if (Test-Path -LiteralPath $name) { Copy-Item -LiteralPath $name -Destination $backupDir -Force }
}
Write-Host ('Backups: ' + $backupDir)
& npm audit fix
if ($LASTEXITCODE -ne 0) { throw ('npm audit fix failed (exit ' + $LASTEXITCODE + '); inspect lockfile and backups') }
& npm run audit:runtime
if ($LASTEXITCODE -ne 0) { throw 'Runtime audit failed' }
& npm run audit:all
if ($LASTEXITCODE -ne 0) { throw 'Global audit failed; do not publish' }
& npm run check:release
if ($LASTEXITCODE -ne 0) { throw 'Release certification failed' }
Write-Host 'PASS: audits and release certification passed' -ForegroundColor Green
