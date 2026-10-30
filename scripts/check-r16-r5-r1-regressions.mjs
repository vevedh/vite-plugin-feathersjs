import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (name) => readFileSync(resolve(root, name), 'utf8')
const runtime = read('src/app.ts')
const optionsTest = read('tests/options.test.ts')
const transportsTest = read('tests/transport.integration.test.ts')

// The async HTTP listen callback must use the previously narrowed value,
// not access FeathersPluginOptions.socketio (which also allows false).
assert.match(runtime, /const socketOptions = options\.socketio/)
assert.match(runtime, /server\.listen\(socketOptions\.port, socketOptions\.host,/)
assert.doesNotMatch(runtime, /options\.socketio!\./)
assert.match(optionsTest, /const socketOptions: SocketTransportOptions =/)
assert.doesNotMatch(optionsTest, /\.\.\.base\.socketio!/)
// A present `host` property must not be typed as `undefined` when
// exactOptionalPropertyTypes is enabled (SocketTransportOptions.host is optional).
assert.match(optionsTest, /host: host as unknown as NonNullable<SocketTransportOptions\['host'\]>/)
assert.doesNotMatch(optionsTest, /host: host as unknown as SocketTransportOptions\['host'\]/)

for (const name of ['notes', 'health']) {
  const stem = `examples/basic/server/services/${name}/${name}.service`
  const modulePath = `../${stem}.ts`
  assert.ok(existsSync(resolve(root, `${stem}.ts`)), `Missing canonical ${stem}.ts`)
  assert.ok(transportsTest.includes(`vi.importActual<ModuleNamespace>('${modulePath}')`), `Missing canonical Vitest import: ${modulePath}`)
  assert.ok(!transportsTest.includes(`server/${name}.js`), `Obsolete flat import: ${name}`)
}
console.log('PASS: strict Socket.IO narrowing, non-null explicit host, concrete option tests and R14 Feathers service entrypoints')
