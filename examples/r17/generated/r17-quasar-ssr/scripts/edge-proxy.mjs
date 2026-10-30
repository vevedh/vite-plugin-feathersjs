import { createServer, request } from 'node:http'
import { connect } from 'node:net'
import { selectTarget, targetConfig } from './edge-routing.mjs'
const edgePort = Number(process.env.FEATHERS_EDGE_PORT || 8080)
if (!Number.isInteger(edgePort) || edgePort < 1024 || edgePort > 65535) throw new Error('Invalid edge port')
const proxy = createServer((req, res) => {
  const path = new URL(req.url || '/', 'http://localhost').pathname
  const upstream = targetConfig(selectTarget(path))
  const forwarded = request({ ...upstream, method: req.method, path: req.url, headers: { ...req.headers, host: `127.0.0.1:${upstream.port}` } }, response => {
    res.writeHead(response.statusCode || 502, response.headers)
    response.pipe(res)
  })
  forwarded.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Upstream unavailable') })
  req.pipe(forwarded)
})
proxy.on('upgrade', (req, socket, head) => {
  const path = new URL(req.url || '/', 'http://localhost').pathname
  const upstream = targetConfig(selectTarget(path))
  const peer = connect(upstream.port, upstream.hostname)
  peer.on('connect', () => {
    const requestLine = `${req.method || 'GET'} ${req.url} HTTP/1.1\r\n`
    const headers = Object.entries(req.headers).map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(', ') : value}\r\n`).join('')
    peer.write(requestLine + headers + '\r\n')
    if (head.length) peer.write(head)
    peer.pipe(socket).pipe(peer)
  })
  peer.on('error', () => socket.destroy())
  socket.on('error', () => peer.destroy())
})
proxy.listen(edgePort, '127.0.0.1', () => console.log(`Local edge http://127.0.0.1:${edgePort} -> /api (3030), /socket.io (3031), SSR (9100)`))
