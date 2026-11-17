import { createServer } from 'node:http'
import { readFile, realpath } from 'node:fs/promises'
import { resolve, dirname, extname, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer as createViteServer } from 'vite'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const prod = process.env.NODE_ENV === 'production'
const vite = prod ? undefined : await createViteServer({ root, server: { middlewareMode: true }, appType: 'custom' })
const html = prod ? await readFile(resolve(root,'dist/client/index.html'),'utf8') : await readFile(resolve(root,'index.html'),'utf8')
const renderer = prod ? (await import(pathToFileURL(resolve(root,'dist/server/entry-server.js')).href)).render : undefined
const mime = { '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2' }
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname
  try {
    if (pathname.startsWith('/api/')) {
      const target = new URL(pathname, 'http://127.0.0.1:3030')
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await (async () => { const chunks=[];for await(const chunk of req) { chunks.push(chunk); if(chunks.reduce((n,c)=>n+c.length,0)>65536) throw new Error('Request body too large') } return Buffer.concat(chunks) })()
      const response = await fetch(target, { method: req.method, headers: { 'content-type': req.headers['content-type'] || 'application/json', accept: 'application/json' }, body })
      res.writeHead(response.status, { 'content-type': response.headers.get('content-type') || 'application/json' })
      res.end(Buffer.from(await response.arrayBuffer()));return
    }
    if (prod && pathname.startsWith('/assets/') && /^\/assets\/[a-zA-Z0-9._\/-]+$/.test(pathname)) {
      const base = await realpath(resolve(root,'dist/client/assets'))
      const pathnameOnDisk = resolve(root,'dist/client'+pathname)
      if (!pathnameOnDisk.startsWith(base + sep)) {res.writeHead(403);res.end();return}
      const bytes = await readFile(pathnameOnDisk)
      res.writeHead(200,{'content-type': mime[extname(pathname)] || 'application/octet-stream'});res.end(bytes);return
    }
    if (pathname !== '/' && pathname !== '/about' && pathname !== '/about/') { res.writeHead(404);res.end('Not found');return }
    const route = pathname.replace(/\/$/,'') || '/'
    const page = prod ? html : await vite.transformIndexHtml(pathname, html)
    const render = prod ? renderer : (await vite.ssrLoadModule('/src/entry-server.ts')).render
    const content = await render(route)
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'})
    res.end(page.replace('<!--app-html-->', content))
  }
  catch (error) { console.error('[ssr] request failed', error); if (!res.headersSent) res.writeHead(500);res.end('Internal server error') }
})
// Vite transforms assets in dev via its middleware, HTML is handled by our renderer.
const app = createServer()
app.on('request', (req,res) => {
  if (vite && !new URL(req.url||'/', 'http://localhost').pathname.startsWith('/api/'))
    vite.middlewares(req,res,()=>server.emit('request',req,res))
  else server.emit('request',req,res)
})
app.listen(5173,'127.0.0.1',()=>console.log('SSR listening on http://127.0.0.1:5173'))
process.on('SIGINT', () => { app.close(); void vite?.close() })
