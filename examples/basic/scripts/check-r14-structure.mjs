import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { filesFor } from './service-generator/templates.mjs'
import { htmlPreloadPlugin } from './html-preload.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(resolve(root, path), 'utf8')
const manifest = JSON.parse(read('feathers.services.json'))
const config = read('vite.config.ts')
assert.deepEqual(manifest.modules.map(entry => entry.name).sort(), ['health', 'notes'])
assert.match(config, /serviceFiles: 'server\/services\/\*\/\*\.service\.ts'/)
assert.match(config, /watchDirectories: \['server\/services', 'shared\/feathers'\]/)
assert.match(config, /loadEnv\(mode, import\.meta\.dirname/)
assert.match(config, /FEATHERS_FAST_DEV/)
assert.match(config, /FEATHERS_DEV_WARMUP/)
assert.match(config, /htmlPreloadPlugin\(env,/)
assert.match(config, /import\('vite-plugin-pwa'\)/)
assert.match(config, /import\('@shikijs\/markdown-exit'\)/)
assert.match(config, /import\('vite-plugin-vue-devtools'\)/)
assert.match(config, /'virtual:pwa-register': path\.resolve/)
assert.match(config, /__FEATHERS_PWA_ENABLED__/)
assert.match(read('src/modules/pwa.ts'), /!__FEATHERS_PWA_ENABLED__/)
assert.match(read('src/lib/pwa-register-disabled.ts'), /export function registerSW/)
const sharedSchema = read('shared/feathers/health.schema.ts')
assert.equal([...sharedSchema.matchAll(/export const healthMethods\s*=/g)].length, 1, 'healthMethods must be declared exactly once')
assert.doesNotMatch(config, /^import (?:Shiki|VueDevTools|\{ VitePWA \}) /m)
for (const service of manifest.modules) {
  const base = `server/services/${service.name}`
  assert.equal(service.server, `${base}/${service.name}.service.ts`)
  assert.equal(service.serviceClass, `${base}/${service.name}.class.ts`)
  assert.equal(service.serverSchema, `${base}/${service.name}.schema.ts`)
  assert.ok(existsSync(resolve(root, service.schema)))
  assert.match(read(service.server), /app\.use\(/)
  assert.match(read(service.serviceClass), /export class /)
  assert.ok(existsSync(resolve(root, service.serverSchema)))
  assert.deepEqual(readdirSync(resolve(root, base)).filter(f => f.endsWith('.service.ts')), [`${service.name}.service.ts`])
  assert.ok(!existsSync(resolve(root, `server/${service.name}.ts`)), `Legacy flat registration remains: server/${service.name}.ts; run npm run prepare:feathers:migration`)
}
const future = filesFor({name: 'articles', path: 'articles', methods: ['find', 'get', 'create', 'patch', 'remove'], id: 'number', store: 'pinia', realtime: true})
assert.equal(future.outputs.size, 6)
assert.ok(future.outputs.has('server/services/articles/articles.service.ts'))
assert.ok(future.outputs.has('server/services/articles/articles.class.ts'))
assert.ok(future.outputs.has('server/services/articles/articles.schema.ts'))
assert.match(future.outputs.get('server/services/articles/articles.service.ts'), /methods: \[\.\.\.articlesMethods\]/)
assert.match(future.outputs.get('server/services/articles/articles.class.ts'), /async create\(/)
assert.equal(htmlPreloadPlugin({}, root).transformIndexHtml.handler().length, 0)
console.log('PASS: Feathers v5 directory registrations/classes/schema, generator parity, HMR dependency watching, opt-in fast Vite and HTML preload')
