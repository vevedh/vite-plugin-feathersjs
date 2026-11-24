import { createServer } from 'node:http'
import { EventEmitter } from 'node:events'
import type { AddressInfo } from 'node:net'
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import feathersPlugin from '../src/index.js'
import type { FeathersApp, FeathersPluginOptions, ModuleNamespace } from '../src/types.js'

/**
 * Exercises the real Vite plugin lifecycle hooks, the actual Koa/Express
 * Feathers runtimes and loopback Socket.IO. Only Vite's watcher and module
 * loader are simulated; the complete Vite CLI process is not certified here.
 */
type Adapter = 'koa' | 'express'
type StrictMiddleware = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: (error?: unknown) => void) => void
interface Hooks {
  configResolved(options: { root: string }): void
  configureServer(server: unknown): void | (() => Promise<void>) | Promise<() => Promise<void>>
}
interface Harness {
  address: string
  socketPort?: number
  errors: string[]
  setVersion(value: string): void
  triggerChange(): void
  readyCount(): number
  close(): Promise<void>
}
const hosts: Harness[] = []
const sockets: Socket[] = []
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect()
  for (const host of hosts.splice(0)) await host.close()
})

async function availablePort(): Promise<number> {
  const socket = createServer()
  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject)
    socket.listen(0, '127.0.0.1', resolve)
  })
  const port = (socket.address() as AddressInfo).port
  await new Promise<void>((resolve, reject) => socket.close(error => error ? reject(error) : resolve()))
  return port
}

async function until<T>(read: () => Promise<T>, condition: (value: T) => boolean, timeoutMs = 10000): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let last: unknown
  while (Date.now() < deadline) {
    try {
      const value = await read()
      if (condition(value)) return value
      last = value
    } catch (error) { last = error }
    await new Promise(resolve => setTimeout(resolve, 80))
  }
  throw new Error(`HMR condition not reached in ${timeoutMs}ms; observed type: ${typeof last}`)
}

async function createHarness(adapter: Adapter, realtime: boolean, inPlace: boolean): Promise<Harness> {
  const root = await realpath(await mkdtemp(join(await realpath(tmpdir()), 'vite-native-hmr-')))
  const service = resolve(root, 'services', 'notes.service.ts')
  await mkdir(join(root, 'services'), { recursive: true })
  await writeFile(service, '/* isolated test module path */\n')
  let revision = 'v1'
  let activeRevision = 'v1'
  const errors: string[] = []
  let readyCount = 0
  const events = new EventEmitter()
  const middlewares: Array<{ prefix: string; middleware: StrictMiddleware }> = []
  const httpServer = createServer((request, response) => {
    const originalUrl = request.url ?? '/'
    const matched = middlewares.find(item => originalUrl === item.prefix || originalUrl.startsWith(`${item.prefix}/`))
    if (!matched) { response.writeHead(404); response.end(); return }
    request.url = originalUrl.slice(matched.prefix.length) || '/'
    matched.middleware(request, response, () => {
      if (!response.headersSent) response.writeHead(404)
      response.end()
    })
  })
  const socketPort = realtime ? await availablePort() : undefined
  const options: FeathersPluginOptions = {
    serviceFiles: 'services/*.service.ts', adapter, prefix: '/api', lifecycle: 'managed',
    serviceRegistration: 'reject-duplicates', debounceMs: 15,
    socketio: socketPort === undefined ? false : {
      port: socketPort,
      host: '127.0.0.1',
      origins: ['http://127.0.0.1:5173'],
    },
  }
  const register = (app: FeathersApp) => {
    const registrationVersion = revision
    app.use('notes', { async find() { return [{ id: 1, version: inPlace ? activeRevision : registrationVersion }] } })
  }
  const modules = async (_file: string): Promise<ModuleNamespace> => ({
    default: register,
    ...(inPlace ? { hotUpdate: async (_app: FeathersApp) => { activeRevision = revision } } : {}),
  })
  const plugin = feathersPlugin(options) as unknown as Hooks
  let started = false
  try {
    plugin.configResolved({ root })
    const configure = await plugin.configureServer({
      config: { logger: { info: (msg: string) => { if (msg.includes(' ready:')) readyCount++ }, error: (msg: string) => { errors.push(msg) } } },
      ssrLoadModule: modules,
      watcher: { on: events.on.bind(events), off: events.off.bind(events) },
      middlewares: { use: (prefix: string, middleware: StrictMiddleware) => { middlewares.push({ prefix, middleware }) } },
      httpServer,
    })
    if (typeof configure !== 'function') throw new Error('Missing Vite post middleware hook')
    await configure()
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject)
      httpServer.listen(0, '127.0.0.1', resolve)
    })
    started = true
    const address = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`
    await until(async () => {
      const response = await fetch(`${address}/api/notes`)
      return response.status
    }, value => value === 200)
    const host: Harness = {
      address,
      ...(socketPort === undefined ? {} : { socketPort }),
      errors,
      setVersion(value) { revision = value; writeFileSync(service, `/* isolated test module path: ${value} */\n`) },
      triggerChange() { events.emit('all', 'change', service) },
      readyCount() { return readyCount },
      async close() {
        events.removeAllListeners()
        if (httpServer.listening) await new Promise<void>((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve()))
        // close event initiates plugin cleanup; a short loop avoids racing
        // temp-dir removal while asynchronous Socket.IO teardown completes.
        if (socketPort !== undefined) {
          await until(async () => {
            const probe = createServer()
            try {
              await new Promise<void>((resolve, reject) => {
                probe.once('error', reject)
                probe.listen(socketPort, '127.0.0.1', resolve)
              })
              return true
            } catch { return false }
            finally { if (probe.listening) await new Promise<void>(resolve => probe.close(() => resolve())) }
          }, value => value, 10000)
        }
        await rm(root, { recursive: true, force: true })
      },
    }
    hosts.push(host)
    return host
  } catch (error) {
    if (started && httpServer.listening) await new Promise<void>(resolve => httpServer.close(() => resolve()))
    await rm(root, { recursive: true, force: true })
    throw error
  }
}

async function httpVersion(host: Harness): Promise<string> {
  const response = await fetch(`${host.address}/api/notes`)
  if (response.status !== 200) throw new Error(`REST status ${response.status}`)
  const payload: unknown = await response.json()
  if (!Array.isArray(payload) || payload.length !== 1 || typeof payload[0]?.version !== 'string') throw new Error('Invalid REST service shape')
  return payload[0].version as string
}

async function connectSocket(port: number): Promise<Socket> {
  const socket = io(`http://127.0.0.1:${port}`, {
    transports: ['websocket'], reconnection: false, timeout: 5000,
    extraHeaders: { origin: 'http://127.0.0.1:5173' },
  })
  sockets.push(socket)
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket.IO connection timeout')), 6000)
    socket.once('connect', () => { clearTimeout(timeout); resolve() })
    socket.once('connect_error', error => { clearTimeout(timeout); reject(error) })
  })
  return socket
}

async function socketVersion(socket: Socket): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket.IO Feathers find timeout')), 4000)
    socket.emit('find', 'notes', {}, (error: unknown, rows: Array<{ version: string }>) => {
      clearTimeout(timeout)
      if (error) reject(error)
      else if (!Array.isArray(rows) || typeof rows[0]?.version !== 'string') reject(new Error('Invalid Socket.IO data'))
      else resolve(rows[0].version)
    })
  })
}

for (const adapter of ['koa', 'express'] as const) {
  describe(`P0-R5 ${adapter} managed strict HMR`, () => {
    it('rebuilds REST module, switches active HTTP handler and preserves strict registration', async () => {
      const host = await createHarness(adapter, false, false)
      expect(await httpVersion(host)).toBe('v1')
      host.setVersion('v2')
      host.triggerChange()
      expect(await until(() => httpVersion(host), value => value === 'v2')).toBe('v2')
      expect(host.errors).toEqual([])
    })

    it('runs in-place Socket.IO hotUpdate without disconnecting an existing client', async () => {
      const host = await createHarness(adapter, true, true)
      const socket = await connectSocket(host.socketPort!)
      expect(await socketVersion(socket)).toBe('v1')
      let disconnects = 0
      socket.on('disconnect', () => { disconnects++ })
      host.setVersion('v2')
      host.triggerChange()
      expect(await until(() => socketVersion(socket), value => value === 'v2')).toBe('v2')
      expect(socket.connected).toBe(true)
      expect(disconnects).toBe(0)
      expect(host.errors).toEqual([])
    })

    it('does not close a published runtime on duplicate watcher events for identical bytes', async () => {
      const host = await createHarness(adapter, true, false)
      expect(host.readyCount()).toBe(1)
      host.setVersion('v2')
      host.triggerChange()
      expect(await until(() => httpVersion(host), value => value === 'v2')).toBe('v2')
      expect(host.readyCount()).toBe(2)
      const socket = await connectSocket(host.socketPort!)
      let disconnects = 0
      socket.on('disconnect', () => { disconnects++ })
      host.triggerChange()
      await new Promise(resolve => setTimeout(resolve, 450))
      expect(await httpVersion(host)).toBe('v2')
      expect(host.readyCount()).toBe(2)
      expect(socket.connected).toBe(true)
      expect(disconnects).toBe(0)
      host.setVersion('v3')
      host.triggerChange()
      expect(await until(() => httpVersion(host), value => value === 'v3')).toBe('v3')
      expect(host.readyCount()).toBe(3)
      expect(host.errors).toEqual([])
    }, 25000)

    it('rebinds the same loopback Socket.IO port after a full managed rebuild', async () => {
      const host = await createHarness(adapter, true, false)
      const oldSocket = await connectSocket(host.socketPort!)
      expect(await socketVersion(oldSocket)).toBe('v1')
      host.setVersion('v2')
      host.triggerChange()
      // Socket.IO shutdown is required before reusing the same TCP port.
      // Bound this individual assertion to make a stuck teardown observable
      // instead of masking it behind Vitest's generic test timeout.
      expect(await until(async () => oldSocket.connected, value => value === false, 8000)).toBe(false)
      expect(await until(() => httpVersion(host), value => value === 'v2')).toBe('v2')
      const replacement = await connectSocket(host.socketPort!)
      expect(await socketVersion(replacement)).toBe('v2')
      expect(host.errors).toEqual([])
    }, 20000)
  })
}
