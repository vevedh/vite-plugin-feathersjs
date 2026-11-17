import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Portable example-level contract. Internal plugin sources belong to the plugin's own tests.
const api = readFileSync(new URL('../api/server.mjs', import.meta.url), 'utf8')
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('Quasar binds its dedicated Socket.IO transport to IPv4 loopback', () => {
  assert.match(api, /host:\s*'127\.0\.0\.1'/)
  assert.match(api, /origins:\s*\[origin\]/)
})

test('Quasar consumes the published scoped plugin without legacy root coupling', () => {
  assert.equal(pkg.dependencies['@vevedh/vite-plugin-feathersjs'], '0.2.7')
  assert.equal(pkg.dependencies['vite-plugin-feathersjs'], undefined)
  assert.match(api, /from '@vevedh\/vite-plugin-feathersjs'/)
  assert.doesNotMatch(api, /from 'vite-plugin-feathersjs'/)
})
