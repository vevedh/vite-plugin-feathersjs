import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createFeathersRequestScope } from '../dist/client/ssr-request-scope.js'
import { createRealtimeReconciliation } from '../dist/client/realtime-reconcile.js'
const sleep = async () => new Promise(resolve => setImmediate(resolve))
function lab(identity = 'session') {
  const emitter = new EventEmitter()
  const connection = new EventEmitter()
  const updates = []
  const state = { notes:[], connected:false, stale:true, pending:false, error:null }
  let disposed = 0
  const scope = createFeathersRequestScope(() => ({ identity, transport:emitter, async dispose() { disposed++ } }))
  const store = { update(next) { updates.push(next); Object.assign(state, next) } }
  return { emitter, connection, updates, state, scope, store, get disposed() { return disposed } }
}
const one = Object.freeze([{ id:1, title:'Une note' }])
test('P3-R2 SSR isolation: separate stores receive only own service events', async () => {
  const a=lab('a'), b=lab('b')
  let readsA=0, readsB=0
  const A=createRealtimeReconciliation({scope:a.scope,store:a.store,service:async()=>{readsA++;return one}})
  const B=createRealtimeReconciliation({scope:b.scope,store:b.store,service:async()=>{readsB++;return [{id:2,title:'Autre note'}]}})
  await A.refresh();await B.refresh()
  a.emitter.emit('created', { id:999, title:'injected' })
  await sleep();await sleep()
  assert.equal(readsA,2);assert.equal(readsB,1)
  assert.deepEqual(a.state.notes, one)
  assert.deepEqual(b.state.notes,[{id:2,title:'Autre note'}])
  await Promise.all([A.close(),B.close()]);assert.equal(a.disposed,1);assert.equal(b.disposed,1)
})
test('P3-R2 events never trust injected payload; snapshots validated', async () => {
  const c=lab()
  let payload={ data:[{id:'safe-01',title:'OK'}] }
  const ctrl=createRealtimeReconciliation({scope:c.scope, store:c.store,service:async()=>payload})
  await ctrl.refresh()
  c.emitter.emit('patched', {id:2,title:'ADMIN',role:'admin'})
  await sleep();await sleep()
  assert.equal(c.state.notes[0].title,'OK')
  payload={data:[{id:'safe-01',title:'\u0000secret'}]}
  await ctrl.refresh()
  assert.equal(c.state.error,'Impossible de synchroniser les données')
  assert.equal(c.state.stale,true)
  assert.equal(JSON.stringify(c.state).includes('secret'),false)
  await ctrl.close()
})
test('P3-R2 disconnect invalidates in-flight read and reconnect fetches fresh', async () => {
  const c=lab()
  let resolveFirst
  let count=0
  const ctrl=createRealtimeReconciliation({scope:c.scope, connection:c.connection,store:c.store,service:async()=>{
    count++
    if(count===1) return new Promise(resolve=>{resolveFirst=resolve})
    return [{id:3,title:'Fresh'}]
  }})
  c.connection.emit('connect');await sleep()
  c.connection.emit('disconnect');c.connection.emit('connect')
  resolveFirst([{id:1,title:'Old'}])
  await sleep();await sleep();await sleep()
  assert.ok(count>=2)
  assert.deepEqual(c.state.notes,[{id:3,title:'Fresh'}])
  assert.equal(c.state.connected,true)
  assert.equal(c.state.stale,false)
  await ctrl.close()
})
test('P3-R2 coalesces burst into at most two reads, no refetching writes', async () => {
  const c=lab();let readCount=0;let release
  const ctrl=createRealtimeReconciliation({scope:c.scope,store:c.store,service:async()=>{
    readCount++
    if(readCount===1) return new Promise(resolve=>{release=resolve})
    return one
  }})
  const first=ctrl.refresh();await sleep()
  for(let i=0;i<50;i++) c.emitter.emit('created',{notTrusted:i})
  release(one)
  await first;await sleep()
  assert.equal(readCount,2)
  assert.equal(c.state.pending,false)
  await ctrl.close()
})
test('P3-R2 close aborts, removes listeners and does not publish late responses', async () => {
  const c=lab();let resolveSlow, captured
  const ctrl=createRealtimeReconciliation({scope:c.scope,connection:c.connection,store:c.store,service:async(signal)=>{
    captured=signal
    return new Promise(resolve=>{resolveSlow=resolve})
  }})
  const pending=ctrl.refresh();await sleep()
  const updates=c.updates.length
  const stop=ctrl.close()
  assert.equal(captured.aborted,true)
  resolveSlow(one)
  await Promise.all([pending,stop,ctrl.close()])
  c.connection.emit('connect');c.emitter.emit('created',{})
  await sleep()
  assert.equal(c.updates.length,updates)
  assert.equal(c.disposed,1)
  assert.equal(c.emitter.listenerCount('created'),0)
  assert.equal(c.connection.listenerCount('disconnect'),0)
})
test('P3-R2 user-facing errors redact secrets and clean up after failure', async () => {
  const c=lab()
  const ctrl=createRealtimeReconciliation({scope:c.scope,store:c.store,service:async()=>{throw Error('JWT super_secret_connection')}})
  await ctrl.refresh()
  assert.equal(c.state.error,'Impossible de synchroniser les données')
  assert.equal(JSON.stringify(c.state).includes('super_secret'),false)
  await ctrl.close()
})
