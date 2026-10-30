import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const appRoot = new URL('../', import.meta.url)
let hasDeps = false
try {
  await import('@feathersjs/feathers')
  await import('vite-plugin-feathersjs')
  hasDeps = true
} catch (error) {
  if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error
}

async function allocatePort() {
  const tcp = createServer()
  await new Promise((resolve, reject) => {
    tcp.once('error', reject)
    tcp.listen(0, '127.0.0.1', resolve)
  })
  const port = tcp.address().port
  await new Promise((resolve, reject) => tcp.close(error => error ? reject(error) : resolve()))
  return port
}

async function run(adapter) {
  const port = await allocatePort()
  const base = `http://127.0.0.1:${port}/api`
  const child = spawn(process.execPath, ['api/server.mjs'], {
    cwd: fileURLToPath(appRoot),
    env: { ...process.env, FEATHERS_ADAPTER: adapter, FEATHERS_API_PORT: String(port), FEATHERS_SOCKETIO: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let logs = ''
  child.stdout.on('data', data => { logs = (logs + data.toString()).slice(-6000) })
  child.stderr.on('data', data => { logs = (logs + data.toString()).slice(-6000) })
  let exited = false
  child.on('exit', () => { exited = true })
  const request = async (path, opts) => fetch(base + path, { ...opts, signal: AbortSignal.timeout(3000) })
  try {
    let ready = false
    for (let i = 0; i < 100; i++) {
      if (exited) throw new Error(`API exited before readiness:\n${logs}`)
      try {
        const response = await request('/health')
        if (response.status === 200) { ready = true; break }
      } catch { /* transient loopback readiness, bounded below */ }
      await delay(100)
    }
    assert.ok(ready, `API not ready (${adapter}):\n${logs}`)
    const post = await request('/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'receiver-regression' }) })
    const postBody = await post.text()
    assert.equal(post.status, 201, `POST 201 expected (${adapter}): ${postBody}\n${logs}`)
    const note = JSON.parse(postBody)
    assert.equal(note.id, 2)
    assert.equal(note.title, 'receiver-regression')
    const get = await request(`/notes/${note.id}`)
    assert.equal(get.status, 200)
    assert.equal((await get.json()).id, note.id)
    const patch = await request(`/notes/${note.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'updated' }) })
    assert.equal(patch.status, 200, await patch.text())
    const remove = await request(`/notes/${note.id}`, { method: 'DELETE' })
    assert.equal(remove.status, 200, await remove.text())
    const gone = await request(`/notes/${note.id}`)
    assert.equal(gone.status, 404)
    const bad = await request('/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: '' }) })
    assert.equal(bad.status, 400)
  } finally {
    if (!exited) {
      child.kill('SIGTERM')
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(3000)])
      if (!exited) child.kill('SIGKILL')
    }
  }
}

test('real Koa API HTTP CRUD survives Feathers wrapped private receivers', { skip: !hasDeps && 'npm dependencies unavailable; run on Windows after pnpm install' }, async () => {
  await run('koa')
})
test('real Express API HTTP CRUD survives Feathers wrapped private receivers', { skip: !hasDeps && 'npm dependencies unavailable; run on Windows after pnpm install' }, async () => {
  await run('express')
})
