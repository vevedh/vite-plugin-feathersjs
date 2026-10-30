/** Pure code templates for the Basic Feathers v5 service generator. */
const title = name => name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('')
const quoted = value => JSON.stringify(value)
const asList = values => values.map(value => `'${value}'`).join(', ')
const eventsFor = methods => ['create', 'update', 'patch', 'remove']
  .filter(method => methods.includes(method))
  .map(method => ({ create: 'created', update: 'updated', patch: 'patched', remove: 'removed' })[method])

export function filesFor(spec) {
  const { name, path, methods, id, store, realtime } = spec
  const pascal = title(name)
  const prefix = name.replace(/-/g, '')
  const recordType = `${pascal}Record`
  const idType = `${pascal}Id`
  const dataType = `${pascal}Data`
  const events = eventsFor(methods)
  const stringId = id === 'string'
  const validateId = stringId
    ? "typeof candidate.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(candidate.id)"
    : "typeof candidate.id === 'number' && Number.isSafeInteger(candidate.id) && candidate.id > 0"
  const idCheck = stringId
    ? `if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) throw new BadRequest('Invalid id')\n    return value`
    : `if (typeof value !== 'string' && typeof value !== 'number') throw new BadRequest('Invalid id')\n    const parsed = Number(value)\n    if (!Number.isSafeInteger(parsed) || parsed < 1) throw new BadRequest('Invalid id')\n    return parsed`
  const schema = `/** Feathers v5 shared contract for ${name}. Safe for browser and server. */
export const ${prefix}Path = ${quoted(path)} as const
export const ${prefix}Methods = [${asList(methods)}] as const
export const ${prefix}Events = [${asList(events)}] as const
export type ${idType} = ${id}
export interface ${recordType} { id: ${idType}; title: string }
export interface ${dataType} { title: string }
export type ${pascal}Event = typeof ${prefix}Events[number]

export function is${recordType}(value: unknown): value is ${recordType} {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return ${validateId}
    && typeof candidate.title === 'string' && candidate.title.length > 0 && candidate.title.length <= 120
}

export function validate${pascal}Records(value: unknown): ${recordType}[] {
  if (!Array.isArray(value) || !value.every(is${recordType})) throw new Error('Invalid ${name} response')
  return value
}

export function normalize${pascal}Title(value: string): string {
  const result = value.trim()
  if (result.length < 1 || result.length > 120) throw new Error('Title must contain 1-120 characters')
  return result
}
`
  const serviceBodies = {
    find: `async find(): Promise<${recordType}[]> { return [...records.values()].map(item => ({ ...item })) }`,
    get: `async get(id: unknown): Promise<${recordType}> {
      const item = records.get(requireId(id))
      if (!item) throw new NotFound('Record not found')
      return { ...item }
    }`,
    create: `async create(data: unknown): Promise<${recordType}> {
      const item: ${recordType} = { id: ${stringId ? 'randomUUID()' : 'nextId++'}, title: requireTitle(data) }
      records.set(item.id, item)
      return { ...item }
    }`,
    update: `async update(id: unknown, data: unknown): Promise<${recordType}> {
      const key = requireId(id)
      if (!records.has(key)) throw new NotFound('Record not found')
      const item: ${recordType} = { id: key, title: requireTitle(data) }
      records.set(key, item)
      return { ...item }
    }`,
    patch: `async patch(id: unknown, data: unknown): Promise<${recordType}> {
      const key = requireId(id)
      const previous = records.get(key)
      if (!previous) throw new NotFound('Record not found')
      const item: ${recordType} = { ...previous, title: requireTitle(data) }
      records.set(key, item)
      return { ...item }
    }`,
    remove: `async remove(id: unknown): Promise<${recordType}> {
      const key = requireId(id)
      const item = records.get(key)
      if (!item) throw new NotFound('Record not found')
      records.delete(key)
      return { ...item }
    }`,
  }
  const usesTitle = methods.some(method => ['create', 'update', 'patch'].includes(method))
  const usesId = methods.some(method => ['get', 'update', 'patch', 'remove'].includes(method))
  const usesNotFound = usesId
  const publisher = realtime && events.length ? `
  // Demonstration-only channel. Require authenticated, per-user channels in production.
  type ChannelApi = { channel(name: string): { join(connection: RealTimeConnection): void } }
  type PublishApi = { publish(dispatcher: () => unknown): void }
  const service = app.service(${prefix}Path) as typeof app.services[string] & Partial<PublishApi>
  if (typeof service.publish === 'function') {
    const channels = app as FeathersApp & ChannelApi
    app.on('connection', (connection: RealTimeConnection) => {
      channels.channel('demo-${name}').join(connection)
    })
    service.publish(() => channels.channel('demo-${name}'))
  }
` : ''
  const serverSchema = `${usesId ? `import type { ${idType} } from '../../../shared/feathers/${name}.schema'\n` : ''}${usesTitle || usesId ? "import { BadRequest } from '@feathersjs/errors'\n" : ''}${usesTitle ? `import { normalize${pascal}Title } from '../../../shared/feathers/${name}.schema'\n` : ''}
/** Server-only input validation; browser modules import only shared contracts. */
${usesTitle ? `export function requireTitle(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || !('title' in value))
    throw new BadRequest('Expected an object with a title')
  const title = (value as { title: unknown }).title
  if (typeof title !== 'string') throw new BadRequest('Title must be a string')
  try { return normalize${pascal}Title(title) }
  catch { throw new BadRequest('Title must contain 1-120 characters') }
}
` : ''}
${usesId ? `export function requireId(value: unknown): ${idType} {
  ${idCheck}
}
` : ''}export {}
`
  const classFile = `${stringId && methods.includes('create') ? "import { randomUUID } from 'node:crypto'\n" : ''}${usesNotFound ? "import { NotFound } from '@feathersjs/errors'\n" : ''}import type { ${recordType}, ${idType} } from '../../../shared/feathers/${name}.schema'
${usesTitle || usesId ? `import { ${[usesTitle ? 'requireTitle' : '', usesId ? 'requireId' : ''].filter(Boolean).join(', ')} } from './${name}.schema'\n` : ''}
/** In-memory example service; not production storage or authorization. */
export class ${pascal}Service {
  private readonly records = new Map<${idType}, ${recordType}>()
${!stringId && methods.includes('create') ? '  private nextId = 1\n' : ''}
  ${methods.map(method => serviceBodies[method].replace(/\brecords\b/g, 'this.records').replace(/\bnextId\b/g, 'this.nextId')).join('\n\n  ')}
}
`
  const server = `${realtime && events.length ? "import type { RealTimeConnection } from '@feathersjs/feathers'\n" : ''}import type { FeathersApp } from 'vite-plugin-feathersjs'
import { ${prefix}Path, ${prefix}Methods } from '../../../shared/feathers/${name}.schema'
import { ${pascal}Service } from './${name}.class'

/** Discovery entry: a single registration file per service directory. */
export default function register(app: FeathersApp): void {
  app.use(${prefix}Path, new ${pascal}Service(), { methods: [...${prefix}Methods] })${publisher}
}
`
  const outputs = new Map([
    [`server/services/${name}/${name}.service.ts`, server],
    [`server/services/${name}/${name}.class.ts`, classFile],
    [`server/services/${name}/${name}.schema.ts`, serverSchema],
    [`shared/feathers/${name}.schema.ts`, schema],
  ])
  if (store === 'pinia') {
    const serviceMethods = {
      find: `find(): Promise<${recordType}[]>`,
      get: `get(id: ${idType}): Promise<${recordType}>`,
      create: `create(data: ${dataType}): Promise<${recordType}>`,
      update: `update(id: ${idType}, data: ${dataType}): Promise<${recordType}>`,
      patch: `patch(id: ${idType}, data: Partial<${dataType}>): Promise<${recordType}>`,
      remove: `remove(id: ${idType}): Promise<${recordType}>`,
    }
    const client = `import type { Socket } from 'socket.io-client'
import { createFeathersServiceApi } from '~/lib/feathers-client'
import { ${prefix}Path, ${prefix}Events } from '../../../../shared/feathers/${name}.schema'
import type { ${recordType}${methods.some(method => ['get', 'update', 'patch', 'remove'].includes(method)) ? `, ${idType}` : ''}${methods.some(method => ['create', 'update', 'patch'].includes(method)) ? `, ${dataType}` : ''}, ${pascal}Event } from '../../../../shared/feathers/${name}.schema'

export interface ${pascal}Service {
  ${methods.map(method => serviceMethods[method]).join('\n  ')}
  on(event: ${pascal}Event, listener: (item: ${recordType}) => void): void
  off(event: ${pascal}Event, listener: (item: ${recordType}) => void): void
}
export interface ${pascal}Api {
  service: ${pascal}Service
  socket?: Socket
  disconnect(): void
}
export function create${pascal}Api(realtime: boolean, port: number): ${pascal}Api {
  return createFeathersServiceApi<${pascal}Service>(${prefix}Path, realtime && ${prefix}Events.length > 0, port)
}
`
    const actions = []
    if (methods.includes('get')) actions.push(`async function get(id: ${idType}): Promise<void> {
    await run(current => current.service.get(id), 'upsert')
  }`)
    if (methods.includes('create')) actions.push(`async function create(title: string): Promise<void> {
    let safe: string
    try { safe = normalize${pascal}Title(title) }
    catch (cause: unknown) { error.value = cause instanceof Error ? cause.message : 'Invalid title'; return }
    await run(current => current.service.create({ title: safe }), 'upsert')
  }`)
    if (methods.includes('update')) actions.push(`async function update(id: ${idType}, title: string): Promise<void> {
    let safe: string
    try { safe = normalize${pascal}Title(title) }
    catch (cause: unknown) { error.value = cause instanceof Error ? cause.message : 'Invalid title'; return }
    await run(current => current.service.update(id, { title: safe }), 'upsert')
  }`)
    if (methods.includes('patch')) actions.push(`async function patch(id: ${idType}, title: string): Promise<void> {
    let safe: string
    try { safe = normalize${pascal}Title(title) }
    catch (cause: unknown) { error.value = cause instanceof Error ? cause.message : 'Invalid title'; return }
    await run(current => current.service.patch(id, { title: safe }), 'upsert')
  }`)
    if (methods.includes('remove')) actions.push(`async function remove(id: ${idType}): Promise<void> {
    await run(current => current.service.remove(id), 'remove')
  }`)
    const hasActions = methods.some(method => method !== 'find')
    const storeFile = `import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { create${pascal}Api } from './client'
import type { ${pascal}Api } from './client'
import { ${prefix}Events, is${recordType}${methods.some(method => ['create', 'update', 'patch'].includes(method)) ? `, normalize${pascal}Title` : ''}, validate${pascal}Records } from '../../../../shared/feathers/${name}.schema'
import type { ${recordType}, ${idType}, ${pascal}Event } from '../../../../shared/feathers/${name}.schema'

declare const __FEATHERS_SOCKET_ENABLED__: boolean
declare const __FEATHERS_SOCKET_PORT__: number

type ConnectionStatus = 'disabled' | 'disconnected' | 'connected'

/** Browser-only client lifecycle; no socket is instantiated during SSR. */
export const use${pascal}Store = defineStore('feathers-${name}', () => {
  const byId = ref<Record<string, ${recordType}>>({})
  const records = computed(() => Object.values(byId.value).sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true })))
  const loading = ref(false)
  const error = ref<string | null>(null)
  const status = ref<ConnectionStatus>('disabled')
  const events = ref<string[]>([])
  let api: ${pascal}Api | undefined
  let epoch = 0
  const listeners: Array<{ event: ${pascal}Event; listener: (item: ${recordType}) => void }> = []

  function upsert(item: ${recordType}): void { byId.value = { ...byId.value, [String(item.id)]: item } }
  function removeLocal(id: ${idType}): void {
    const next = { ...byId.value }
    delete next[String(id)]
    byId.value = next
  }

  async function refresh(): Promise<void> {
    const current = api
    if (!current) return
    const version = epoch
    loading.value = true
    error.value = null
    try {
      const result: unknown = await current.service.find()
      const received = validate${pascal}Records(result)
      if (version !== epoch) return
      byId.value = Object.fromEntries(received.map(item => [String(item.id), item]))
    }
    catch (cause: unknown) {
      if (version === epoch) error.value = cause instanceof Error ? cause.message : 'Unable to load ${name}'
    }
    finally { if (version === epoch) loading.value = false }
  }

  ${hasActions ? `async function run(operation: (current: ${pascal}Api) => Promise<${recordType}>, effect: 'upsert' | 'remove'): Promise<void> {
    const current = api
    if (!current || loading.value) return
    const version = epoch
    loading.value = true
    error.value = null
    try {
      const result: unknown = await operation(current)
      if (!is${recordType}(result)) throw new Error('Invalid ${name} response')
      if (version !== epoch) return
      if (effect === 'remove') removeLocal(result.id)
      else upsert(result)
    }
    catch (cause: unknown) {
      if (version === epoch) error.value = cause instanceof Error ? cause.message : 'Service operation failed'
    }
    finally { if (version === epoch) loading.value = false }
  }` : ''}

  ${actions.join('\n\n  ')}

  function connect(): void {
    if (typeof window === 'undefined' || api) return
    epoch++
    try {
      api = create${pascal}Api(__FEATHERS_SOCKET_ENABLED__, __FEATHERS_SOCKET_PORT__)
      status.value = api.socket ? 'disconnected' : 'disabled'
      if (api.socket) {
        api.socket.on('connect', () => { status.value = 'connected'; void refresh() })
        api.socket.on('disconnect', () => { status.value = 'disconnected' })
        for (const event of ${prefix}Events) {
          const listener = (item: ${recordType}): void => {
            if (!is${recordType}(item)) return
            if (String(event) === 'removed') removeLocal(item.id)
            else upsert(item)
            events.value = [\`\${event}: #\${item.id}\`, ...events.value].slice(0, 10)
          }
          api.service.on(event, listener)
          listeners.push({ event, listener })
        }
        api.socket.connect()
      }
      void refresh()
    }
    catch (cause: unknown) { error.value = cause instanceof Error ? cause.message : 'Connection failed' }
  }

  function disconnect(): void {
    epoch++
    if (api) {
      for (const { event, listener } of listeners) api.service.off(event, listener)
      listeners.length = 0
      api.disconnect()
    }
    api = undefined
    status.value = __FEATHERS_SOCKET_ENABLED__ && ${prefix}Events.length > 0 ? 'disconnected' : 'disabled'
    loading.value = false
  }

  return { records, loading, error, status, events, connect, disconnect, refresh${methods.filter(m => m !== 'find').map(m => `, ${m}`).join('')} }
})
`
    outputs.set(`src/feathers/services/${name}/client.ts`, client)
    outputs.set(`src/feathers/services/${name}/store.ts`, storeFile)
  }
  return { outputs, events, pascal }
}
