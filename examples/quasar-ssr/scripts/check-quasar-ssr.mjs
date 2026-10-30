import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const conf = await readFile(new URL('../quasar.config.ts', import.meta.url), 'utf8')
assert.match(conf, /middlewares: \['render'\]/)
assert.match(conf, /prodPort: 9100/)
const server = await readFile(new URL('../src-ssr/server.ts', import.meta.url), 'utf8')
assert.match(server, /ssrCreate/)
assert.match(server, /ssrListen/)
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
assert.match(pkg.devDependencies['@quasar/app-vite'], /^\^2\./)
assert.match(pkg.dependencies['vite-plugin-feathersjs'], /^file:/)
console.log('PASS: Quasar CLI v2 SSR structure, independent Feathers runtime and render order')
