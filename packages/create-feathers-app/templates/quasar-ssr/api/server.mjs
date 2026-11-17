import { createServer } from 'node:http'
import { createFeathersRuntime } from 'vite-plugin-feathersjs'
const adapter = process.env.FEATHERS_ADAPTER ?? 'koa'
if (adapter !== 'koa' && adapter !== 'express') throw new TypeError('FEATHERS_ADAPTER must be koa or express')
const port = Number(process.env.FEATHERS_API_PORT || 3030)
const wsPort = Number(process.env.FEATHERS_SOCKET_PORT || 3031)
const socketFlag = process.env.FEATHERS_SOCKETIO ?? '0'
if (socketFlag !== '0' && socketFlag !== '1') throw new TypeError('FEATHERS_SOCKETIO must be 0 or 1')
const realtime = socketFlag === '1'
const origin = process.env.FEATHERS_PUBLIC_ORIGIN || 'http://127.0.0.1:8080'
if (!Number.isInteger(port) || port < 1024 || port > 65535 || !Number.isInteger(wsPort) || wsPort < 1024 || wsPort > 65535 || wsPort === port) throw new Error('Invalid port configuration')
const modules = [
  new URL('./services/health/health.service.mjs', import.meta.url),
  new URL('./services/notes/notes.service.mjs', import.meta.url),
]
const runtime = await createFeathersRuntime(modules.map(String), file => import(file), {
  serviceFiles: [], adapter, prefix: '/api', cors: false,
  socketio: realtime ? { port: wsPort, origins: [origin], host: '127.0.0.1' } : false,
})
await runtime.start()
const httpServer = createServer((req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname
  if (pathname !== '/api' && !pathname.startsWith('/api/')) {
    res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"Not found"}'); return
  }
  // The Feathers transport is mounted at /api, while its services register as health/notes.
  req.url = (req.url || '/').slice(4) || '/'
  runtime.handler(req, res, error => {
    if (res.headersSent) { res.end(); return }
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'Internal server error' }))
    if (error) console.error('[feathers] request failed')
  })
})
await new Promise((resolve, reject) => {
  httpServer.once('error', reject)
  httpServer.listen(port, '127.0.0.1', resolve)
})
console.log(`Feathers ${adapter} API listening on http://127.0.0.1:${port}/api (socketio=${realtime})`)
let stopping = false
async function close() {
  if (stopping) return
  stopping = true
  await new Promise(resolve => httpServer.close(resolve))
  await runtime.close()
}
process.on('SIGINT', () => { void close().then(() => process.exit(0)) })
process.on('SIGTERM', () => { void close().then(() => process.exit(0)) })
