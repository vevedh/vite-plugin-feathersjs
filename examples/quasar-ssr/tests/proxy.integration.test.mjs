import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function server(handler) {
  const http = createServer(handler)
  return new Promise((resolve, reject) => {
    http.once('error', reject)
    http.listen(0, '127.0.0.1', () => resolve(http))
  })
}
async function closeServer(http) { await new Promise(resolve => http.close(resolve)) }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

test('real loopback HTTP forwarding preserves API and SSR separation', { timeout: 15_000 }, async () => {
  const api = await server((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ route: 'api', path: req.url }))
  })
  const ssr = await server((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(`<html><body>SSR route ${req.url}</body></html>`)
  })
  const socket = await server((_req, res) => { res.end('socket') })
  const temporary = await server((_req, res) => res.end('reserved'))
  const edgePort = temporary.address().port
  await closeServer(temporary)
  const env = {
    ...process.env,
    FEATHERS_EDGE_PORT: String(edgePort),
    FEATHERS_API_PORT: String(api.address().port),
    FEATHERS_SOCKET_PORT: String(socket.address().port),
    QUASAR_SSR_PORT: String(ssr.address().port),
  }
  const file = resolve(fileURLToPath(new URL('../scripts/edge-proxy.mjs', import.meta.url)))
  const child = spawn(process.execPath, [file], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  let errors = ''
  child.stderr.on('data', chunk => { errors += chunk.toString() })
  try {
    let ready = false
    for (let i = 0; i < 80; i++) {
      try { const response = await fetch(`http://127.0.0.1:${edgePort}/api/health`); if (response.ok) { ready = true; break } } catch {}
      await sleep(35)
    }
    assert.ok(ready, `edge failed to start: ${errors}`)
    const base = `http://127.0.0.1:${edgePort}`
    assert.deepEqual(await (await fetch(`${base}/api/notes?q=1`)).json(), { route: 'api', path: '/api/notes?q=1' })
    const page = await (await fetch(`${base}/dashboard`)).text()
    assert.match(page, /SSR route \/dashboard/)
    const socketResponse = await (await fetch(`${base}/socket.io/?EIO=4`)).text()
    assert.equal(socketResponse, 'socket')
  } finally {
    child.kill()
    if (child.exitCode === null && child.signalCode === null) await Promise.race([once(child, 'exit'), sleep(1000)])
    await Promise.all([closeServer(api), closeServer(ssr), closeServer(socket)])
  }
})
