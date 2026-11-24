import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createNotesSocketBinding } from '../dist/client/notes-socket-bridge.js'
const tick=()=>new Promise(r=>setImmediate(r))
class FakeSocket extends EventEmitter {
  connected = false
  disconnected = 0
  connect() { this.connected = true; this.emit('connect') }
  disconnect() { this.connected = false; this.disconnected++; this.emit('disconnect') }
}
function setup(socket=new FakeSocket(),ownership='owned') {
  let reads=0
  let values=[{id:1,title:'Source vérifiée'}]
  const updates=[]
  const binding=createNotesSocketBinding({socket, ownership, readNotes:async()=>{reads++;return values},store:{update:state=>updates.push(state)}})
  return {binding,socket,updates,reads:()=>reads,values:val=>{values=val},snapshot:()=>binding.controller.snapshot()}
}
test('P3-R3 maps actual Feathers v5 notes created event to server refetch and rejects event payload as state', async()=>{
  const c=setup();c.socket.connect();await c.binding.refresh();await tick()
  const previous=c.reads()
  c.socket.emit('notes created',{id:999,title:'forged',role:'admin'})
  await tick();await tick()
  assert.ok(c.reads()>previous)
  assert.equal(c.snapshot().notes[0].title,'Source vérifiée')
  assert.equal(c.snapshot().connected,true)
  await c.binding.close()
  assert.equal(c.socket.listenerCount('notes created'),0)
  assert.equal(c.socket.disconnected,1)
})
test('P3-R3 late binding to already connected socket replays connect without trusting event payload',async()=>{
  const s=new FakeSocket();s.connect()
  const c=setup(s)
  await tick();await tick()
  assert.equal(c.snapshot().connected,true)
  assert.equal(c.snapshot().notes[0].title,'Source vérifiée')
  await c.binding.close()
})
test('P3-R3 reconnection invalidates cached data and refreshes; close removes listeners',async()=>{
  const c=setup();c.socket.connect();await c.binding.refresh()
  c.socket.disconnect();assert.equal(c.snapshot().stale,true)
  c.values([{id:2,title:'Reconnexion'}]);c.socket.connect()
  await tick();await tick()
  assert.equal(c.snapshot().connected,true)
  assert.equal(c.snapshot().stale,false)
  assert.equal(c.snapshot().notes[0].title,'Reconnexion')
  await c.binding.close()
  for(const event of ['notes created','notes updated','notes patched','notes removed','connect','disconnect','connect_error'])assert.equal(c.socket.listenerCount(event),0)
})
test('P3-R3 borrowed socket cannot be disconnected by Pinia teardown',async()=>{
  const socket=new FakeSocket(), c=setup(socket,'borrowed')
  socket.connect();await c.binding.refresh();await c.binding.close()
  assert.equal(socket.disconnected,0)
  assert.equal(socket.connected,true)
})
test('P3-R3 rejects invalid input and hides server error details',async()=>{
  assert.throws(()=>createNotesSocketBinding({socket:undefined,readNotes:async()=>[],store:{update(){ }},ownership:'owned'}),/Invalid notes socket binding/)
  const socket=new FakeSocket(), updates=[]
  const binding=createNotesSocketBinding({socket,ownership:'owned',readNotes:async()=>{throw Error('SECRET-INTERNAL-JWT')},store:{update:x=>updates.push(x)}})
  await binding.refresh()
  assert.equal(updates.at(-1).error,'Impossible de synchroniser les données')
  assert.equal(JSON.stringify(updates).includes('SECRET-INTERNAL-JWT'),false)
  await binding.close()
})
