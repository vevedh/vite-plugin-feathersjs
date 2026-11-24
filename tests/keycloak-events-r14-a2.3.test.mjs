import test from 'node:test'
import assert from 'node:assert/strict'
import { installKeycloakEventFence } from '../dist/security/feathers-keycloak-events.js'

function fixture() {
  const byEvent=new Map()
  const service={
    publish(event, fn) {
      if (typeof event==='function') byEvent.set('*',event)
      else byEvent.set(event,fn)
      return this
    },
  }
  const store=new Map([['notes',service]])
  const app={get(key){return key==='r14KeycloakTransportEnabled' ? true : undefined},service(path){return store.get(path)}}
  return {app,store,byEvent,service}
}
test('opt-in required; fail closed',()=>{
  const {app}=fixture();app.get=()=>false
  assert.throws(()=>installKeycloakEventFence(app,['notes']),/enabled transport/)
})
test('all standard and custom Feathers events are denied',()=>{
  const {app,byEvent,service}=fixture()
  service.publish('created',()=>({unsafe:true}))
  const receipt=installKeycloakEventFence(app,['notes'])
  assert.equal(receipt.mode,'DENY_ALL_FEATHERS_SERVICE_EVENTS')
  assert(Object.isFrozen(receipt.protectedPaths))
  for (const event of ['created','updated','patched','removed','custom']) {
    assert.equal((byEvent.get(event)??byEvent.get('*'))({private:'must-never-leak'},{}),null)
  }
})
test('invalid paths, duplicates and unsupported services refuse before any writes',()=>{
  const {app,byEvent}=fixture()
  for (const paths of [['notes','../root'],['notes','notes'],['authentication'],['keycloak-session'],[],['bad query']]) {
    assert.throws(()=>installKeycloakEventFence(app,paths))
    assert.equal(byEvent.size,0)
  }
})
test('unknown service is not implicitly registered',()=>{
  const {app,byEvent}=fixture()
  assert.throws(()=>installKeycloakEventFence(app,['missing']))
  assert.equal(byEvent.size,0)
})
test('service-specific deny overrides preexisting specific publisher and global publisher',()=>{
  const {app,byEvent,service}=fixture()
  const leak=()=>({channel:'everybody'})
  service.publish('created',leak)
  installKeycloakEventFence(app,['notes'])
  assert.equal(byEvent.get('created')({data:'secret'},{}),null)
})
