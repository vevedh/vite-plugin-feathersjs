import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const types = new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8'],['.svg','image/svg+xml'],['.png','image/png'],['.ico','image/x-icon'],['.webp','image/webp'],['.woff2','font/woff2'],['.txt','text/plain; charset=utf-8']])
function within(root, candidate) {
  const rel = relative(root, candidate)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}
function response(res, status, message = '') {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' })
  res.end(message)
}
export async function createSpaHandler(rootUrl) {
  const root = await realpath(fileURLToPath(rootUrl))
  const index = await realpath(resolve(root, 'index.html'))
  if (!within(root,index) || !(await stat(index)).isFile()) throw new Error('GATE25_DIST_INDEX_INVALID')
  return async function serveSpa(req,res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return response(res,405,'Method not allowed')
    let pathname
    try {
      const raw = new URL(req.url || '/', 'http://localhost').pathname
      if (/%2f|%5c|%00/i.test(raw) || raw.includes('\\')) return response(res,400,'Invalid path')
      pathname = decodeURIComponent(raw)
    } catch { return response(res,400,'Invalid path') }
    if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(segment => segment === '..' || segment.startsWith('.'))) return response(res,404,'Not found')
    if (pathname === '/socket.io' || pathname.startsWith('/socket.io/') || pathname === '/api' || pathname.startsWith('/api/')) return response(res,404,'Not found')
    const candidate = resolve(root, `.${pathname}`)
    if (!within(root,candidate)) return response(res,404,'Not found')
    let file = pathname === '/' ? index : candidate
    let info
    try {
      file = await realpath(file)
      if (!within(root,file)) return response(res,404,'Not found')
      info = await stat(file)
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error
    }
    if (!info?.isFile()) {
      const accept = String(req.headers.accept || '')
      if (extname(pathname) || !accept.includes('text/html')) return response(res,404,'Not found')
      file = index
      info = await stat(index)
    }
    const html = file === index
    const headers = {
      'content-type': types.get(extname(file)) || 'application/octet-stream',
      'content-length': String(info.size),
      'x-content-type-options':'nosniff',
      'cache-control': html ? 'no-store' : 'public, max-age=3600',
      'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    }
    res.writeHead(200,headers)
    if (req.method === 'HEAD') return res.end()
    const stream = createReadStream(file)
    stream.once('error', () => { if (!res.headersSent) response(res,500,'Internal error'); else res.destroy() })
    stream.pipe(res)
  }
}
