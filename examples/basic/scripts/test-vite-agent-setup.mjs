import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalViteMcpPlugin } from './vite-mcp-loader.mjs'

const basic = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(basic, '../..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const basicRead = (path) => readFileSync(resolve(basic, path), 'utf8')
const pkg = JSON.parse(basicRead('package.json'))
const rootPkg = JSON.parse(read('package.json'))
assert.equal(pkg.packageManager, 'pnpm@10.30.2', 'Do not weaken or change pnpm 10.30.2 pin')
assert.equal(pkg.devDependencies['vite-plugin-mcp'], '0.3.2', 'The opt-in MCP dependency should be pinned')
assert.equal(rootPkg.version, '0.2.6', 'Published plugin version must remain unchanged')
assert.equal(pkg.scripts['test:feathers:agent-setup'], 'node scripts/test-vite-agent-setup.mjs')
assert.match(pkg.scripts['dev:mcp'], /start-vite-mcp/)
for (const [key, value] of Object.entries(pkg.scripts)) {
  assert.ok(!value.includes('pnpm run '), `Nested global pnpm invocation is unsafe: ${key}`)
}
assert.match(pkg.scripts['check:basic:release'], /npm run test:feathers:agent-setup/)
assert.match(pkg.scripts['check:basic:blueprints'], /npm run test:feathers:agent-setup/)
assert.deepEqual(await createLocalViteMcpPlugin(false), [], 'Disabled dev MCP must not import package or modify config')
assert.match(basicRead('vite.config.ts'), /createLocalViteMcpPlugin/)
assert.match(basicRead('vite.config.ts'), /host: 'localhost', port: 3333, strictPort: true/)
assert.match(basicRead('scripts/vite-mcp-loader.mjs'), /updateConfig: false/)
assert.match(basicRead('scripts/vite-mcp-loader.mjs'), /host: 'localhost'/)
for (const relative of ['AGENTS.md', 'SKILLS.md', '.agents/skills/vevedh-full-web-stack-vite/SKILL.md', '.agents/agents/feathers-vite-maintainer.md'])
  assert.ok(existsSync(resolve(root, relative)), `Missing local agent document: ${relative}`)
for (const relative of ['.vscode/mcp.json', '.cursor/mcp.json']) {
  for (const base of [basic, root]) {
    const config = JSON.parse(readFileSync(resolve(base, relative), 'utf8'))
    const entries = Object.values(config.servers ?? config.mcpServers ?? {})
    assert.equal(entries.length, 3, `${relative} must configure both MCP servers`)
    assert.ok(entries.some(item => item.command === 'node' && item.args[0].endsWith('scripts/feathers-v5-mcp.mjs')))
    assert.ok(entries.some(item => item.command === 'npx' && item.args.includes('feathersjs-mcp@1.0.16')))
    assert.ok(entries.some(item => item.url === 'http://localhost:3333/__mcp/sse'))
    assert.ok(!JSON.stringify(config).match(/(Bearer |token|secret|password)/i), 'MCP config must not embed credentials')
  }
}
for (const path of [resolve(root, '.gitignore'), resolve(basic, '.gitignore')]) {
  const ignore = readFileSync(path, 'utf8')
  for (const pattern of ['AGENTS.md', '.agents/', '.codex/', '.ai/', '.cursor/', '.vscode/mcp.json', 'docs-private/'])
    assert.ok(ignore.split(/\r?\n/).includes(pattern), `Missing .gitignore pattern ${pattern}`)
}
assert.match(read('AGENTS.md'), /FeathersJS \*\*v5 Dove\*\*/)
assert.match(read('AGENTS.md'), /FeathersMCP.*v6/)
assert.match(read('.agents/skills/vevedh-full-web-stack-vite/SKILL.md'), /No Nuxt|never Nuxt/)
assert.match(basicRead('scripts/start-vite-mcp.mjs'), /--strictPort/)
assert.match(basicRead('scripts/start-vite-mcp.mjs'), /--host', 'localhost'/)
console.log('PASS: Vite/Feathers v5 agent, local Feathers v5 MCP plus v6 reference and Antfu Vite MCP, localhost opt-in, pnpm 10.30.2 composite scripts, Git exclusions')
