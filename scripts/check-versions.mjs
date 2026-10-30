import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const names = [...new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {}), ...Object.keys(manifest.peerDependencies ?? {})])].sort()
console.log(`Checking ${names.length} unique package names against the npm registry...`)
for (const name of names) {
  const result = spawnSync('npm', ['view', name, 'version', '--json', '--fetch-retries=0', '--fetch-timeout=5000'], {
    encoding: 'utf8', timeout: 7000, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    console.log(`${name}: registry unavailable (not verified)`)
    continue
  }
  const latest = JSON.parse(result.stdout.trim())
  const declared = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name] ?? manifest.peerDependencies?.[name]
  console.log(`${name}: declared ${declared} | npm latest ${latest}`)
}
console.log('Latest does NOT mean compatible. Validate candidate versions with npm install + check:release + npm audit.')
