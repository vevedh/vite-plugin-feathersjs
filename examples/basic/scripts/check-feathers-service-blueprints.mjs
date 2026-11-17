import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'feathers.services.json'), 'utf8'))
assert.equal(manifest.version, 1)
assert.equal(manifest.framework, 'feathers-v5')
const seen = new Set()
for (const entry of manifest.modules) {
  assert.match(entry.name, /^[a-z][a-z0-9-]*$/)
  assert.match(entry.path, /^[a-z][a-z0-9-]*$/)
  assert.ok(!seen.has(entry.path), 'Duplicate service path')
  seen.add(entry.path)
  for (const key of ['server', 'serviceClass', 'serverSchema', 'schema', ...(entry.client ? ['client'] : []), ...(entry.store ? ['store'] : [])]) {
    assert.ok(!entry[key].includes('..') && !entry[key].startsWith('/'), 'Unsafe path')
    assert.ok(existsSync(resolve(root, entry[key])), `Missing ${key}: ${entry[key]}`)
  }
  assert.ok(Array.isArray(entry.methods) && entry.methods.length > 0, 'Missing service methods')
  assert.ok(entry.methods.every(m => ['find', 'get', 'create', 'update', 'patch', 'remove'].includes(m)))
  assert.equal(entry.server, `server/services/${entry.name}/${entry.name}.service.ts`, 'Discovery entry convention')
  assert.equal(entry.serviceClass, `server/services/${entry.name}/${entry.name}.class.ts`, 'Service class convention')
  assert.equal(entry.serverSchema, `server/services/${entry.name}/${entry.name}.schema.ts`, 'Server schema convention')
  const server = readFileSync(resolve(root, entry.server), 'utf8')
  const serviceClass = readFileSync(resolve(root, entry.serviceClass), 'utf8')
  assert.match(serviceClass, /export class /)
  assert.match(server, /\.class'/)
  assert.match(server, /app\.use\(/)
}
assert.equal(manifest.modules.length, 2, 'Reference example must discover exactly two registration modules')
assert.ok(!existsSync(resolve(root, 'server/notes.ts')))
const note = manifest.modules.find(m => m.name === 'notes')
assert.ok(note.store && note.events.length === 3)
assert.match(readFileSync(resolve(root, note.store), 'utf8'), /defineStore\(/)
console.log('PASS: service-first Feathers blueprints and store mappings')
