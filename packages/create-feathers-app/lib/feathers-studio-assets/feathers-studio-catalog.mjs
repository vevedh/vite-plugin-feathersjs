// Feathers Studio Vite 7 — development-only, same-origin, read-only catalogue.
import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join, resolve, sep } from 'node:path'

const reserved = new Set(['__proto__', 'constructor', 'prototype', 'tostring', 'valueof', 'hasownproperty'])
const validName = (value) => typeof value === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && value.length <= 48 && !reserved.has(value.toLowerCase())
const allowedTypes = new Set(['string', 'boolean', 'number', 'int'])
const allowedSchemas = new Set(['typebox', 'json', 'zod', 'manual'])
const allowedDocs = new Set(['off', 'json', 'swagger', 'vitepress', 'both'])
const allowedMethods = new Set(['find', 'get', 'create', 'update', 'patch', 'remove'])
const maxSize = 32 * 1024
const databaseEngines = new Set(['memory', 'mongodb', 'postgres', 'postgresql', 'mariadb', 'mysql', 'sqlite', 'universal'])
const databaseKeys = ['version', 'databases']

export async function readConfiguredDatabases(root) {
  const realRoot = await realpath(root)
  const apiRoot = resolve(realRoot, 'api')
  const folder = resolve(realRoot, 'api/devtools')
  if ((await lstat(apiRoot)).isSymbolicLink() || (await lstat(folder)).isSymbolicLink()) throw Error('DATABASE_REGISTRY_LINK_REFUSED')
  const file = join(folder, 'database-registry.json')
  let stat
  try { stat = await noLink(file) } catch (error) { if (error?.code === 'ENOENT') return []; throw error }
  if (!stat.isFile() || stat.size > 4096) throw Error('DATABASE_REGISTRY_SIZE')
  const body = JSON.parse(await readFile(file, 'utf8'))
  if (!body || typeof body !== 'object' || Array.isArray(body) || body.version !== 1 || !allowedKeys(body, databaseKeys) || !Array.isArray(body.databases) || body.databases.length > 8) throw Error('DATABASE_REGISTRY_INVALID')
  const names = new Set()
  return body.databases.map(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !allowedKeys(entry, ['alias', 'engine']) || !validName(entry.alias) || names.has(entry.alias) || !databaseEngines.has(entry.engine)) throw Error('DATABASE_ALIAS_REFUSED')
    names.add(entry.alias)
    return { alias: entry.alias, engine: entry.engine, status: 'configured-unverified' }
  })
}
/** Only served by the opt-in development plugin, never in dist or npm runtime. */
const designerHtml = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="robots" content="noindex,nofollow"><title>Feathers Studio — Schema Designer</title></head>
<body><div id="app"></div><script type="module" src="/src/schema-designer/main.ts"></script></body></html>`
const digest = (data) => createHash('sha256').update(data).digest('hex')
const hex64 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const allowedKeys = (object, keys) => Object.keys(object).every((key) => keys.includes(key))

export function sanitizeContract(value, folder) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_CONTRACT')
  if (!validName(folder) || value.name !== folder || !allowedSchemas.has(value.schema) || !allowedDocs.has(value.docs)) throw Error('CONTRACT_MISMATCH')
  if (value.path !== `api/${folder}` || !Array.isArray(value.fields) || value.fields.length > 64 || !Array.isArray(value.methods)) throw Error('CONTRACT_FIELDS')
  if (value.methods.some((m) => !allowedMethods.has(m)) || new Set(value.methods).size !== value.methods.length || value.methods.join(',') !== 'find,get,create,patch,remove') throw Error('CONTRACT_METHODS')
  if (value.version !== 1 || !allowedKeys(value, ['version', 'name', 'path', 'schema', 'docs', 'methods', 'fields', 'source'])) throw Error('CONTRACT_VERSION_OR_EXTRA_KEYS')
  const source = value.source
  if (!source || typeof source !== 'object' || Array.isArray(source) || !allowedKeys(source, ['file','sha256','registration','registrationSha256']) || !hex64(source.sha256) || !hex64(source.registrationSha256)) throw Error('CONTRACT_PROVENANCE_MISSING')
  const extension = source.file === 'schema.ts' ? 'ts' : 'mjs'
  if (!['schema.ts', 'schema.mjs', 'notes.class.mjs'].includes(source.file) || source.registration !== `${folder}.service.${extension}` || (value.schema === 'manual') !== (source.file === 'notes.class.mjs' && folder === 'notes')) throw Error('CONTRACT_SOURCE_PROFILE_REFUSED')
  const names = new Set()
  const fields = value.fields.map((field) => {
    if (!field || typeof field !== 'object' || Array.isArray(field) || !allowedKeys(field, ['name','type','required','minLength','maxLength']) || !validName(field.name) || !allowedTypes.has(field.type) || typeof field.required !== 'boolean' || names.has(field.name)) throw Error('CONTRACT_FIELD_INVALID')
    if (field.type !== 'string' || !Number.isSafeInteger(field.minLength) || !Number.isSafeInteger(field.maxLength) || field.minLength !== 1 || field.maxLength !== 120) throw Error('CONTRACT_UNSUPPORTED_CONSTRAINTS')
    names.add(field.name)
    return Object.freeze({ name: field.name, type: field.type, required: field.required, minLength: field.minLength, maxLength: field.maxLength })
  })
  if (fields.length !== 1 || fields[0].name !== 'title' || fields[0].required !== true) throw Error('CONTRACT_PRESET_FIELD_MISMATCH')
  return Object.freeze({ name: folder, route: `/api/${folder}`, schema: value.schema, docs: value.docs, methods: [...value.methods], fields, source: { ...source } })
}

async function noLink(path) {
  const stat = await lstat(path)
  if (stat.isSymbolicLink()) throw Error('LINK_REFUSED')
  return stat
}

export async function readFeathersCatalog(root) {
  const rootReal = await realpath(root)
  const serviceRoot = resolve(rootReal, 'api/services')
  try {
    const dirStat = await noLink(serviceRoot)
    if (!dirStat.isDirectory()) throw Error('SERVICES_NOT_DIRECTORY')
  } catch (error) {
    if (error?.code === 'ENOENT') return Object.freeze({ version: 1, mode: 'READ_ONLY', services: [] })
    throw error
  }
  const items = (await readdir(serviceRoot, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))
  if (items.length > 128) throw Error('SERVICE_LIMIT')
  const services = []
  for (const item of items) {
    if (item.isSymbolicLink()) throw Error('LINK_REFUSED')
    if (!item.isDirectory() || !validName(item.name)) continue
    const path = join(serviceRoot, item.name, 'contract.json')
    if (!path.startsWith(serviceRoot + sep)) throw Error('PATH_REFUSED')
    let stat
    try { stat = await noLink(path) } catch (error) { if (error?.code === 'ENOENT') continue; throw error }
    if (!stat.isFile() || stat.size > maxSize) throw Error('CONTRACT_SIZE')
    const data = await readFile(path, 'utf8')
    if (Buffer.byteLength(data, 'utf8') > maxSize) throw Error('CONTRACT_SIZE')
    const clean = sanitizeContract(JSON.parse(data), item.name)
    for (const [filename, expected] of [[clean.source.file, clean.source.sha256], [clean.source.registration, clean.source.registrationSha256]]) {
      const target = join(serviceRoot, item.name, filename)
      const entry = await noLink(target)
      if (!entry.isFile() || entry.size > 256 * 1024 || digest(await readFile(target)) !== expected) throw Error('CONTRACT_SOURCE_DRIFT')
      if (clean.schema === 'manual' && ((filename === 'notes.class.mjs' && expected !== 'c949dd8813c89dba7bcadc26838e469a92c587f7fcaab0f8c8e1c11e8fae7e94') || (filename === 'notes.service.mjs' && expected !== '9189ba930c32cc326fb18e4e07d5126ed2dfe61d1fc7fe4e13cda3c2c866cc4d'))) throw Error('UNREVIEWED_MANUAL_PRESET')
    }
    const { source: _internal, ...publicView } = clean
    services.push(Object.freeze({ ...publicView, fingerprint: digest(Buffer.from(data, 'utf8')), sourceVerified: true }))
  }
  return Object.freeze({ version: 1, mode: 'READ_ONLY', services })
}

function loopbackHost(value) {
  return typeof value === 'string' && /^(127\.0\.0\.1|localhost):[0-9]{1,5}$/.test(value)
}
function sameOrigin(req) {
  const host = req.headers.host
  if (!loopbackHost(host)) return false
  const origin = req.headers.origin
  if (origin !== undefined && origin !== `http://${host}`) return false
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  return true
}
function reply(res, status, data, mime = 'application/json; charset=utf-8', designer = false) {
  res.statusCode = status
  res.setHeader('Content-Type', mime)
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Content-Security-Policy', designer
    ? "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:5173; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    : "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'")
  res.end(data)
}

/** The assets are served only by Vite dev middleware, never emitted to dist/public. */
export function feathersStudioCatalog({ root = process.cwd(), assets = new URL('./', import.meta.url), live } = {}) {
  return {
    name: 'feathers-studio-catalog-readonly',
    apply: 'serve',
    configureServer(server) {
      const host = server.config.server.host
      if (host !== '127.0.0.1' && host !== 'localhost') throw Error('FEATHERS_STUDIO_LOOPBACK_REQUIRED')
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0]
        if (path === '/schema-designer.html') {
          if (!sameOrigin(req)) return reply(res, 403, '{"error":"FORBIDDEN"}')
          if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, '{"error":"METHOD_NOT_ALLOWED"}')
          try {
            const html = await server.transformIndexHtml('/schema-designer.html', designerHtml)
            return reply(res, 200, req.method === 'HEAD' ? '' : html, 'text/html; charset=utf-8', true)
          } catch { return reply(res, 503, '{"error":"DESIGNER_UNAVAILABLE"}') }
        }
        if (!path.startsWith('/__feathers-studio')) return next()
        if (!['/__feathers-studio', '/__feathers-studio/', '/__feathers-studio/catalog', '/__feathers-studio/runtime', '/__feathers-studio/events', '/__feathers-studio/panel.js', '/__feathers-studio/panel.css'].includes(path)) return reply(res, 404, '{"error":"NOT_FOUND"}')
        if (!sameOrigin(req)) return reply(res, 403, '{"error":"FORBIDDEN"}')
        if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, '{"error":"METHOD_NOT_ALLOWED"}')
        if (path === '/__feathers-studio/events' && req.method !== 'GET') return reply(res, 405, '{"error":"METHOD_NOT_ALLOWED"}')
        if (path === '/__feathers-studio/runtime') {
          if (!live || typeof live.snapshot !== 'function') return reply(res, 503, '{"error":"RUNTIME_UNAVAILABLE"}')
          try {
            const publicState = live.snapshot()
            const databases = await readConfiguredDatabases(root)
            const body = JSON.stringify({ ...publicState, databases })
            return reply(res, 200, req.method === 'HEAD' ? '' : body)
          } catch { return reply(res, 503, '{"error":"RUNTIME_UNAVAILABLE"}') }
        }
        if (path === '/__feathers-studio/events') {
          if (!live || typeof live.subscribe !== 'function') return reply(res, 503, '{"error":"RUNTIME_UNAVAILABLE"}')
          let unsubscribe
          try {
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store, no-transform')
            res.setHeader('X-Content-Type-Options', 'nosniff')
            res.setHeader('Referrer-Policy', 'no-referrer')
            res.setHeader('X-Accel-Buffering', 'no')
            res.setHeader('Content-Security-Policy', "default-src 'none'; connect-src 'self'; base-uri 'none'")
            unsubscribe = live.subscribe(event => {
              if (res.destroyed || res.writableLength > 32 * 1024) { cleanup(); res.end(); return }
              // No event payloads. Only the type, public service name and sequence.
              res.write(`event: ${event.kind === 'registry' ? 'registry' : 'service'}\ndata: ${JSON.stringify(event)}\n\n`)
            })
            res.write(': Feathers Studio read-only stream\n\n')
            const timer = setInterval(() => {
              if (res.destroyed || res.writableLength > 32 * 1024) { cleanup(); res.end(); return }
              res.write(': keepalive\n\n')
            }, 25000)
            timer.unref?.()
            let closed = false
            function cleanup() {
              if (closed) return
              closed = true
              clearInterval(timer)
              unsubscribe?.()
            }
            res.on('close', cleanup)
            return
          } catch {
            unsubscribe?.()
            if (!res.headersSent) return reply(res, 503, '{"error":"LIVE_SUBSCRIBERS_LIMIT"}')
            res.end()
            return
          }
        }
        if (path === '/__feathers-studio/catalog') {
          try {
            const result = JSON.stringify(await readFeathersCatalog(root))
            return reply(res, 200, req.method === 'HEAD' ? '' : result)
          } catch { return reply(res, 503, '{"error":"CATALOG_UNAVAILABLE"}') }
        }
        const name = path.endsWith('panel.js') ? 'panel.js' : path.endsWith('panel.css') ? 'panel.css' : 'panel.html'
        try {
          const location = new URL(name, assets)
          if (location.protocol !== 'file:') throw Error('ASSET_LOCATION_REFUSED')
          const content = await readFile(location, 'utf8')
          const mime = name.endsWith('.js') ? 'application/javascript; charset=utf-8' : name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8'
          return reply(res, 200, req.method === 'HEAD' ? '' : content, mime)
        } catch { return reply(res, 503, '{"error":"PANEL_UNAVAILABLE"}') }
      })
    },
  }
}
