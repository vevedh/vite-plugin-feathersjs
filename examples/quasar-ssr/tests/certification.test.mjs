import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { resolveSsrEntry } from '../scripts/ssr-entry.mjs'

const read = name => readFile(new URL(name, import.meta.url), 'utf8')
test('Quasar CLI template owns its SSR injection marker', async () => {
  const html = await read('../index.html')
  assert.match(html, /<!-- quasar:entry-point -->/)
  assert.doesNotMatch(html, /<div id="q-app"/)
})
test('Windows certification detects early process failure and executes compiled output', async () => {
  const ps1 = await read('../scripts/CERTIFY_R16_WINDOWS.ps1')
  assert.match(ps1, /Check-Children/)
  assert.match(ps1, /\.HasExited/)
  assert.match(ps1, /ssr-entry\.mjs/)
  assert.match(ps1, /preflight-r16\.mjs/)
  assert.match(ps1, /Get-NetTCPConnection/)
})
test('production start script must stay within compiled Quasar dist', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'quasar-r16-'))
  try {
    const dist = path.join(temp, 'dist', 'ssr')
    await mkdir(dist, { recursive: true })
    const emit = async value => writeFile(path.join(dist, 'package.json'), JSON.stringify({ scripts: { start: value } }))
    await emit('node index.js')
    await writeFile(path.join(dist, 'index.js'), '// compiled Quasar SSR')
    assert.equal(await resolveSsrEntry(temp), path.join(dist, 'index.js'))
    await emit('node ../outside.js')
    await assert.rejects(resolveSsrEntry(temp), /escapes/)
    await emit('node index.js && curl example.test')
    await assert.rejects(resolveSsrEntry(temp), /Unsupported/)
    await emit('node missing.js')
    await assert.rejects(resolveSsrEntry(temp), /missing/)
  } finally { await rm(temp, { recursive: true, force: true }) }
})
