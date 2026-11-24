/**
 * P1-R3C: Feathers v5 genuine JWTs, server sessions, REST/Socket.IO.
 * In-memory sessions are deliberately test-only; production requires an atomic DB/Redis store.
 */
import { randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication'
import { Forbidden } from '@feathersjs/errors'
import { afterEach, describe, expect, it } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import { createFeathersRuntime, type FeathersRuntime } from '../src/app.js'
import { installFeathersServiceRbac } from '../src/security/feathers-rbac.js'
import { createFeathersJwtSessionController, MemoryJwtSessionStore, type SessionController } from '../src/security/feathers-jwt-sessions.js'
import type { FeathersApp, FeathersPluginOptions, ModuleNamespace } from '../src/types.js'

class PrivateUsersJwtStrategy extends JWTStrategy {
  override async getEntity(id: string, _params: Parameters<JWTStrategy['getEntity']>[1]) {
    // An authenticated internal lookup is not a public users.get API.
    return super.getEntity(id, {})
  }
}

const ORIGIN = 'http://127.0.0.1:9100'
const EDITOR = 'r3c-editor'
const ADMIN = 'r3c-admin'
type Role = 'editor' | 'admin'
type Account = { id: string; role: Role; enabled: boolean }
const servers: Server[] = []
const runtimes: FeathersRuntime[] = []
const sockets: Socket[] = []

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.disconnect()
  for (const runtime of runtimes.splice(0)) await runtime.close()
  for (const server of servers.splice(0)) {
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})

async function host(adapter: 'koa' | 'express') {
  const accounts = new Map<string, Account>([
    [EDITOR, { id: EDITOR, role: 'editor', enabled: true }],
    [ADMIN, { id: ADMIN, role: 'admin', enabled: true }],
  ])
  const authHolder: { current?: SessionController } = {}
  const load = async (): Promise<ModuleNamespace> => ({
    default(app: FeathersApp) {
      let seq = 0
      app.use('notes', {
        async find() { return [{ id: 0, title: 'public' }] },
        async create(data: { title: string }) { return { id: ++seq, title: data.title } },
        async remove(id: number) { return { id } },
      }, { methods: ['find', 'create', 'remove'] })
      app.use('users', {
        async get(id: string | number) {
          const account = accounts.get(String(id))
          if (!account?.enabled) throw new Forbidden('Forbidden')
          return { id: account.id }
        },
        async find() { throw new Forbidden('Forbidden') },
      }, { methods: ['get', 'find'] })
      app.service('users').hooks({ before: { all: [context => {
        if (context.params.provider) throw new Forbidden('Forbidden')
      }] } })
    },
  })
  const options: FeathersPluginOptions = {
    serviceFiles: 'notes', adapter, serviceRegistration: 'reject-duplicates',
    socketio: { mode: 'external', origins: [ORIGIN] },
    afterRegister(app) {
      app.set('authentication', {
        secret: randomBytes(48).toString('hex'), entity: 'user', service: 'users', entityId: 'id',
        authStrategies: ['jwt'], parseStrategies: ['jwt'],
        jwtOptions: { algorithm: 'HS256', issuer: 'r3c-local', audience: 'r3c-app', expiresIn: '2m' },
      })
      const native = new AuthenticationService(app)
      native.register('jwt', new PrivateUsersJwtStrategy())
      app.use('authentication', native)
      const sessions = new MemoryJwtSessionStore()
      const control = createFeathersJwtSessionController(native, sessions, async id => {
        const account = accounts.get(id)
        return account?.enabled ? { subject: account.id, roles: [account.role] } : null
      })
      authHolder.current = control
      installFeathersServiceRbac(app, 'notes', {
        notes: { find: 'public', create: { roles: ['editor'] }, remove: { roles: ['admin'] } },
      }, control.verify)
    },
  }
  const runtime = await createFeathersRuntime(['notes'], load, options)
  runtimes.push(runtime)
  const control = authHolder.current
  if (!control) throw new Error('Test session registration missing')
  const server = createServer((req, res) => runtime.handler(req, res, () => { res.statusCode = 404; res.end() }))
  servers.push(server)
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  await runtime.start(server)
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, accounts, control }
}

async function socketConnect(url: string, token: string): Promise<Socket> {
  const socket = io(url, { transports: ['websocket'], reconnection: false, timeout: 4000, extraHeaders: { origin: ORIGIN, authorization: `Bearer ${token}` } })
  sockets.push(socket)
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connection timeout')), 5000)
    socket.once('connect', () => { clearTimeout(timer); resolve() })
    socket.once('connect_error', error => { clearTimeout(timer); reject(error) })
  })
  return socket
}

async function rpc(socket: Socket, method: string, path: string, data: unknown): Promise<{ error: unknown; result: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket RPC timeout')), 5000)
    socket.emit(method, path, data, {}, (error: unknown, result: unknown) => {
      clearTimeout(timer)
      resolve({ error, result })
    })
  })
}

for (const adapter of ['koa', 'express'] as const) {
  describe(`P1-R3C ${adapter}`, () => {
    it('REST: native JWT session issuance, rotation, replay refusal, revoke and server roles', async () => {
      const { url, accounts, control } = await host(adapter)
      const original = await control.issueForTrustedSubject(EDITOR, 120)
      const post = (token: string) => fetch(`${url}/notes`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: 'session' }),
      })
      expect((await fetch(`${url}/users/${EDITOR}`)).status).toBe(403)
      expect((await post(original)).status).toBe(201)
      const rotated = await control.rotate(original, 120)
      expect((await post(original)).status).toBe(403)
      expect((await post(rotated)).status).toBe(201)
      await expect(control.rotate(original, 120)).rejects.toThrow('Session unavailable')
      expect(await control.revoke(rotated)).toBe(true)
      expect(await control.revoke(rotated)).toBe(false)
      expect((await post(rotated)).status).toBe(403)
      const again = await control.issueForTrustedSubject(EDITOR, 120)
      const account = accounts.get(EDITOR)
      if (!account) throw new Error('Missing account')
      account.enabled = false
      expect((await post(again)).status).toBe(403)
    })

    it('Socket.IO: session revocation blocks an existing connection, verified user roles reload', async () => {
      const { url, accounts, control } = await host(adapter)
      const token = await control.issueForTrustedSubject(EDITOR, 120)
      const socket = await socketConnect(url, token)
      const allowed = await rpc(socket, 'create', 'notes', { title: 'allowed' })
      expect(allowed.error).toBeNull()
      expect((await rpc(socket, 'remove', 'notes', 1)).error).toMatchObject({ code: 403 })
      const account = accounts.get(EDITOR)
      if (!account) throw new Error('Missing account')
      account.role = 'admin'
      expect((await rpc(socket, 'remove', 'notes', 1)).error).toBeNull()
      expect(await control.revokeSubject(EDITOR)).toBe(1)
      expect((await rpc(socket, 'create', 'notes', { title: 'replayed' })).error).toMatchObject({ code: 403 })
      await expect(control.rotate(token, 120)).rejects.toThrow('Session unavailable')
    })
  })
}
