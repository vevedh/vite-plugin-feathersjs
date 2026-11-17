import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generate, parseArguments } from './service-generator/core.mjs'

// Local read-only MCP server; no third-party runtime, credentials, network,
// shell execution or filesystem mutation. Strictly constrained to this project.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = resolve(root, 'feathers.services.json')
const MAX_LINE = 65536

function services() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.framework !== 'feathers-v5' || !Array.isArray(manifest.modules))
    throw new Error('Invalid or non-v5 service manifest')
  return manifest.modules
}

const noArguments = { type: 'object', properties: {}, additionalProperties: false }
const tools = [
  { name: 'list_feathers_v5_services', description: 'List the locally declared FeathersJS v5 service blueprints (read-only).', inputSchema: noArguments },
  { name: 'inspect_feathers_v5_service', description: 'Inspect a FeathersJS v5 service manifest entry by exact name (read-only).', inputSchema: {
    type: 'object', properties: { name: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' } }, required: ['name'], additionalProperties: false,
  } },
  { name: 'preview_feathers_v5_service', description: 'Preview the built-in FeathersJS v5 generator output without filesystem writes.', inputSchema: {
    type: 'object', properties: {
      name: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
      store: { type: 'string', enum: ['pinia', 'none'] },
      realtime: { type: 'boolean' },
    }, required: ['name'], additionalProperties: false,
  } },
]

function isPlainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function validateArgs(value, allowed) {
  if (!isPlainObject(value)) throw new Error('Expected arguments object')
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unexpected argument: ${key}`)
  if (!/^[a-z][a-z0-9-]*$/.test(value.name ?? '')) throw new Error('Invalid service name')
}

export function handleRequest(request) {
  if (!isPlainObject(request) || request.jsonrpc !== '2.0' || typeof request.method !== 'string')
    return { error: { code: -32600, message: 'Invalid Request' } }
  const { method, params } = request
  try {
    if (method === 'initialize') return { result: {
      protocolVersion: typeof params?.protocolVersion === 'string' ? params.protocolVersion : '2024-11-05',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'vite-feathers-v5-blueprints', version: '0.1.0' },
    } }
    if (method === 'ping') return { result: {} }
    if (method === 'tools/list') return { result: { tools } }
    if (method === 'tools/call') {
      const { name, arguments: values = {} } = params ?? {}
      let content
      if (name === 'list_feathers_v5_services') {
        if (!isPlainObject(values) || Object.keys(values).length) throw new Error('Unexpected arguments')
        content = { framework: 'feathers-v5', modules: services().map(({ name, path, methods, storeExport, realtime }) => ({ name, path, methods, storeExport, realtime })) }
      }
      else if (name === 'inspect_feathers_v5_service') {
        validateArgs(values, ['name'])
        const module = services().find(service => service.name === values.name)
        if (!module) throw new Error('Service not found')
        content = { framework: 'feathers-v5', module }
      }
      else if (name === 'preview_feathers_v5_service') {
        validateArgs(values, ['name', 'store', 'realtime'])
        if (values.store !== undefined && !['pinia', 'none'].includes(values.store)) throw new Error('Invalid store')
        if (values.realtime !== undefined && typeof values.realtime !== 'boolean') throw new Error('Invalid realtime flag')
        const args = [values.name, '--store', values.store ?? 'pinia', ...(values.realtime ? ['--realtime'] : []), '--dry-run']
        const preview = generate(root, parseArguments(args))
        if (!preview.dryRun) throw new Error('Generator preview failed closed')
        content = { framework: 'feathers-v5', mode: 'dry-run', preview }
      }
      else throw new Error('Unknown tool')
      return { result: { content: [{ type: 'text', text: JSON.stringify(content) }] } }
    }
    return { error: { code: -32601, message: 'Method not found' } }
  }
  catch (cause) {
    // No filesystem paths or source traces returned across the protocol boundary.
    return { result: { isError: true, content: [{ type: 'text', text: cause?.message ?? 'Request failed' }] } }
  }
}

function respond(request) {
  if (request && !Object.hasOwn(request, 'id')) return
  const output = handleRequest(request)
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request?.id ?? null, ...output })}\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdin.setEncoding('utf8')
  let buffer = ''
  process.stdin.on('data', chunk => {
    buffer += chunk
    if (buffer.length > MAX_LINE) {
      process.stderr.write('MCP input too large\n')
      process.exitCode = 1
      process.stdin.pause()
      return
    }
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try { respond(JSON.parse(line)) }
      catch { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`) }
    }
  })
}
