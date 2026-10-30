import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const base = new URL('../', import.meta.url)
const read = relative => readFile(new URL(relative, base), 'utf8')

test('r16-r6 Playwright Edge is opt-in and targets the same isolated local runtime', async () => {
  const cfg = await read('playwright.config.mjs')
  assert.match(cfg, /channel\s*=\s*process\.env\.R16_BROWSER_CHANNEL\s*\|\|\s*'msedge'/)
  assert.match(cfg, /\['msedge', 'chromium'\]/)
  assert.match(cfg, /'http:\/\/127\.0\.0\.1:8080'/)
  assert.match(cfg, /if \(baseURL !== 'http:\/\/127\.0\.0\.1:8080'\)/)
  assert.match(cfg, /workers:\s*1/)
  assert.match(cfg, /trace:\s*'retain-on-failure'/)
  assert.match(cfg, /testMatch:\s*'\*\.pw\.mjs'/)
  assert.doesNotMatch(cfg, /reuseExistingServer|webServer:/)
})

test('r16-r6 browser gates cover SSR prefetch, hydration, GUI CRUD, two contexts, realtime and responsive', async () => {
  const suite = await read('e2e/quasar-ssr-browser.pw.mjs')
  for (const required of [
    "test('SSR prefetch", "test('UI creates a note", "test('independent browser contexts",
    "test('Socket.IO propagates UI", "test('responsive console", "pageerror",
    "hydration", "'Temps réel connecté'", "test.skip(!socketRequired",
    "await page.screenshot(", "await deleteByTitle(",
  ]) assert.ok(suite.includes(required), `Missing browser coverage: ${required}`)
  assert.doesNotMatch(suite, /waitForTimeout\(\d{4,}\)|page\.route\(|\.only\(/)
})

test('r16-r6 controls real socket subscription status only on the client', async () => {
  const notes = await read('src/stores/notes.ts')
  const page = await read('src/pages/IndexPage.vue')
  assert.match(notes, /const realtimeConnected = ref\(false\)/)
  assert.match(notes, /ws\.on\('connect'/)
  assert.match(notes, /ws\.on\('disconnect'/)
  assert.match(notes, /ws\.connect\(\)/)
  assert.match(notes, /typeof window === 'undefined'/)
  assert.match(page, /data-testid="realtime-status"/)
  assert.match(page, /store\.realtimeConnected/)
})

test('r16-r6 Windows process supervision invokes Playwright before cleanup', async () => {
  const script = await read('scripts/CERTIFY_R16_WINDOWS.ps1')
  assert.match(script, /\[switch\]\$Browser/)
  assert.match(script, /\$env:R16_BROWSER_SOCKET = if \(\$Socket\)/)
  assert.match(script, /corepack pnpm run check:browser/)
  assert.ok(script.indexOf('corepack pnpm run check:browser') < script.indexOf('} finally {'))
  const pkg = JSON.parse(await read('package.json'))
  assert.equal(pkg.devDependencies['@playwright/test'], '1.64.1')
  assert.match(pkg.scripts['check:browser'], /playwright test --config playwright\.config\.mjs/)
  assert.equal(pkg.private, true)
  const ignored = await read('.gitignore')
  assert.match(ignored, /docs-private\//)
})


test('r16-r6-r1 videos are opt-in; FFmpeg validated before any servers are started', async () => {
  const cfg = await read('playwright.config.mjs')
  assert.match(cfg, /R16_BROWSER_VIDEO/)
  assert.match(cfg, /video:\s*videoSetting === '1' \? 'retain-on-failure' : 'off'/)
  assert.match(cfg, /trace:\s*'retain-on-failure'/)
  assert.match(cfg, /screenshot:\s*'only-on-failure'/)
  const script = await read('scripts/CERTIFY_R16_WINDOWS.ps1')
  assert.match(script, /\[switch\]\$Video/)
  assert.match(script, /node scripts\/check-browser-prereqs\.mjs/)
  assert.ok(script.indexOf('node scripts/check-browser-prereqs.mjs') < script.indexOf("Start-Logged -FilePath 'node.exe'"))
  const pkg = JSON.parse(await read('package.json'))
  assert.equal(pkg.scripts['check:browser:preflight'], 'node scripts/check-browser-prereqs.mjs')
})


test('r16-r6-r2 Quasar QInput is selected by accessible name, never by a nested input assumption', async () => {
  const page = await read('src/pages/IndexPage.vue')
  const suite = await read('e2e/quasar-ssr-browser.pw.mjs')
  assert.match(page, /<q-input\b[^>]*\blabel="Titre de la nouvelle note"/)
  assert.match(suite, /getByRole\('textbox',\s*\{\s*name:\s*'Titre de la nouvelle note',\s*exact:\s*true\s*\}\)/)
  assert.match(suite, /await expect\(titleInput\)\.toHaveValue\(title\)/)
  assert.doesNotMatch(suite, /\[data-testid="note-title-input"\] input/)
})

test('r16-r6-r2 Windows Edge disables GPU and native occlusion while retaining strict loopback gates', async () => {
  const cfg = await read('playwright.config.mjs')
  assert.match(cfg, /channel\s*=\s*process\.env\.R16_BROWSER_CHANNEL\s*\|\|\s*'msedge'/)
  assert.match(cfg, /'--disable-gpu'/)
  assert.match(cfg, /'--disable-features=CalculateNativeWinOcclusion'/)
  assert.match(cfg, /workers:\s*1/)
  assert.match(cfg, /if \(baseURL !== 'http:\/\/127\.0\.0\.1:8080'\)/)
})


test('r16-r6-r3 QInput hydrates only on client while Feathers notes remain server-prefetched', async () => {
  const page = await read('src/pages/IndexPage.vue')
  const css = await read('src/css/app.css')
  const suite = await read('e2e/quasar-ssr-browser.pw.mjs')
  assert.match(page, /<q-no-ssr>/)
  assert.match(page, /<template #placeholder>/)
  assert.match(page, /<q-input\s+v-model="newTitle"/)
  assert.match(page, /onServerPrefetch\(async/)
  assert.match(page, /store\.load\(\)/)
  assert.match(css, /\.note-input-shell\{/)
  assert.match(css, /\.note-input-placeholder\{/)
  assert.match(suite, /console.*hydration|hydration.*mismatch/i)
  assert.match(suite, /function assertClean\(page\)/)
  assert.match(suite, /getByRole\('textbox', \{ name: 'Titre de la nouvelle note'/)
  // Do not convert a real mismatch into a test pass by selectively suppressing warnings.
  assert.doesNotMatch(page, /data-allow-mismatch|suppressHydrationWarning/)
  assert.doesNotMatch(suite, /ignoreHTTPSErrors|\.filter\(.*hydration/)
})
