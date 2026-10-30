import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { resolveLocalPlaywrightCli } from '../examples/r17/scripts/resolve-playwright-cli.mjs'
import { parseRunOptions, caseDirectory, browserMode, assertExampleHtml } from '../examples/r17/scripts/r17-runner-config.mjs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cases = {
  'quasar-spa':'generated/r17-quasar-spa',
  'daisyui-spa':'generated/r17-daisyui-spa',
  'daisyui-ssr':'daisyui-ssr',
  'daisyui-ssg':'daisyui-ssg',
}
test('R17 all four runnable cases carry unique HTML identity and inline favicon', async () => {
  for (const [name, path] of Object.entries(cases)) {
    assert.equal(caseDirectory(name), path)
    const html = await readFile(resolve(root, 'examples/r17', path, 'index.html'), 'utf8')
    assert.doesNotThrow(() => assertExampleHtml(html, name))
    assert.match(html, /<link rel="icon" href="data:,">/)
    for(const other of Object.keys(cases).filter(x=>x!==name)) assert.throws(()=>assertExampleHtml(html, other), /Wrong R17 example/)
  }
})
test('R17 no silent wrong-site fallback or unsupported case', () => {
  for(const malformed of ['<!doctype html><title>R17</title>', '<meta name="r17-example" content="quasar-spa">']) {
    assert.throws(()=>assertExampleHtml(malformed,'daisyui-spa'),/Wrong R17 example/)
  }
  assert.throws(()=>caseDirectory('quasar-ssg'), /Unsupported R17 case/)
})
test('R17 runner rejects unsafe options and unsupported socket/production combinations', () => {
  for (const args of [[], ['--case','unknown'], ['--case','../escape'], ['--case','quasar-spa','--adapter','hono'], ['--case','daisyui-ssr','--socket'], ['--case','daisyui-ssg','--socket'], ['--case','quasar-spa','--production'], ['--case','quasar-spa','--case','quasar-spa'], ['--case','quasar-spa','--project','../../escape'], ['--case','daisyui-ssg','--project','../escape']]) {
    assert.throws(()=>parseRunOptions(args))
  }
  const spa = parseRunOptions(['--case','quasar-spa','--adapter','express','--socket','--project','portail-quasar'])
  assert.equal(parseRunOptions(['--case','daisyui-ssg','--project','site-public']).project,'site-public')
  assert.equal(spa.project,'portail-quasar')
  assert.equal(spa.socket,true)
  assert.equal(spa.adapter,'express')
  assert.equal(browserMode(spa.case),'spa')
  assert.equal(browserMode('daisyui-ssr'),'ssr')
  assert.equal(browserMode('daisyui-ssg'),'ssg')
})
test('R17 generator HTML templates and sample projects carry the same marker contract', async () => {
  const generator = await readFile(resolve(root, 'packages/create-feathers-app/lib/scaffold.mjs'), 'utf8')
  const common = await readFile(resolve(root, 'examples/r17/templates/spa/common/index.html'), 'utf8')
  assert.match(generator,/replace\('__R17_CASE__'/)
  assert.match(common,/__R17_CASE__/)
  const browser = await readFile(resolve(root,'examples/quasar-ssr/e2e/r17-cases.pw.mjs'),'utf8')
  assert.match(browser, /r17-example/)
  assert.match(browser, /\/api\/health/)
  assert.match(browser, /response.status\(\) >= 400/)
  assert.match(browser, /R17 Socket.IO synchronizes two independent SPA clients/)
  assert.match(browser, /trackBrowserErrors\(pageA\)/)
  assert.match(browser, /trackBrowserErrors\(pageB\)/)
  const config = await readFile(resolve(root,'examples/quasar-ssr/playwright.r17.config.mjs'),'utf8')
  assert.match(config, /R17_CASE/)
  assert.match(config,/--disable-gpu/)
  const launch = await readFile(resolve(root, 'examples/r17/scripts/certify-r17.mjs'), 'utf8')
  assert.match(launch,/portIsFree/)
  assert.match(launch,/resolveLocalPlaywrightCli\(playwrightRoot\)/)
  assert.doesNotMatch(launch,/resolve\(['"]playwright\/cli['"]\)/)
  assert.match(launch,/taskkill/)
  assert.match(launch,/assertExampleHtml/)
  assert.match(launch,/childCheck\('HTTP health \+ CRUD'/)
})

// Playwright 1.64 exposes @playwright/test/cli. The old nested import
// playwright/cli is not a public exports-map path and caused the Windows R17 failure.
test('R17 resolves Playwright via @playwright/test/cli without private playwright/cli', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'r17-playwright-cli-'))
  try {
    const project = join(fixture, 'quasar-ssr')
    const pkg = join(project, 'node_modules', '@playwright', 'test')
    await mkdir(pkg, { recursive: true })
    await writeFile(join(project, 'package.json'), '{"name":"fake-r16-consumer","type":"module"}')
    await writeFile(join(pkg, 'package.json'), JSON.stringify({
      name: '@playwright/test', version: '1.64.1',
      exports: { '.': './index.js', './cli': './cli.js' },
      bin: { playwright: './cli.js' },
    }))
    await writeFile(join(pkg, 'index.js'), 'module.exports = {}\n')
    await writeFile(join(pkg, 'cli.js'), 'process.stdout.write("test cli")\n')
    assert.equal(await resolveLocalPlaywrightCli(project), join(pkg, 'cli.js'))
  } finally { await rm(fixture, { recursive: true, force: true }) }
})

test('R17 Playwright preflight gives a useful missing-dependency diagnosis', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'r17-playwright-missing-'))
  try {
    await writeFile(join(fixture, 'package.json'), '{"name":"fake-r16-consumer"}')
    await assert.rejects(resolveLocalPlaywrightCli(fixture), /corepack pnpm install; corepack pnpm exec playwright --version/)
  } finally { await rm(fixture, { recursive: true, force: true }) }
})
