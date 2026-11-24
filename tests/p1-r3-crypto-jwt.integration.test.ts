/**
 * P1-R3A: REAL HMAC-SHA256-signed JWTs over real Feathers v5 REST and Socket.IO.
 * Uses a TEST-ONLY cryptographic authentication service backed by node:crypto.
 * Not an @feathersjs/authentication AuthenticationService/JWTStrategy certification.
 * No production authentication code is installed by this test.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import { createFeathersRuntime, type FeathersRuntime } from '../src/app.js'
import { createFeathersJwtVerifier, installFeathersServiceRbac } from '../src/security/feathers-rbac.js'
import type { FeathersApp, FeathersPluginOptions, ModuleNamespace } from '../src/types.js'

const ORIGIN = 'http://127.0.0.1:9100'
const ISSUER = 'p1-r3a-crypto-fixture'
const AUDIENCE = 'p1-r3a-loopback'
const EDITOR = 'fixture-editor'
const ADMIN = 'fixture-admin'

type Role = 'editor' | 'admin'
type Account = { readonly id: string; role: Role; active: boolean; sessionVersion: number }
type Claims = { readonly sub: string; readonly iss: string; readonly aud: string; readonly iat: number; readonly nbf: number; readonly exp: number; readonly sessionVersion: number; readonly roles?: readonly string[] }
type TokenOverrides = Partial<Pick<Claims, 'iss' | 'aud' | 'iat' | 'nbf' | 'exp' | 'sessionVersion' | 'roles'>>
const runtimes: FeathersRuntime[] = []
const servers: Server[] = []
const sockets: Socket[] = []

afterEach(async () => {
  for (const client of sockets.splice(0)) client.disconnect()
  for (const runtime of runtimes.splice(0)) await runtime.close()
  for (const server of servers.splice(0)) {
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  }
})

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function signedFixture(key: Buffer, account: Account, overrides: TokenOverrides = {}): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: Claims = {
    sub: account.id, iss: ISSUER, aud: AUDIENCE,
    iat: now, nbf: now, exp: now + 120,
    sessionVersion: account.sessionVersion, ...overrides,
  }
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const input = `${head}.${body}`
  const signature = createHmac('sha256', key).update(input).digest('base64url')
  return `${input}.${signature}`
}

/** Test-only cryptographic service. Rejects untrusted claims and rotates nothing on its own. */
function createJwtFixtureService(key: Buffer, accounts: Map<string, Account>) {
  return {
    async authenticate(data: { strategy: 'jwt'; accessToken: string }, _params: object, _strategy: 'jwt'): Promise<unknown> {
      if (data.strategy !== 'jwt' || typeof data.accessToken !== 'string' || data.accessToken.length > 8192) throw Error('Unauthorized')
      const segments = data.accessToken.split('.')
      if (segments.length !== 3) throw Error('Unauthorized')
      const [encodedHeader, encodedPayload, encodedSignature] = segments
      if (!encodedHeader || !encodedPayload || !encodedSignature ||
          encodedHeader.length > 256 || encodedPayload.length > 4096 || encodedSignature.length > 128 ||
          !segments.every(segment => /^[A-Za-z0-9_-]+$/.test(segment))) throw Error('Unauthorized')
      const expected = createHmac('sha256', key).update(`${encodedHeader}.${encodedPayload}`).digest()
      const actual = Buffer.from(encodedSignature, 'base64url')
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw Error('Unauthorized')
      const header: unknown = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'))
      const payload: unknown = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
      if (!record(header) || header.alg !== 'HS256' || header.typ !== 'JWT' || !record(payload)) throw Error('Unauthorized')
      const now = Math.floor(Date.now() / 1000)
      const { sub, iss, aud, iat, nbf, exp, sessionVersion } = payload
      if (typeof sub !== 'string' || sub.length < 1 || sub.length > 128 || iss !== ISSUER || aud !== AUDIENCE ||
          typeof iat !== 'number' || !Number.isSafeInteger(iat) || iat > now + 5 ||
          typeof nbf !== 'number' || !Number.isSafeInteger(nbf) || nbf > now ||
          typeof exp !== 'number' || !Number.isSafeInteger(exp) || exp <= now || exp <= iat ||
          typeof sessionVersion !== 'number' || !Number.isSafeInteger(sessionVersion)) throw Error('Unauthorized')
      const account = accounts.get(sub)
      if (!account || !account.active || account.sessionVersion !== sessionVersion) throw Error('Unauthorized')
      // Token-carried roles are intentionally NOT accepted.
      return { user: { id: account.id } }
    },
  }
}

async function startHost(adapter: 'koa' | 'express'): Promise<{
  readonly address: string
  readonly accounts: Map<string, Account>
  readonly mint: (who: string, overrides?: TokenOverrides) => string
}> {
  const key = randomBytes(64)
  const accounts = new Map<string, Account>([
    [EDITOR, { id: EDITOR, role: 'editor', active: true, sessionVersion: 1 }],
    [ADMIN, { id: ADMIN, role: 'admin', active: true, sessionVersion: 1 }],
  ])
  const auth = createJwtFixtureService(key, accounts)
  const load = async (): Promise<ModuleNamespace> => ({
    default(app: FeathersApp) {
      let nextId = 0
      app.use('notes', {
        async find() { return [{ id: 0, title: 'public' }] },
        async create(data: { title: string }) { return { id: ++nextId, title: data.title } },
        async remove(id: number) { return { id } },
      }, { methods: ['find', 'create', 'remove'] })
    },
  })
  const options: FeathersPluginOptions = {
    serviceFiles: 'notes', adapter, serviceRegistration: 'reject-duplicates',
    socketio: { mode: 'external', origins: [ORIGIN] },
    afterRegister(app) {
      installFeathersServiceRbac(app, 'notes', {
        notes: { find: 'public', create: { roles: ['editor'] }, remove: { roles: ['admin'] } },
      }, createFeathersJwtVerifier(auth, async id => {
        const account = accounts.get(id)
        return account?.active ? { subject: account.id, roles: [account.role] } : null
      }))
    },
  }
  const runtime = await createFeathersRuntime(['notes'], load, options)
  runtimes.push(runtime)
  const server = createServer((req, res) => runtime.handler(req, res, () => { res.statusCode = 404; res.end() }))
  servers.push(server)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  await runtime.start(server)
  return {
    address: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    accounts,
    mint(who: string, overrides?: TokenOverrides): string {
      const account = accounts.get(who)
      if (!account) throw Error('Unknown fixture account')
      return signedFixture(key, account, overrides)
    },
  }
}

async function socketConnect(address: string, token: string | null): Promise<Socket> {
  const headers: Record<string, string> = { origin: ORIGIN }
  if (token) headers.authorization = `Bearer ${token}`
  const client = io(address, { transports: ['websocket'], reconnection: false, timeout: 4000, extraHeaders: headers })
  sockets.push(client)
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Socket connection deadline')), 5000)
    client.once('connect', () => { clearTimeout(timeout); resolve() })
    client.once('connect_error', error => { clearTimeout(timeout); reject(error) })
  })
  return client
}

async function rpc(socket: Socket, method: string, path: string, data: unknown, query: unknown): Promise<{ readonly error: unknown; readonly result: unknown }> {
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Socket RPC deadline')), 5000)
    socket.emit(method, path, data, query, (error: unknown, result: unknown) => {
      clearTimeout(timeout)
      resolve({ error, result })
    })
  })
}

for (const adapter of ['koa', 'express'] as const) {
  describe(`P1-R3A ${adapter}: signed JWT on real Feathers transports`, () => {
    it('REST: verifies signature/scope/expiry and never trusts forged roles', async () => {
      const fixture = await startHost(adapter)
      const post = (authorization?: string) => fetch(`${fixture.address}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
        body: JSON.stringify({ title: 'jwt-crypto', roles: ['admin'] }),
      })
      expect((await fetch(`${fixture.address}/notes`)).status).toBe(200)
      expect((await post()).status).toBe(403)
      const valid = fixture.mint(EDITOR, { roles: ['admin'] })
      expect((await post(`Bearer ${valid}`)).status).toBe(201)
      const sections = valid.split('.')
      expect((await post(`Bearer ${sections[0]}.${sections[1]}.invalidsignature`)).status).toBe(403)
      expect((await post(`Bearer ${fixture.mint(EDITOR, { iss: 'wrong-issuer' })}`)).status).toBe(403)
      expect((await post(`Bearer ${fixture.mint(EDITOR, { aud: 'wrong-audience' })}`)).status).toBe(403)
      expect((await post(`Bearer ${fixture.mint(EDITOR, { exp: Math.floor(Date.now() / 1000) - 1 })}`)).status).toBe(403)
      expect((await post(`Bearer ${fixture.mint(EDITOR, { nbf: Math.floor(Date.now() / 1000) + 3600 })}`)).status).toBe(403)
      expect((await fetch(`${fixture.address}/notes/1`, { method: 'DELETE', headers: { authorization: `Bearer ${valid}` } })).status).toBe(403)
    })

    it('Socket.IO: revalidates roles, disable and session version per request', async () => {
      const fixture = await startHost(adapter)
      const guest = await socketConnect(fixture.address, null)
      const editorToken = fixture.mint(EDITOR, { roles: ['admin'] })
      const editor = await socketConnect(fixture.address, editorToken)
      const forged = await rpc(guest, 'create', 'notes', { title: 'forged' }, { roles: ['editor'] })
      expect(forged.error).toMatchObject({ code: 403 })
      const created = await rpc(editor, 'create', 'notes', { title: 'accepted' }, { roles: ['admin'] })
      expect(created.error).toBeNull()
      expect(created.result).toMatchObject({ title: 'accepted' })
      const denied = await rpc(editor, 'remove', 'notes', 1, { roles: ['admin'] })
      expect(denied.error).toMatchObject({ code: 403 })
      const admin = await socketConnect(fixture.address, fixture.mint(ADMIN))
      const removed = await rpc(admin, 'remove', 'notes', 1, {})
      expect(removed.error).toBeNull()
      const revoked = fixture.accounts.get(EDITOR)
      if (!revoked) throw Error('Missing fixture')
      revoked.sessionVersion++
      const expired = await rpc(editor, 'create', 'notes', { title: 'revoked' }, {})
      expect(expired.error).toMatchObject({ code: 403 })
      const refreshed = await socketConnect(fixture.address, fixture.mint(EDITOR))
      expect((await rpc(refreshed, 'create', 'notes', { title: 'restored' }, {})).error).toBeNull()
      // Fresh server roles affect the very next call, without a new token.
      revoked.role = 'admin'
      expect((await rpc(refreshed, 'create', 'notes', { title: 'old-role' }, {})).error).toMatchObject({ code: 403 })
      expect((await rpc(refreshed, 'remove', 'notes', 1, {})).error).toBeNull()
      revoked.active = false
      expect((await rpc(refreshed, 'remove', 'notes', 1, {})).error).toMatchObject({ code: 403 })
    })
  })
}
