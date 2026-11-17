import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, dirname, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist/ssg')
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2' }
const server = createServer(async (req,res)=>{
  try {
    const pathname = new URL(req.url||'/', 'http://localhost').pathname
    if (pathname.startsWith('/api/')) {
      const target = new URL(pathname,'http://127.0.0.1:3030')
      const method = req.method || 'GET'
      const chunks = []
      if (method !== 'GET' && method !== 'HEAD') for await(const chunk of req) {
        chunks.push(chunk)
        if (chunks.reduce((sum,item)=>sum+item.length,0)>65536) throw new Error('Request body too large')
      }
      const response = await fetch(target,{ method, headers: { accept:'application/json', 'content-type':req.headers['content-type']||'application/json' },body:chunks.length?Buffer.concat(chunks):undefined })
      res.writeHead(response.status,{'content-type': response.headers.get('content-type')||'application/json'})
      res.end(Buffer.from(await response.arrayBuffer()));return
    }
    if (!/^\/[a-zA-Z0-9._\/-]*$/.test(pathname) || pathname.includes('..')) {res.writeHead(400);res.end();return}
    const rel = pathname === '/' ? 'index.html' : pathname === '/about' || pathname === '/about/' ? 'about/index.html' : pathname.slice(1)
    const full=resolve(root,rel)
    if (!full.startsWith(root+sep) && full !== resolve(root,'index.html')) {res.writeHead(403);res.end();return}
    const body=await readFile(full)
    res.writeHead(200, { 'content-type': mime[extname(full)] || 'application/octet-stream', 'cache-control': extname(full)==='.html' ? 'no-store' : 'public, max-age=60' })
    res.end(body)
  }
  catch (error) {res.writeHead(error.code==='ENOENT'?404:500);res.end('Not found')}
})
server.listen(5173,'127.0.0.1',()=>console.log('SSG preview: http://127.0.0.1:5173'))
