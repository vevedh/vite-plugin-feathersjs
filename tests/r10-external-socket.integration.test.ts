import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import { createFeathersRuntime, createManagedFeathersRuntime, type FeathersRuntime } from '../src/app.js'
import { validateOptions } from '../src/options.js'
import feathersPlugin from '../src/index.js'
import type { FeathersPluginOptions, ModuleNamespace } from '../src/types.js'

const runtimes: FeathersRuntime[] = []
const servers: Server[] = []
const sockets: Socket[] = []
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect()
  for (const runtime of runtimes.splice(0)) await runtime.close()
  for (const server of servers.splice(0)) {
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})
const options = (adapter: 'koa' | 'express'): FeathersPluginOptions => ({
  serviceFiles: 'notes', adapter,
  socketio: { mode: 'external', origins: ['http://127.0.0.1:9100'] },
})
function connect(address: string): Promise<Socket> {
  const socket = io(address, {
    transports: ['websocket'], reconnection: false, timeout: 4000,
    extraHeaders: { origin: 'http://127.0.0.1:9100' },
  })
  sockets.push(socket)
  return new Promise<Socket>((resolve, reject) => {
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', reject)
  })
}
function create(socket: Socket, title: string): Promise<{ id: number; title: string }> {
  return new Promise((resolve, reject) => {
    // Socket.IO timeout prepends timeoutError to Feathers' (serviceError, data) ACK.
    socket.timeout(4000).emit('create', 'notes', { title }, (timeoutError: Error | null, serviceError: unknown, result: unknown) => {
      if (timeoutError) return reject(timeoutError)
      if (serviceError != null) return reject(serviceError)
      if (typeof result !== 'object' || result === null || !('id' in result) || !('title' in result) ||
          typeof result.id !== 'number' || typeof result.title !== 'string') {
        return reject(new Error('Invalid Feathers create acknowledgement'))
      }
      resolve({ id: result.id, title: result.title })
    })
  })
}
for (const adapter of ['koa', 'express'] as const) {
  describe(`R10-R3 external Socket.IO ${adapter}`, () => {
    it('rejects absent host and provides real REST + 2-client Socket.IO on one listener', async () => {
      const runtime = await createFeathersRuntime(
        ['notes'],
        async () => vi.importActual<ModuleNamespace>('../examples/basic/server/services/notes/notes.service.ts'),
        options(adapter),
      )
      runtimes.push(runtime)
      await expect(runtime.start()).rejects.toThrow(/listening Node HTTP server/)
      const server = createServer((req, res) => runtime.handler(req, res, () => { res.statusCode = 404; res.end() }))
      servers.push(server)
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      const port = (server.address() as AddressInfo).port
      await runtime.start(server)
      await runtime.start(server) // An idempotent second call must not duplicate event publishers.
      const address = `http://127.0.0.1:${port}`
      expect((await fetch(`${address}/notes`)).status).toBe(200)
      const a = await connect(address)
      const b = await connect(address)
      const receivedA: Array<{ id: number; title: string }> = []
      const receivedB: Array<{ id: number; title: string }> = []
      a.on('notes created', (item: { id: number; title: string }) => receivedA.push(item))
      b.on('notes created', (item: { id: number; title: string }) => receivedB.push(item))
      const created = await create(a, 'R10-R3 single listener')
      expect(created.title).toBe('R10-R3 single listener')
      await vi.waitFor(() => { expect(receivedA).toHaveLength(1); expect(receivedB).toHaveLength(1) }, { timeout: 4000, interval: 100 })
      expect(receivedB[0]?.id).toBe(created.id)
      await new Promise(resolve => setTimeout(resolve, 250))
      expect(receivedA).toHaveLength(1)
      expect(receivedB).toHaveLength(1)
      await runtime.close()
      runtimes.splice(runtimes.indexOf(runtime), 1)
      // In external mode, Feathers closes its Socket.IO transport but must not
      // close the HTTP listener: it belongs to the host (Quasar in R10-R3-R2).
      await vi.waitFor(() => {
        expect(a.connected).toBe(false)
        expect(b.connected).toBe(false)
      }, { timeout: 4000, interval: 100 })
      expect(server.listening).toBe(true)
      // The host explicitly closes its own HTTP listener after Feathers teardown.
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve())
      })
      expect(server.listening).toBe(false)
    })
  })
}
describe('R10-R3 external mode must fail closed', () => {
  it('rejects mixed transport ownership and Vite direct usage', () => {
    expect(() => validateOptions(options('express'))).not.toThrow()
    const mixed = { mode: 'external', origins: ['http://127.0.0.1:9100'], port: 3031 }
    expect(() => validateOptions({ ...options('express'), socketio: mixed as Exclude<FeathersPluginOptions['socketio'], undefined> })).toThrow(/forbids port and host/)
    expect(() => feathersPlugin(options('koa'))).toThrow(/host-owned/)
  })
  it('rejects unsupported managed external mode', async () => {
    await expect(createManagedFeathersRuntime([], async () => ({}), options('koa'))).rejects.toThrow(/host-owned/)
  })
})
