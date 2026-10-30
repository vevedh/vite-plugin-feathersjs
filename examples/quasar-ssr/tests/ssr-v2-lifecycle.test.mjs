import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { checkProductionDependencies } from '../scripts/production-deps.mjs'

const read = name => readFile(new URL(name, import.meta.url), 'utf8')

test('Quasar app-vite v2 SSR uses modern static installer and listen signature', async () => {
  const source = await read('../src-ssr/server.ts')
  assert.match(source, /ssrServeStaticContent\(\(\{ app, resolve \}\) =>/)
  assert.match(source, /return \(\{ urlPath = '\/', pathToServe = '\.', opts = \{\} \}\) =>/)
  assert.match(source, /app\.use\(url, express\.static\(publicFolder/)
  assert.match(source, /resolve\.public\(pathToServe\)/)
  assert.match(source, /resolve\.urlPath\(urlPath\)/)
  assert.match(source, /ssrListen\(\(\{ app, devHttpsApp, port \}\)/)
  assert.doesNotMatch(source, /await isReady\(\)/)
  assert.doesNotMatch(source, /ssrServeStaticContent\(\(path, opts\)/)
})

test('SSR config declares runtime serialization dependency in generated package', async () => {
  const source = await read('../quasar.config.ts')
  assert.match(source, /extendPackageJson\(pkg\)/)
  assert.match(source, /pkg\.dependencies\['serialize-javascript'\]/)
  const render = await read('../src-ssr/middlewares/render.ts')
  assert.doesNotMatch(render, /serve\.error\(/)
})

test('SSR runtime dependency preflight fails closed and accepts valid compiled install', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'r16-r3-deps-'))
  try {
    const dist = path.join(root, 'dist', 'ssr')
    await mkdir(dist, { recursive: true })
    await writeFile(path.join(dist, 'index.js'), '// entry')
    const manifest = async (dependencies) => writeFile(path.join(dist, 'package.json'), JSON.stringify({ scripts: { start: 'node index.js' }, dependencies }))
    await manifest({})
    await assert.rejects(checkProductionDependencies(root), /omits serialize-javascript/)
    await manifest({ 'serialize-javascript':'^6.0.2', express:'^4.21.2' })
    await assert.rejects(checkProductionDependencies(root), /production dependencies absent/)
    await mkdir(path.join(dist, 'node_modules'))
    await assert.rejects(checkProductionDependencies(root, { resolve: () => { throw new Error('not found') } }), /serialize-javascript unavailable/)
    const result = await checkProductionDependencies(root, { resolve: () => '/tmp/test-module.js' })
    assert.equal(result.dependencyCount, 2)
    assert.equal(result.entry, path.join(dist, 'index.js'))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('Windows production gate verifies dependencies before launch', async () => {
  const source = await read('../scripts/CERTIFY_R16_WINDOWS.ps1')
  assert.match(source, /production-deps\.mjs/)
  assert.match(source, /PREPARE_R16_PRODUCTION\.ps1/)
  const prep = await read('../scripts/PREPARE_R16_PRODUCTION.ps1')
  assert.match(prep, /Push-Location \$dist/)
  assert.match(prep, /pnpm install --prod --ignore-scripts/)
  assert.match(prep, /finally \{ Pop-Location \}/)
})
