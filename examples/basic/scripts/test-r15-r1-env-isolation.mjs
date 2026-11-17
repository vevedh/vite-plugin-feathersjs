import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { releaseE2EEnv, htmlE2EEnv } from './e2e-launch-env.mjs'
import { resolveHtmlPreload } from './html-preload.mjs'

const inherited = Object.freeze({
  VITE_HTML_PRELOAD: 'SOME_INVALID_INHERITED_VALUE',
  VITE_HTML_PRELOAD_ASSETS: 'https://example.invalid/evil.js',
  FEATHERS_R10_CONFIG_LOADER: 'runner',
  FEATHERS_FAST_DEV: '1',
  FEATHERS_TRANSPORT_PROFILE: '1',
})
const basic = '/fake/repo/examples/basic'
const release = releaseE2EEnv(inherited, basic)
assert.equal(release.VITE_HTML_PRELOAD, 'off')
assert.equal(release.VITE_HTML_PRELOAD_ASSETS, '')
assert.equal(release.FEATHERS_FAST_DEV, '0')
assert.equal(release.FEATHERS_R10_CONFIG_LOADER, 'bundle')
assert.match(release.FEATHERS_E2E_REPORT_PATH, /basic-r15-r1-release-e2e\.json$/)
const html = htmlE2EEnv(inherited, basic)
assert.equal(html.VITE_HTML_PRELOAD, 'assets')
assert.equal(html.VITE_HTML_PRELOAD_ASSETS, '/pwa-192x192.png')
assert.equal(html.FEATHERS_R10_CONFIG_LOADER, 'bundle')
assert.equal(inherited.VITE_HTML_PRELOAD, 'SOME_INVALID_INHERITED_VALUE', 'inherited object mutated')
assert.deepEqual(resolveHtmlPreload({}, basic), [])
assert.deepEqual(resolveHtmlPreload({ VITE_HTML_PRELOAD: '' }, basic), [])
assert.deepEqual(resolveHtmlPreload({ VITE_HTML_PRELOAD: '  ' }, basic), [])
assert.throws(() => resolveHtmlPreload({ VITE_HTML_PRELOAD: 'nonsense' }, basic), /off or assets/)
assert.match(readFileSync(new URL('./check-release-e2e.mjs', import.meta.url),'utf8'), /releaseE2EEnv\(process\.env, basic\)/)
assert.match(readFileSync(new URL('./check-r14-html-e2e.mjs', import.meta.url),'utf8'), /htmlE2EEnv\(process\.env, basic\)/)
assert.match(readFileSync(new URL('./check-basic-e2e.mjs', import.meta.url),'utf8'), /Vite exited before/)
console.log('PASS: release HTML preload isolated from Windows env; HTML gate remains opt-in; bad nonempty values rejected; startup fail-fast')
