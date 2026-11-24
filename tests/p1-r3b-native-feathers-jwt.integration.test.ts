/**
 * P1-R3B: Feathers v5's real AuthenticationService + JWTStrategy, not a JWT fixture.
 * Local-only test of Koa/Express and REST/Socket.IO. No production registration.
 * `createAccessToken` is called ONLY by the test host; clients cannot mint tokens.
 * Per-session revocation is explicitly OUT OF SCOPE (R3C).
 */
import { randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication'
import { Forbidden } from '@feathersjs/errors'
import { afterEach, describe, expect, it } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import { createFeathersRuntime, type FeathersRuntime } from '../src/app.js'
import { createFeathersJwtVerifier, installFeathersServiceRbac } from '../src/security/feathers-rbac.js'
import type { FeathersApp, FeathersPluginOptions, ModuleNamespace } from '../src/types.js'

/**
 * Private `users` is never directly exposed through REST or Socket.IO.
 * Feathers JWTStrategy otherwise performs a second entity lookup with the
 * network `provider`, which the private service intentionally rejects.
 * The JWT is still verified by the native Feathers authentication service.
 */
class PrivateUsersJwtStrategy extends JWTStrategy {
  override async getEntity(id: string, _params: Parameters<JWTStrategy['getEntity']>[1]) {
    return super.getEntity(id, {})
  }
}

const ORIGIN = 'http://127.0.0.1:9100'
const ISSUER = 'p1-r3b-native-fixture'
const AUDIENCE = 'p1-r3b-local'
const EDITOR = 'fixture-editor'
const ADMIN = 'fixture-admin'

type Role = 'editor' | 'admin'
type Account = { readonly id: string; role: Role; enabled: boolean }
const runtimes: FeathersRuntime[] = []
const hosts: Server[] = []
const clients: Socket[] = []

afterEach(async () => {
  for (const socket of clients.splice(0)) socket.disconnect()
  for (const runtime of runtimes.splice(0)) await runtime.close()
  for (const server of hosts.splice(0)) {
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})

async function startHost(adapter: 'koa' | 'express'): Promise<{
  readonly address: string
  readonly auth: AuthenticationService
  readonly accounts: Map<string, Account>
  readonly mint: (subject: string, payload?: Record<string, unknown>, options?: Parameters<AuthenticationService['createAccessToken']>[1]) => Promise<string>
}> {
  const accounts = new Map<string, Account>([
    [EDITOR, { id: EDITOR, role: 'editor', enabled: true }],
    [ADMIN, { id: ADMIN, role: 'admin', enabled: true }],
  ])
  const holder: { value?: AuthenticationService } = {}
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
          if (!account || !account.enabled) throw new Forbidden('Forbidden')
          // Only id leaves the service, never server-side roles or session state.
          return { id: account.id }
        },
        async find() { throw new Forbidden('Forbidden') },
      }, { methods: ['get', 'find'] })
      // The user lookup is a private service, INCLUDING on real network transport.
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
        secret: randomBytes(48).toString('hex'),
        entity: 'user', service: 'users', entityId: 'id', authStrategies: ['jwt'], parseStrategies: ['jwt'],
        jwtOptions: { algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE, expiresIn: '2m' },
      })
      const service = new AuthenticationService(app)
      service.register('jwt', new PrivateUsersJwtStrategy())
      app.use('authentication', service)
      holder.value = service
      installFeathersServiceRbac(app, 'notes', {
        notes: { find: 'public', create: { roles: ['editor'] }, remove: { roles: ['admin'] } },
      }, createFeathersJwtVerifier(service, async id => {
        const account = accounts.get(id)
        return account?.enabled ? { subject: account.id, roles: [account.role] } : null
      }))
    },
  }
  const runtime = await createFeathersRuntime(['notes'], load, options)
  runtimes.push(runtime)
  const nativeAuth = holder.value
  if (!nativeAuth) throw new Error('Authentication service registration missing')
  const server = createServer((req, res) => runtime.handler(req, res, () => { res.statusCode = 404; res.end() }))
  hosts.push(server)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  await runtime.start(server)
  return {
    address: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    auth: nativeAuth,
    accounts,
    mint(subject, payload = {}, options) {
      // This is ONLY a test host action. NEVER expose createAccessToken over HTTP.
      return nativeAuth.createAccessToken({ sub: subject, ...payload }, options)
    },
  }
}

async function socketConnect(address: string, token: string | null): Promise<Socket> {
  const headers: Record<string, string> = { origin: ORIGIN }
  if (token) headers.authorization = `Bearer ${token}`
  const socket = io(address, { transports: ['websocket'], reconnection: false, timeout: 4000, extraHeaders: headers })
  clients.push(socket)
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connection deadline')), 5000)
    socket.once('connect', () => { clearTimeout(timer); resolve() })
    socket.once('connect_error', error => { clearTimeout(timer); reject(error) })
  })
  return socket
}

function rpc(socket: Socket, method: string, path: string, data: unknown, query: unknown): Promise<{ readonly error: unknown; readonly result: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket RPC deadline')), 5000)
    socket.emit(method, path, data, query, (error: unknown, result: unknown) => {
      clearTimeout(timer)
      resolve({ error, result })
    })
  })
}

for (const adapter of ['koa', 'express'] as const) {
  describe(`P1-R3B native Feathers v5 JWT ${adapter}`, () => {
    it('REST: native token issuance/verification, scoped claims, private users, RBAC', async () => {
      const fixture = await startHost(adapter)
      const editorToken = await fixture.mint(EDITOR, { roles: ['admin'] })
      const post = (token?: string) => fetch(`${fixture.address}/notes`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ title: 'native-jwt', roles: ['admin'] }),
      })
      expect((await fetch(`${fixture.address}/notes`)).status).toBe(200)
      expect((await fetch(`${fixture.address}/users/${EDITOR}`)).status).toBe(403)
      expect((await post()).status).toBe(403)
      expect((await post(editorToken)).status).toBe(201)
      const nativeLogin = await fetch(`${fixture.address}/authentication`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ strategy: 'jwt', accessToken: editorToken }),
      })
      expect(nativeLogin.status).toBe(201)
      expect(await nativeLogin.json()).toMatchObject({ accessToken: editorToken })
      const parts = editorToken.split('.')
      expect((await post(`${parts[0]}.${parts[1]}.tampered`)).status).toBe(403)
      expect((await post(await fixture.mint(EDITOR, {}, { expiresIn: -15 }))).status).toBe(403)
      expect((await post(await fixture.mint(EDITOR, {}, { audience: 'wrong-audience' }))).status).toBe(403)
      expect((await post(await fixture.mint(EDITOR, {}, { issuer: 'wrong-issuer' }))).status).toBe(403)
      expect((await post(await fixture.mint(EDITOR, { nbf: Math.floor(Date.now() / 1000) + 3600 }))).status).toBe(403)
      expect((await fetch(`${fixture.address}/notes/1`, { method: 'DELETE', headers: { authorization: `Bearer ${editorToken}` } })).status).toBe(403)
      const account = fixture.accounts.get(EDITOR)
      if (!account) throw Error('Fixture account missing')
      account.enabled = false
      expect((await post(editorToken)).status).toBe(403)
    })

    it('Socket.IO: native JWT, no forged roles, dynamic server roles and account disable', async () => {
      const fixture = await startHost(adapter)
      const editorToken = await fixture.mint(EDITOR, { roles: ['admin'] })
      const guest = await socketConnect(fixture.address, null)
      const editor = await socketConnect(fixture.address, editorToken)
      expect((await rpc(guest, 'create', 'notes', { title: 'forged' }, { roles: ['editor'] })).error).toMatchObject({ code: 403 })
      expect((await rpc(guest, 'get', 'users', EDITOR, {})).error).toMatchObject({ code: 403 })
      const allowed = await rpc(editor, 'create', 'notes', { title: 'allowed' }, { roles: ['admin'] })
      expect(allowed.error).toBeNull()
      expect(allowed.result).toMatchObject({ title: 'allowed' })
      expect((await rpc(editor, 'remove', 'notes', 1, { roles: ['admin'] })).error).toMatchObject({ code: 403 })
      const account = fixture.accounts.get(EDITOR)
      if (!account) throw Error('Fixture account missing')
      account.role = 'admin'
      expect((await rpc(editor, 'remove', 'notes', 1, {})).error).toBeNull()
      account.enabled = false
      expect((await rpc(editor, 'create', 'notes', { title: 'disabled' }, {})).error).toMatchObject({ code: 403 })
      const admin = await socketConnect(fixture.address, await fixture.mint(ADMIN))
      expect((await rpc(admin, 'create', 'notes', { title: 'no-role' }, {})).error).toMatchObject({ code: 403 })
    })
  })
}
