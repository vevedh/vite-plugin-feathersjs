/**
 * P1-R2 transport test: REAL Feathers v5 REST + Socket.IO, Koa and Express,
 * on one host-owned loopback HTTP listener (the R10 external mode).
 * Authentication tokens are deliberately TEST STUBS: this certifies hook
 * wiring, not cryptographic JWT or an external identity provider.
 */
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import { createFeathersRuntime, type FeathersRuntime } from '../src/app.js'
import { installFeathersServiceRbac } from '../src/security/feathers-rbac.js'
import type { FeathersApp, FeathersPluginOptions, ModuleNamespace } from '../src/types.js'

const runtimes: FeathersRuntime[] = []
const hosts: Server[] = []
const clients: Socket[] = []
const ORIGIN = 'http://127.0.0.1:9100'
const EDITOR = 'fixture-editor-token'
const ADMIN = 'fixture-admin-token'

afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect()
  for (const runtime of runtimes.splice(0)) await runtime.close()
  for (const server of hosts.splice(0)) {
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})

function networkOptions(adapter: 'koa' | 'express'): FeathersPluginOptions {
  return {
    serviceFiles: 'notes', adapter, serviceRegistration: 'reject-duplicates',
    socketio: { mode: 'external', origins: [ORIGIN] },
    afterRegister(app) {
      installFeathersServiceRbac(app, 'notes', {
        notes: {
          find: 'public',
          create: { roles: ['editor'] },
          remove: { roles: ['admin'] },
        },
      }, async token => {
        // The STUB only exercises service hook wiring; never use this in production.
        if (token === EDITOR) return { subject: 'fixture-user-1', roles: ['editor'] }
        if (token === ADMIN) return { subject: 'fixture-user-2', roles: ['admin'] }
        return null
      })
    },
  }
}

async function startHost(adapter: 'koa' | 'express'): Promise<string> {
  const load = async (): Promise<ModuleNamespace> => ({
    default(app: FeathersApp) {
      let seq = 0
      app.use('notes', {
        async find() { return [{ id: 0, title: 'public' }] },
        async create(data: { title: string }) {
          return { id: ++seq, title: data.title }
        },
        async remove(id: number) { return { id } },
      }, { methods: ['find', 'create', 'remove'] })
    },
  })
  const runtime = await createFeathersRuntime(['notes'], load, networkOptions(adapter))
  runtimes.push(runtime)
  const server = createServer((request, response) => runtime.handler(request, response, () => {
    response.statusCode = 404
    response.end()
  }))
  hosts.push(server)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  await runtime.start(server)
  await runtime.start(server) // no duplicated hook or socket setup
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

async function connect(address: string, accessToken: string | null): Promise<Socket> {
  const headers: Record<string, string> = { origin: ORIGIN }
  if (accessToken) headers.authorization = `Bearer ${accessToken}`
  const client = io(address, {
    transports: ['websocket'], reconnection: false, timeout: 4000,
    extraHeaders: headers,
  })
  clients.push(client)
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connection deadline')), 5000)
    client.once('connect', () => { clearTimeout(timer); resolve() })
    client.once('connect_error', err => { clearTimeout(timer); reject(err) })
  })
  return client
}

function rpc(socket: Socket, method: string, path: string, data: unknown, query: unknown): Promise<{ error: unknown; result: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket RPC deadline')), 5000)
    // Feathers Socket.IO service methods use error-first ACK; do not use
    // socket.timeout().emit(), which prepends another acknowledgement error.
    socket.emit(method, path, data, query, (error: unknown, result: unknown) => {
      clearTimeout(timer)
      resolve({ error, result })
    })
  })
}

for (const adapter of ['koa', 'express'] as const) {
  describe(`P1-R2 ${adapter} RBAC on R10 shared HTTP listener`, () => {
    it('denies forged REST identities and allows only server-verified roles', async () => {
      const url = await startHost(adapter)
      expect((await fetch(`${url}/notes`)).status).toBe(200)
      const post = (authorization?: string) => fetch(`${url}/notes`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(authorization ? { authorization } : {}),
        },
        body: JSON.stringify({ title: 'network-check', user: { roles: ['admin'] }, roles: ['editor'] }),
      })
      expect((await post()).status).toBe(403)
      expect((await post('Bearer incorrect-token')).status).toBe(403)
      const allowed = await post(`Bearer ${EDITOR}`)
      expect(allowed.status).toBe(201)
      expect(await allowed.json()).toMatchObject({ title: 'network-check' })
      expect((await fetch(`${url}/notes/1`, { method: 'DELETE', headers: { authorization: `Bearer ${EDITOR}` } })).status).toBe(403)
    })
    it('denies unauthenticated Socket.IO and authorizes verified peer without trusting query roles', async () => {
      const url = await startHost(adapter)
      const guest = await connect(url, null)
      const editor = await connect(url, EDITOR)
      const bad = await rpc(guest, 'create', 'notes', { title: 'forged' }, { roles: ['admin', 'editor'], principal: { roles: ['admin'] } })
      expect(bad.error).toMatchObject({ code: 403 })
      const granted = await rpc(editor, 'create', 'notes', { title: 'editor' }, { roles: ['admin'] })
      expect(granted.error).toBeNull()
      expect(granted.result).toMatchObject({ title: 'editor' })
      const denied = await rpc(editor, 'remove', 'notes', 1, { roles: ['admin'] })
      expect(denied.error).toMatchObject({ code: 403 })
      const admin = await connect(url, ADMIN)
      const removed = await rpc(admin, 'remove', 'notes', 1, {})
      expect(removed.error).toBeNull()
      expect(removed.result).toMatchObject({ id: 1 })
    })
  })
}
