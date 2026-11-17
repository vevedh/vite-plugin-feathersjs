import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
const root = new URL('../', import.meta.url)
const content = path => readFile(new URL(path, root), 'utf8')
test('runtime uses exported factory; never Vite dev hooks', async () => {
  const src = await content('api/server.mjs')
  assert.match(src, /createFeathersRuntime/)
  assert.doesNotMatch(src, /ssrLoadModule|configureServer/)
  assert.match(src, /127\.0\.0\.1/)
})
test('Pinia per-request, no Firebase boots', async () => {
  assert.match(await content('src/stores/index.ts'), /createPinia\(\)/)
  assert.match(await content('src/pages/IndexPage.vue'), /onServerPrefetch/)
  assert.match(await content('src/stores/notes.ts'), /typeof window === 'undefined'/)
  assert.doesNotMatch(await content('quasar.config.ts'), /firebase/)
})
test('Quasar SSR files available', async () => {
  await access(new URL('src-ssr/server.ts', root))
  await access(new URL('src-ssr/middlewares/render.ts', root))
  assert.match(await content('src-ssr/middlewares/render.ts'), /app.get/)
})
