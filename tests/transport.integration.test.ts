import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import { createFeathersRuntime, type FeathersRuntime } from '../src/app.js'
import type { FeathersApp, FeathersPluginOptions, ModuleNamespace } from '../src/types.js'

const openServers: Server[] = []
const openSockets: Socket[] = []
const openRuntimes: FeathersRuntime[] = []
afterEach(async () => {
  for (const socket of openSockets.splice(0)) socket.disconnect()
  for (const runtime of openRuntimes.splice(0)) await runtime.close()
  for (const server of openServers.splice(0)) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
})

function register(app: FeathersApp): void {
  const records = new Map<number, { id: number; text: string }>()
  let nextId = 0
  app.use('notes', {
    async find() { return [...records.values()] },
    async get(id: number) { const item = records.get(Number(id)); if (!item) throw new Error('Missing item'); return item },
    async create(data: { text: string }) { const item = { id: ++nextId, text: data.text }; records.set(item.id, item); return item },
    async patch(id: number, data: { text?: string }) { const item = records.get(Number(id)); if (!item) throw new Error('Missing item'); Object.assign(item, data); return item },
    async remove(id: number) { const item = records.get(Number(id)); if (!item) throw new Error('Missing item'); records.delete(Number(id)); return item },
  })
}

async function runtime(options: Partial<FeathersPluginOptions>): Promise<FeathersRuntime> {
  const value = await createFeathersRuntime(['notes'], async () => ({ default: register }), { serviceFiles: 'notes', ...options })
  openRuntimes.push(value)
  return value
}

for (const adapter of ['koa', 'express'] as const) {
  describe(`${adapter} live transports`, () => {
    it('serves REST CRUD through the actual middleware', async () => {
      const value = await runtime({ adapter })
      await value.start()
      const server = createServer((req, res) => value.handler(req, res, () => { res.statusCode = 404; res.end() }))
      openServers.push(server)
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      const port = (server.address() as AddressInfo).port
      const base = `http://127.0.0.1:${port}/notes`
      const request = (path: string, method = 'GET', data?: unknown) => fetch(base + path, { method, ...(data === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }) })
      const created = await request('', 'POST', { text: 'safe' })
      expect(created.status).toBe(201)
      const item = await created.json() as { id: number; text: string }
      expect(item.text).toBe('safe')
      expect((await (await request(`/${item.id}`)).json() as { text: string }).text).toBe('safe')
      expect((await (await request(`/${item.id}`, 'PATCH', { text: 'updated' })).json() as { text: string }).text).toBe('updated')
      expect(await (await request('')).json()).toEqual([{ id: item.id, text: 'updated' }])
      expect((await request(`/${item.id}`, 'DELETE')).ok).toBe(true)
      expect(await (await request('')).json()).toEqual([])
    })

    it('uses a dedicated loopback-bound Socket.IO server when host is configured', async () => {
      const temporary = createServer()
      await new Promise<void>(resolve => temporary.listen(0, '127.0.0.1', resolve))
      const port = (temporary.address() as AddressInfo).port
      await new Promise<void>(resolve => temporary.close(() => resolve()))
      const value = await runtime({ adapter, socketio: { port, host: '127.0.0.1', origins: ['http://127.0.0.1:8080'] } })
      await value.start()
      const socket = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false, timeout: 3000 })
      openSockets.push(socket)
      await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject) })
      const created = await new Promise<{ id: number; text: string }>((resolve, reject) => {
        socket.emit('create', 'notes', { text: 'loopback' }, (error: unknown, data: { id: number; text: string }) => error ? reject(error) : resolve(data))
      })
      expect(created.text).toBe('loopback')
      // The transport is functional when bound to 127.0.0.1.
    })

    it('supports Socket.IO Feathers service calls', async () => {
      // Reserve a free ephemeral port, then release it for Feathers.listen().
      const temporary = createServer()
      await new Promise<void>(resolve => temporary.listen(0, '127.0.0.1', resolve))
      const port = (temporary.address() as AddressInfo).port
      await new Promise<void>((resolve, reject) => temporary.close(error => error ? reject(error) : resolve()))
      const value = await runtime({ adapter, socketio: { port, origins: ['http://localhost:5173'] } })
      await value.start()
      const socket = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false, timeout: 3000, extraHeaders: { origin: 'http://localhost:5173' } })
      openSockets.push(socket)
      await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject) })
      const result = await new Promise<unknown>((resolve, reject) => {
        socket.emit('create', 'notes', { text: 'socket' }, (error: unknown, data: unknown) => error ? reject(error) : resolve(data))
      })
      expect(result).toMatchObject({ id: 1, text: 'socket' })
    })
  })
}

for (const adapter of ['koa', 'express'] as const) {
  describe(`${adapter} demo notes publisher regression`, () => {
    it('registers service.publish before startup and broadcasts created events', async () => {
      const temporary = createServer()
      await new Promise<void>(resolve => temporary.listen(0, '127.0.0.1', resolve))
      const port = (temporary.address() as AddressInfo).port
      await new Promise<void>((resolve, reject) => temporary.close(error => error ? reject(error) : resolve()))
      const value = await createFeathersRuntime(
        ['demo-notes'],
        async () => vi.importActual<ModuleNamespace>('../examples/basic/server/services/notes/notes.service.ts'),
        { serviceFiles: 'demo-notes', adapter, socketio: { port, origins: ['http://localhost:5173'] } },
      )
      openRuntimes.push(value)
      await value.start()
      const socket = io(`http://127.0.0.1:${port}`, {
        transports: ['websocket'], reconnection: false, timeout: 3000,
        extraHeaders: { origin: 'http://localhost:5173' },
      })
      openSockets.push(socket)
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve)
        socket.once('connect_error', reject)
      })
      const received = new Promise<{ id: number; title: string }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Missing created event')), 2500)
        socket.once('notes created', (note: { id: number; title: string }) => {
          clearTimeout(timeout)
          resolve(note)
        })
      })
      const created = await new Promise<{ id: number; title: string }>((resolve, reject) => {
        socket.emit('create', 'notes', { title: 'realtime proof' }, (error: unknown, result: { id: number; title: string }) => {
          if (error) reject(error)
          else resolve(result)
        })
      })
      expect(created.title).toBe('realtime proof')
      expect(await received).toMatchObject({ id: created.id, title: 'realtime proof' })
    })
  })
}

// Regression: demo notes must load successfully with Socket.IO completely disabled.
// The REST-only modes previously failed at startup with "service.publish is not a function".
for (const adapter of ['koa', 'express'] as const) {
  describe(`${adapter} Vitesse REST-only notes regression`, () => {
    it('starts health and notes without Socket.IO, with REST CRUD functional', async () => {
      const value = await createFeathersRuntime(
        ['health', 'notes'],
        async (file) => file === 'health'
          ? vi.importActual<ModuleNamespace>('../examples/basic/server/services/health/health.service.ts')
          : vi.importActual<ModuleNamespace>('../examples/basic/server/services/notes/notes.service.ts'),
        { serviceFiles: 'server/**/*.ts', adapter, socketio: false },
      )
      openRuntimes.push(value)
      await value.start()
      const server = createServer((req, res) => value.handler(req, res, () => {
        res.statusCode = 404
        res.end()
      }))
      openServers.push(server)
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      const port = (server.address() as AddressInfo).port
      const base = `http://127.0.0.1:${port}`
      const health = await fetch(`${base}/health`)
      expect(health.status).toBe(200)
      expect(await health.json()).toMatchObject({ status: 'ok' })
      const notes = await fetch(`${base}/notes`)
      expect(notes.status).toBe(200)
      expect(await notes.json()).toMatchObject([{ id: 1, title: 'Hello from FeathersJS v5' }])
      const created = await fetch(`${base}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'REST-only proof' }),
      })
      expect(created.status).toBe(201)
      const note = await created.json() as { id: number; title: string }
      expect(note.title).toBe('REST-only proof')
      const patched = await fetch(`${base}/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Updated over REST' }),
      })
      expect(patched.status).toBe(200)
      expect(await patched.json()).toMatchObject({ title: 'Updated over REST' })
      const removed = await fetch(`${base}/notes/${note.id}`, { method: 'DELETE' })
      expect(removed.status).toBe(200)
    })
  })
}
