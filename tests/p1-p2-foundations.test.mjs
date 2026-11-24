import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const moduleAt = async relative => import(pathToFileURL(resolve(moduleRoot, relative)).href)
const { createRbacAuthorizer, RbacForbiddenError, RbacConfigurationError } = await moduleAt('security/rbac-policy.js')
const { createTrustedRbacBoundary } = await moduleAt('security/trusted-rbac.js')
const { ProviderRegistry, ProviderLifecycleError, ProviderConfigurationError } = await moduleAt('resources/provider-registry.js')
const denied = promise => assert.rejects(promise, e => e instanceof RbacForbiddenError && e.code === 403 && e.message === 'Forbidden')
const p = { notes: { find: 'public', get: 'authenticated', create: { roles: ['editor'] }, remove: { roles: ['admin'] } } }

test('P1: public and denied defaults; untrusted network identity never elevates permissions', async () => {
  const boundary = createTrustedRbacBoundary(p)
  const publicCtx = { path: 'notes', method: 'find', params: { query: { role: 'admin' } } }
  assert.equal(await boundary.authorize(publicCtx), publicCtx)
  const request = { path: 'notes', method: 'create', params: { user: { roles: ['admin'] }, query: { role: 'admin' } } }
  await denied(boundary.authorize(request))
  await denied(boundary.authorize({ path: 'users', method: 'find' }))
  await denied(boundary.authorize({ path: 'notes', method: 'custom' }))
})

test('P1: server attestation is bound to the exact request context and snapshots roles', async () => {
  const boundary = createTrustedRbacBoundary(p)
  const ctx = { path: 'notes', method: 'create', params: { roles: ['admin'] } }
  const roles = ['editor']
  boundary.attestAfterVerifiedAuthentication(ctx, { subject: 'demo-user', roles })
  roles.splice(0, 1)
  assert.equal(await boundary.authorize(ctx), ctx)
  await denied(boundary.authorize({ ...ctx }))
  assert.throws(() => boundary.attestAfterVerifiedAuthentication(ctx, { subject: 'second', roles: ['admin'] }), RbacForbiddenError)
  await denied(boundary.authorize({ path: 'notes', method: 'remove', params: { roles: ['admin'] } }))
})

test('P1: no caller-supplied property getters, invalid roles or __proto__ authorization', async () => {
  const boundary = createTrustedRbacBoundary(p)
  const ctx = { path: 'notes', method: 'remove' }
  const malicious = Object.defineProperty({}, 'subject', { get() { throw new Error('secret value') } })
  assert.throws(() => boundary.attestAfterVerifiedAuthentication(ctx, malicious), RbacForbiddenError)
  assert.throws(() => boundary.attestAfterVerifiedAuthentication(ctx, { subject: 'id', roles: ['__proto__'] }), RbacForbiddenError)
  await denied(boundary.authorize(ctx))
  const policy = JSON.parse('{"__proto__":{"find":"public"}}')
  assert.throws(() => createRbacAuthorizer(policy, () => null), RbacConfigurationError)
})

test('P2: one connection is established for concurrent calls; health/close are serialized', async () => {
  const reg = new ProviderRegistry()
  let connects = 0
  let checks = 0
  let closes = 0
  const resource = Object.freeze({ kind: 'test-only' })
  reg.register('primary', 'postgresql', {
    async connect() { connects++; return resource },
    async health(conn) { assert.equal(conn, resource); checks++ },
    async close(conn) { assert.equal(conn, resource); closes++ },
  })
  const [a, b] = await Promise.all([reg.connect('primary'), reg.connect('primary')])
  assert.equal(a, b)
  assert.equal(connects, 1)
  await Promise.all([reg.health('primary'), reg.close('primary')])
  assert.equal(checks, 1)
  assert.equal(closes, 1)
  assert.equal(reg.snapshot()[0].state, 'idle')
  await reg.close('primary')
  assert.equal(closes, 1)
})

test('P2: configuration rejects unsafe names, duplicate registrations, unknown drivers and unsupported kinds', () => {
  const r = new ProviderRegistry()
  const adapter = { async connect() { return {} }, async health() {}, async close() {} }
  r.register('main-db', 'mongodb', adapter)
  for (const name of ['__proto__', 'main/db', '../main', '', 'BAD']) {
    assert.throws(() => r.register(name, 'mongodb', adapter), ProviderConfigurationError)
  }
  assert.throws(() => r.register('main-db', 'mongodb', adapter), ProviderConfigurationError)
  assert.throws(() => r.register('x', 'cassandra', adapter), ProviderConfigurationError)
  assert.throws(() => r.register('x', 'redis', {}), ProviderConfigurationError)
})

test('P2: no secret-bearing raw errors or credentials reach diagnostics', async () => {
  const r = new ProviderRegistry()
  const secret = 'password-do-not-display'
  r.register('cache', 'redis', {
    async connect() { throw new Error(secret) },
    async health() {}, async close() {},
  })
  await assert.rejects(r.connect('cache'), e => e instanceof ProviderLifecycleError && !JSON.stringify(e).includes(secret))
  const snapshot = JSON.stringify(r.snapshot())
  assert.ok(!snapshot.includes(secret))
  assert.deepEqual(r.snapshot(), [{ name: 'cache', kind: 'redis', state: 'failed' }])
  await r.close('cache')
  assert.equal(r.snapshot()[0].state, 'idle')
})

test('P2: a failed health check retains the resource for explicit cleanup; no hidden reconnect', async () => {
  const r = new ProviderRegistry()
  let connections = 0
  let closures = 0
  r.register('main', 'mysql', {
    async connect() { connections++; return { x: 1 } },
    async health() { throw new Error('db://private-connection-string') },
    async close() { closures++ },
  })
  await r.connect('main')
  await assert.rejects(r.health('main'), ProviderLifecycleError)
  await assert.rejects(r.connect('main'), ProviderLifecycleError)
  assert.equal(connections, 1)
  await r.close('main')
  assert.equal(closures, 1)
  await r.connect('main')
  assert.equal(connections, 2)
})

test('P2: closeAll attempts every provider and signals errors without credentials', async () => {
  const r = new ProviderRegistry()
  let successClosed = false
  r.register('first', 'sqlite', { async connect() { return 1 }, async health() {}, async close() { throw new Error('private-password') } })
  r.register('second', 'valkey', { async connect() { return 2 }, async health() {}, async close() { successClosed = true } })
  await Promise.all([r.connect('first'), r.connect('second')])
  await assert.rejects(r.closeAll(), error => error instanceof ProviderLifecycleError && !String(error).includes('private-password'))
  assert.equal(successClosed, true)
  assert.deepEqual(r.snapshot().map(e => e.state), ['failed', 'idle'])
})
