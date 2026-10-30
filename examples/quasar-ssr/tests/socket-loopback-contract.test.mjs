import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const api = readFileSync(new URL('../api/server.mjs', import.meta.url), 'utf8')
const runtime = readFileSync(new URL('../../../src/app.ts', import.meta.url), 'utf8')
const options = readFileSync(new URL('../../../src/options.ts', import.meta.url), 'utf8')
const types = readFileSync(new URL('../../../src/types.ts', import.meta.url), 'utf8')
test('Quasar binds its dedicated Socket.IO transport to IPv4 loopback', () => {
  assert.match(api, /host:\s*'127\.0\.0\.1'/)
  assert.match(api, /origins:\s*\[origin\]/)
})
test('runtime sets up Feathers Socket.IO on an explicit-host HTTP server', () => {
  assert.match(runtime, /server\.listen\(socketOptions\.port, socketOptions\.host/)
  assert.match(runtime, /await app\.setup\(server\)/)
  assert.match(runtime, /await app\.teardown\(boundSocketServer\)/)
  assert.match(runtime, /await .*\.listen\(socketOptions\.port\)/)
})
test('public option rejects non-loopback socket hosts', () => {
  assert.match(options, /host !== '127\.0\.0\.1' && host !== '::1'/)
  assert.match(types, /host\?: '127\.0\.0\.1' \| '::1'/)
})
