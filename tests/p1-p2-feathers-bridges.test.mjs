import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve('dist')
const from = async rel => import(pathToFileURL(resolve(root, rel)).href)
const {
  extractFeathersAccessToken, createFeathersRbacBeforeHook,
  installFeathersServiceRbac, createFeathersJwtVerifier,
} = await from('security/feathers-rbac.js')
const { ProviderRegistry } = await from('resources/provider-registry.js')
const { createFeathersProviderHealthHook } = await from('resources/feathers-provider-gate.js')

const policies = Object.freeze({
  notes: Object.freeze({
    find: 'public', get: 'authenticated', create: Object.freeze({ roles: ['editor'] }),
    remove: Object.freeze({ roles: ['admin'] }),
  }),
})
const token = 'test-editor-token'
const trusted = async received => received === token ? { subject: 'server-user', roles: ['editor'] } : null
const context = (method, params = {}) => ({ path: 'notes', method, params })
const forbid = async call => assert.rejects(call, e => e?.code === 403 && e?.message === 'Forbidden')

test('P1-R2 extracts only bounded Bearer or Socket credentials', () => {
  assert.equal(extractFeathersAccessToken({ headers: { authorization: `Bearer ${token}` } }), token)
  assert.equal(extractFeathersAccessToken({ headers: { Authorization: `bearer ${token}` } }), token)
  assert.equal(extractFeathersAccessToken({ authentication: { accessToken: token } }), token)
  assert.equal(extractFeathersAccessToken({ query: { accessToken: token }, user: { roles: ['admin'] } }), null)
  assert.throws(() => extractFeathersAccessToken({ headers: { authorization: 'Basic abc' } }), /scheme/)
  assert.throws(() => extractFeathersAccessToken({ headers: { authorization: 'Bearer a', Authorization: 'Bearer b' } }), /Ambiguous/)
  assert.throws(() => extractFeathersAccessToken({ headers: { authorization: 'Bearer valid' }, authentication: { accessToken: 'other' } }), /Conflicting/)
  assert.throws(() => extractFeathersAccessToken({ authentication: { accessToken: 'z'.repeat(8193) } }), /Invalid/)
})

test('P1-R2 rejects accessor-based credential spoofing', () => {
  const malicious = Object.defineProperty({}, 'accessToken', { get() { throw new Error('private-leak') } })
  assert.throws(() => extractFeathersAccessToken({ authentication: malicious }), /Unsafe/)
  assert.equal(extractFeathersAccessToken({ authentication: Object.create({ accessToken: token }) }), null)
})

test('P1-R2 explicit public policy never invokes authentication', async () => {
  const hook = createFeathersRbacBeforeHook(policies, () => { throw Error('must not verify public') })
  await hook(context('find'))
})

test('P1-R2 denies missing rules, forged identity and credential failures', async () => {
  const hook = createFeathersRbacBeforeHook(policies, trusted)
  await forbid(() => hook({ path: 'unknown', method: 'find', params: { authentication: { accessToken: token } } }))
  await forbid(() => hook(context('patch', { authentication: { accessToken: token } })))
  await forbid(() => hook(context('create', { user: { roles: ['admin'] }, principal: { roles: ['editor'] }, query: { accessToken: token } })))
  await forbid(() => hook(context('create', { headers: { authorization: 'Bearer fake-token' }, roles: ['admin'] })))
  await hook(context('create', { headers: { authorization: `Bearer ${token}` } }))
  await forbid(() => hook(context('remove', { headers: { authorization: `Bearer ${token}` }, user: { roles: ['admin'] } })))
})

test('P1-R2 verifier receives no client-supplied object, errors stay generic', async () => {
  const seen = []
  const hook = createFeathersRbacBeforeHook(policies, async (accessToken, action) => {
    seen.push({ accessToken, action })
    return trusted(accessToken)
  })
  await hook(context('create', { authentication: { accessToken: token }, user: { roles: ['admin'] } }))
  assert.deepEqual(seen, [{ accessToken: token, action: { path: 'notes', method: 'create' } }])
  const errorHook = createFeathersRbacBeforeHook(policies, async () => { throw Error('token-content-or-secret') })
  await forbid(() => errorHook(context('create', { authentication: { accessToken: token } })))
})

test('P1-R2 service-level install never intercepts authentication service', async () => {
  let installed
  let authHooks = 0
  const notes = { hooks(value) { installed = value } }
  const authentication = { hooks() { authHooks++ } }
  const app = { service(name) { return name === 'notes' ? notes : authentication } }
  installFeathersServiceRbac(app, 'notes', policies, trusted)
  assert.equal(installed.before.all.length, 1)
  assert.equal(authHooks, 0)
  await installed.before.all[0](context('create', { authentication: { accessToken: token } }))
  assert.throws(() => installFeathersServiceRbac(app, 'notes', policies, trusted), /already installed/)
})

test('P1-R2 Feathers JWT adapter requires service authentication then fresh trusted roles', async () => {
  const calls = []
  const service = { async authenticate(data, params, strategy) {
    calls.push({ data, params, strategy })
    if (data.accessToken !== token) throw Error('JWT signature expired')
    return { user: { id: '123', roles: ['admin'] } }
  } }
  const resolver = createFeathersJwtVerifier(service, async id => {
    assert.equal(id, '123')
    return { subject: id, roles: ['editor'] }
  })
  assert.deepEqual(await resolver(token, { path: 'notes', method: 'create' }), { subject: '123', roles: ['editor'] })
  assert.equal(await resolver('not-a-token', { path: 'notes', method: 'create' }), null)
  assert.deepEqual(calls[0], { data: { strategy: 'jwt', accessToken: token }, params: {}, strategy: 'jwt' })
})

test('P2 service gate rejects uninitialized and failed providers without exposing secrets', async () => {
  const registry = new ProviderRegistry()
  let online = true
  registry.register('primary', 'postgresql', {
    async connect() { return { ready: true } },
    async health() { if (!online) throw Error('private host/password') },
    async close() {},
  })
  const hook = createFeathersProviderHealthHook(registry, 'primary')
  await assert.rejects(hook, e => e?.code === 503 && !String(e).includes('password'))
  await registry.connect('primary')
  await hook()
  online = false
  await assert.rejects(hook, e => e?.code === 503 && !String(e).includes('password'))
  await registry.closeAll()
})
