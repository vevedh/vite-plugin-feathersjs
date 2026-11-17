import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectTarget, targetConfig } from '../scripts/edge-routing.mjs'
test('exact API and socket routes only', () => {
  assert.equal(selectTarget('/api/notes'), 'api')
  assert.equal(selectTarget('/api'), 'api')
  assert.equal(selectTarget('/apix'), 'ssr')
  assert.equal(selectTarget('/socket.io/?EIO=4'), 'socket')
  assert.equal(selectTarget('/socket.io2'), 'ssr')
  assert.equal(selectTarget('/'), 'ssr')
})
test('no proxy to external hosts or arbitrary ports', () => {
  assert.deepEqual(targetConfig('api', {}), { hostname:'127.0.0.1', port:3030 })
  assert.throws(() => targetConfig('api', { FEATHERS_API_PORT:'0' }))
  assert.throws(() => targetConfig('ssr', { QUASAR_SSR_PORT:'99999' }))
  assert.throws(() => targetConfig('bad', {}))
})
