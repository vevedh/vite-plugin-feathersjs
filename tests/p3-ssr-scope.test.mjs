import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFeathersRequestScope } from '../dist/client/ssr-request-scope.js'
function client(id, options = {}) {
  const events = new Map()
  const stats = { close: 0, off: 0 }
  return { identity: id, stats, events,
    transport: { on(event, fn) { if (!events.has(event)) events.set(event, new Set()); events.get(event).add(fn) },
      off(event, fn) { stats.off++; if (options.offThrows) throw Error('SECRET token'); events.get(event)?.delete(fn) } },
    async dispose() { stats.close++; if (options.disposeThrows) throw Error('SECRET credential') }
  }
}
test('P3 SSR creates independent client and listeners for each request', async () => {
  const a = client('alice'), b = client('bob')
  const scopeA = createFeathersRequestScope(() => a), scopeB = createFeathersRequestScope(() => b)
  const calls = []
  scopeA.subscribe('notes:created', () => calls.push('a'))
  scopeB.subscribe('notes:created', () => calls.push('b'))
  assert.equal(scopeA.snapshot.subscriptions, 1)
  assert.equal(scopeB.snapshot.identity, 'bob')
  for (const callback of a.events.get('notes:created')) callback({})
  assert.deepEqual(calls, ['a'])
  await scopeA.close()
  assert.equal(scopeA.snapshot.identity, null)
  assert.equal(a.events.get('notes:created').size, 0)
  assert.equal(scopeB.snapshot.subscriptions, 1)
  await scopeB.close()
  assert.equal(a.stats.close, 1); assert.equal(b.stats.close, 1)
})
test('P3 unsubscribe idempotent, cleanup closes once under concurrency', async () => {
  const c = client('u'), scope = createFeathersRequestScope(() => c)
  const unsub = scope.subscribe('created', () => {})
  unsub(); unsub()
  scope.subscribe('removed', () => {})
  await Promise.all([scope.close(), scope.close()])
  assert.equal(c.stats.close, 1)
  assert.equal(scope.snapshot.subscriptions, 0)
  assert.throws(() => scope.subscribe('created', () => {}))
})
test('P3 rejects reserved fields and unsafe client input', async () => {
  const c = client(null), s = createFeathersRequestScope(() => c)
  for (const event of ['__proto__','constructor','prototype','../token','', 'x'.repeat(130)]) assert.throws(() => s.subscribe(event, () => {}))
  assert.throws(() => s.subscribe('safe', null))
  assert.throws(() => createFeathersRequestScope(() => ({...c, identity: 42})))
  await s.close()
})
test('P3 cleanup preserves generic errors, attempts all releases', async () => {
  const c = client('u', { offThrows: true, disposeThrows: true })
  const s = createFeathersRequestScope(() => c)
  s.subscribe('one', () => {})
  s.subscribe('two', () => {})
  await assert.rejects(s.close(), error => error instanceof AggregateError && !error.message.includes('SECRET') && error.errors.length === 3 && error.errors.every(e => !e.message.includes('SECRET')))
  assert.equal(c.stats.off, 2); assert.equal(c.stats.close, 1)
  assert.equal(s.snapshot.closed, true)
})
