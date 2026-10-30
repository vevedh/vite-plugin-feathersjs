import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
test('Quasar MCP is optional, local editor-only and version-scoped', async () => {
  for (const [path, key] of [['../.vscode/mcp.json', 'servers'], ['../.cursor/mcp.json', 'mcpServers']]) {
    const config = JSON.parse(await read(path))
    const entry = config[key]?.['quasar-local-docs']
    assert.ok(entry, `${path} missing Quasar server`)
    assert.equal(entry.command, 'npx')
    assert.deepEqual(entry.args, ['-y', '--fetch-retries=0', '@quasar/mcp@1.0.0', '--project', '${workspaceFolder}'])
    assert.doesNotMatch(JSON.stringify(config), /token|secret|password|apikey|Bearer/i)
  }
  const ignore = await read('../.gitignore')
  assert.match(ignore, /^\.vscode\/mcp\.json$/m)
  assert.match(ignore, /^\.cursor\/$/m)
})
test('Quasar MCP is not a runtime dependency or SSR import', async () => {
  const pkg = JSON.parse(await read('../package.json'))
  assert.ok(!pkg.dependencies?.['@quasar/mcp'] && !pkg.devDependencies?.['@quasar/mcp'])
  assert.doesNotMatch(await read('../src-ssr/server.ts'), /@quasar\/mcp/)
})
