import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const config = read('../vite.config.ts')
const manifest = JSON.parse(read('../package.json'))
assert.match(config, /feathers\(\{/)
assert.match(config, /serviceFiles: 'server\/services\/\*\/\*\.service\.ts'/)
// The Socket.IO port is configurable for isolated E2E runs.
assert.match(config, /const socketPort = Number\(process\.env\.FEATHERS_SOCKET_PORT \?\? '3031'\)/)
assert.match(config, /port: socketPort/)
assert.match(config, /socketio: socketEnabled \? \{/)
assert.match(config, /FEATHERS_TEST_ORIGIN/)

assert.equal(manifest.devDependencies['vite-plugin-feathersjs'], 'file:../..')
assert.ok(existsSync(new URL('../server/services/health/health.service.ts', import.meta.url)))
assert.ok(existsSync(new URL('../src/pages/feathers.vue', import.meta.url)))
console.log('PASS: Vitesse Feathers integration source contract')
