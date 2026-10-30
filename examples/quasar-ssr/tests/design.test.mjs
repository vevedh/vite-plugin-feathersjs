import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
test('Quasar SSR console uses live Pinia data without browser-only SSR side effects', async () => {
  const page = await read('../src/pages/IndexPage.vue')
  for (const text of ['onServerPrefetch(', 'onMounted(', 'onUnmounted(', 'useNotesStore()', 'data-testid="notes"', 'id="ssr-proof"', 'Quasar 2 SSR + FeathersJS v5 + Pinia', 'checkHealth()', 'role="alert"'])
    assert.ok(page.includes(text), `missing SSR/UI contract: ${text}`)
  assert.match(page, /store\.connectRealtime\(\)/)
  assert.match(page, /store\.disconnectRealtime\(\)/)
  assert.match(page, /store\.notes\.length/)
  assert.match(page, /store\.create\(newTitle\.value\)/)
  assert.doesNotMatch(page, /socket\.emit\(|document\.querySelector|window\.localStorage/)
  assert.doesNotMatch(page, /style\s*=\s*"[^"]*background-image:.*https?:/)
})
test('UI is responsive and design assets do not add runtime dependencies', async () => {
  const style = await read('../src/css/app.css')
  assert.match(style, /prefers-reduced-motion/)
  assert.match(style, /@media\(max-width:700px\)/)
  assert.match(style, /:focus-visible/)
  assert.match(style, /console-shell/)
  assert.doesNotMatch(style, /@import\s+url\(['"]?https?:\/\//)
  const config = await read('../quasar.config.ts')
  assert.match(config, /ssr: /)
  assert.doesNotMatch(config, /firebase/)
})
