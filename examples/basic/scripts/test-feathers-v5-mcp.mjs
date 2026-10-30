import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleRequest } from './feathers-v5-mcp.mjs'

const basic = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = resolve(basic, 'feathers.services.json')
const original = readFileSync(manifest)
function request(method, params = {}) { return handleRequest({ jsonrpc: '2.0', id: 1, method, params }) }
assert.equal(request('initialize', { protocolVersion: '2024-11-05' }).result.serverInfo.name, 'vite-feathers-v5-blueprints')
assert.equal(request('tools/list').result.tools.length, 3)
const list = JSON.parse(request('tools/call', { name: 'list_feathers_v5_services', arguments: {} }).result.content[0].text)
assert.equal(list.framework, 'feathers-v5')
assert.ok(list.modules.some(entry => entry.name === 'notes'))
const note = JSON.parse(request('tools/call', { name: 'inspect_feathers_v5_service', arguments: { name: 'notes' } }).result.content[0].text)
assert.equal(note.module.name, 'notes')
const preview = JSON.parse(request('tools/call', { name: 'preview_feathers_v5_service', arguments: { name: 'articles', store: 'pinia', realtime: true } }).result.content[0].text)
assert.equal(preview.mode, 'dry-run')
assert.equal(preview.preview.dryRun, true)
for (const invalid of [
  { name: '../../outside' }, { name: 'notes' }, { name: 'abc', store: 'sqlite' }, { name: 'abc', realtime: 'yes' }, { name: 'abc', unknown: true },
]) {
  const response = request('tools/call', { name: 'preview_feathers_v5_service', arguments: invalid }).result
  assert.equal(response.isError, true, `Expected tool error for ${JSON.stringify(invalid)}`)
}
assert.deepEqual(readFileSync(manifest), original, 'Read-only MCP must not edit manifest')
const child = spawn(process.execPath, [resolve(basic, 'scripts/feathers-v5-mcp.mjs')], { stdio: ['pipe', 'pipe', 'pipe'] })
const result = await new Promise((done, fail) => {
  let output = ''
  const timeout = setTimeout(() => { child.kill(); fail(new Error('MCP stdio timeout')) }, 6000)
  child.stdout.on('data', chunk => {
    output += chunk.toString()
    if (output.includes('\n')) { clearTimeout(timeout); child.kill(); done(JSON.parse(output.split('\n')[0])) }
  })
  child.once('error', cause => { clearTimeout(timeout); fail(cause) })
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' })}\n`)
})
assert.equal(result.id, 3)
assert.equal(result.result.tools.length, 3)
console.log('PASS: FeathersJS v5 local MCP stdio tools, strict inputs, read-only generator preview')
