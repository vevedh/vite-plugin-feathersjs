param([switch]$FrozenLockfile)
$ErrorActionPreference = 'Stop'
$previous = [Environment]::GetEnvironmentVariable('CYPRESS_INSTALL_BINARY', 'Process')
try {
  [Environment]::SetEnvironmentVariable('CYPRESS_INSTALL_BINARY', '0', 'Process')
  $arguments = @('pnpm', 'install')
  if ($FrozenLockfile) { $arguments += '--frozen-lockfile' }
  & corepack @arguments
  if ($LASTEXITCODE -ne 0) { throw "pnpm install failed with code $LASTEXITCODE" }
}
finally {
  [Environment]::SetEnvironmentVariable('CYPRESS_INSTALL_BINARY', $previous, 'Process')
}
