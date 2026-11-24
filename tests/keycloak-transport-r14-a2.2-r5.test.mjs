import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { createKeycloakTransportBridge } from '../dist/security/feathers-keycloak-transport.js'
import { KeycloakNotAuthenticatedError } from '../dist/security/feathers-keycloak-oidc.js'

const issuer = 'https://127.0.0.1:8444/realms/vevedh-lab'
const audience = 'cfapp-lab-api'
const party = 'cfapp-lab-spa'
const subject = 'test-user-0001'
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({format:'jwk'}), kid:'r5-kid', kty:'RSA', use:'sig', alg:'RS256' }
const enc = x => Buffer.from(JSON.stringify(x)).toString('base64url')
const payload = (overrides={}) => {
  const now = Math.floor(Date.now() / 1000)
  return {iss:issuer, aud:audience, azp:party, typ:'Bearer', sub:subject, iat:now-2, nbf:now-2, exp:now+120, realm_access:{roles:['admin']}, ...overrides}
}
const jwt = (overrides={}) => {
  const input = `${enc({typ:'JWT',alg:'RS256',kid:'r5-kid'})}.${enc(payload(overrides))}`
  return `${input}.${sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url')}`
}
function mockApp({ role='viewer', active=true, allMethods=true }={}) {
  const settings = new Map([['authentication', {entity:'user', authStrategies:['local','jwt'], parseStrategies:['jwt']} ]])
  const channels = new Map()
  const listeners = new Map()
  let count = 0
  const auth = {
    get configuration() { return settings.get('authentication') },
    getStrategy(name) { return this.strategy?.name === name ? this.strategy.value : undefined },
    register(name,strategy) { this.strategy = { name, value:strategy }; count++ },
    async authenticate(data, params, ...strategies) {
      assert.deepEqual(strategies,['keycloak'])
      return this.strategy.value.authenticate(data,params)
    }
  }
  const notes = {
    hook: null,
    hooks(value) { assert.equal(this.hook,null); this.hook=value.before.all[0] },
  }
  const services = new Map([['authentication',auth],['notes',notes]])
  const app = {
    get(name) { return settings.get(name) },
    set(name,value) { settings.set(name,value) },
    service(name) { return services.get(name) },
    use(name, service, options) { if (services.has(name)) throw Error('COLLISION'); services.set(name,service); channels.set(name,options) },
    on(event,handler) { listeners.set(event,handler) },
    fire(event,object) { listeners.get(event)?.(object) },
    getRegisterCount() { return count },
    options(name) { return channels.get(name) },
  }
  const fetchImpl = async url => new Response(JSON.stringify(url.endsWith('configuration')
    ? { issuer,jwks_uri:`${issuer}/protocol/openid-connect/certs` }
    : { keys:[jwk] }),{ status:200 })
  const options = {
    oidc: {enabled:true,issuer,audience,authorizedParty:party,fetchImpl,
      resolvePrincipal: async id => active && id===subject ? {subject:id,roles:[role]}:null},
    policies: {notes: {find:'authenticated',get:'authenticated',create:{roles:['editor']},...(allMethods?{}:{})}}
  }
  return {app, auth, notes,options, services}
}
async function setup(settings={}) {
  const h=mockApp(settings)
  const bridge=createKeycloakTransportBridge(h.options)
  bridge.configure(h.app)
  bridge.protect(h.app,'notes')
  return {...h,bridge}
}
const rest = token => ({path:'notes',method:'find',params:{provider:'rest',headers:{authorization:`Bearer ${token}`}}})
const socket = connection => ({path:'notes',method:'find',params:{provider:'socketio',connection}})
const bootstrap = (h,connection,token) => h.services.get('keycloak-session').create({strategy:'keycloak',accessToken:token},{provider:'socketio',connection})

test('configuration est strictement opt-in, preserve les strategies JWT/local et n emet aucun JWT',async()=>{
  const h=await setup()
  assert.deepEqual(h.app.get('authentication').authStrategies,['local','jwt'])
  assert.deepEqual(h.app.get('authentication').parseStrategies,['keycloak','jwt'])
  assert.equal(h.app.get('r14KeycloakTransportEnabled'),true)
  assert.equal(h.app.getRegisterCount(),1)
  assert.deepEqual(h.app.options('keycloak-session'),{methods:['create'],events:[]})
  await assert.rejects(h.auth.strategy.value.authenticate({strategy:'jwt',accessToken:jwt()}),{code:401})
  assert.throws(()=>h.bridge.configure(h.app))
  assert.throws(()=>h.bridge.protect(h.app,'notes'))
})

test('REST Bearer RS256 autorise, mais jeton altere, header ambigu et roles malveillants refuses',async()=>{
  const h=await setup()
  const original = jwt()
  assert.equal(await h.notes.hook(rest(original)), undefined)
  // Change six SIGNIFICANT bits of the RS256 signature, not the last Base64URL
  // character: that character can already be 'A' and includes unused bits.
  const [header, claims, signature] = original.split('.')
  assert.ok(header && claims && signature && signature.length > 10)
  const modifiedSignature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1)
  const modified = `${header}.${claims}.${modifiedSignature}`
  assert.notEqual(modified, original)
  await assert.rejects(h.notes.hook(rest(modified)), { code: 401 })
  await assert.rejects(h.notes.hook({path:'notes',method:'find',params:{provider:'rest',headers:{authorization:`Bearer ${jwt()}`,'Authorization':`Bearer ${jwt()}`}}}),{code:401})
  await assert.rejects(h.notes.hook(rest('not.a.jwt')),{code:401})
  // The token has realm_access.roles=['admin'] but trusted loader grants only viewer.
  await assert.rejects(h.notes.hook({...rest(jwt()),method:'create'}),{code:403})
})

test('une signature Base64URL non canonique est refusee meme si ses octets decodes sont identiques',async()=>{
  const h = await setup()
  const original = jwt()
  const parts = original.split('.')
  assert.equal(parts.length, 3)
  const signature = parts[2]
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const last = alphabet.indexOf(signature.at(-1))
  // RSA-2048 signature is 256 bytes (length % 3 = 1): final Base64URL sextet
  // has four unused bits. Change just one unused bit to make a textual alias.
  assert.equal(Buffer.from(signature, 'base64url').length, 256)
  assert.equal(last % 16, 0)
  const aliasSignature = signature.slice(0, -1) + alphabet[last + 1]
  assert.deepEqual(Buffer.from(aliasSignature, 'base64url'), Buffer.from(signature, 'base64url'))
  const alias = `${parts[0]}.${parts[1]}.${aliasSignature}`
  assert.notEqual(alias, original)
  await assert.rejects(h.notes.hook(rest(alias)), { code: 401 })
})

test('Socket.IO handshake passe par service.create, sans query token et sans echo',async()=>{
  const h=await setup()
  const conn={}
  await assert.rejects(h.notes.hook(socket(conn)),{code:401})
  await assert.rejects(h.services.get('keycloak-session').create({strategy:'keycloak',accessToken:jwt()},{provider:'rest',connection:conn}),{code:401})
  const reply=await bootstrap(h,conn,jwt())
  assert.deepEqual(reply,{authenticated:true})
  assert.equal(await h.notes.hook(socket(conn)),undefined)
  // A request cannot forge authentication via query or user supplied params.
  await assert.rejects(h.notes.hook({path:'notes',method:'find',params:{provider:'socketio',connection:{},query:{accessToken:jwt()},user:{roles:['admin']}}}),{code:401})
  h.app.fire('disconnect',conn)
  await assert.rejects(h.notes.hook(socket(conn)),{code:401})
})

test('refus des sessions invalides et ancienne session invalidée a une réauthentification échouée',async()=>{
  const h=await setup()
  const conn={}
  await bootstrap(h,conn,jwt())
  await assert.rejects(bootstrap(h,conn,'bad'),{code:401})
  await assert.rejects(h.notes.hook(socket(conn)),{code:401})
  await assert.rejects(h.services.get('keycloak-session').create({strategy:'keycloak',accessToken:jwt(),roles:['admin']},{provider:'socketio',connection:conn}),{code:401})
})

test('expiration / révocation côté compte sont revérifiées à chaque appel',async()=>{
  let accountActive=true
  const h=mockApp()
  h.options.oidc.resolvePrincipal=async id=> accountActive&&id===subject ? {subject:id,roles:['viewer']}:null
  const bridge=createKeycloakTransportBridge(h.options);bridge.configure(h.app);bridge.protect(h.app,'notes')
  const conn={}
  await bootstrap(h,conn,jwt())
  accountActive=false
  await assert.rejects(h.notes.hook(socket(conn)),{code:401})
  const h2=await setup()
  await assert.rejects(h2.notes.hook(rest(jwt({exp:Math.floor(Date.now()/1000)-100}))),{code:401})
})

test('malformations REST, providers inconnus et appels internes refusés',async()=>{
  const h=await setup()
  const valid=jwt()
  for (const context of [
    {path:'notes',method:'find',params:{provider:'unknown',headers:{authorization:`Bearer ${valid}`}}},
    {path:'notes',method:'find',params:{headers:{authorization:`Bearer ${valid}`}}},
    {path:'notes',method:'find',params:{provider:'rest',headers:{authorization:`Basic ${valid}`}}},
    {path:'notes',method:'find',params:{provider:'rest',headers:{authorization:`Bearer ${valid}, Bearer ${valid}`}}},
  ]) await assert.rejects(h.notes.hook(context), {code:401})
})

test('politiques inconnues / chemins non autorisés restent deny-by-default',async()=>{
  const h=await setup()
  await assert.rejects(h.notes.hook({...rest(jwt()),method:'patch'}),{code:403})
  await assert.rejects(h.notes.hook({...rest(jwt()),path:'authentication'}),{code:403})
  assert.throws(()=>h.bridge.protect(h.app,'authentication'))
  assert.throws(()=>h.bridge.protect(h.app,'keycloak-session'))
})

test('les identités simultanées restent isolées au niveau du contexte',async()=>{
  const h=await setup()
  const a=rest(jwt()); const b={...rest(jwt()), method:'create'}
  const results=await Promise.allSettled([h.notes.hook(a),h.notes.hook(b)])
  assert.equal(results[0].status,'fulfilled')
  assert.equal(results[1].status,'rejected')
  assert.equal(results[1].reason.code,403)
})

test('configurations host dangereuses et services existants bloquent avant activation',()=>{
  const h=mockApp()
  h.app.set('authentication',{entity:'user',authStrategies:['keycloak','jwt'],parseStrategies:['jwt']})
  const bridge=createKeycloakTransportBridge(h.options)
  assert.throws(()=>bridge.configure(h.app), /Unsafe authentication/)
  assert.equal(h.app.get('r14KeycloakTransportEnabled'),undefined)
  const x=mockApp();x.services.set('keycloak-session',{})
  assert.throws(()=>createKeycloakTransportBridge(x.options).configure(x.app), /already exists/)
  assert.equal(x.app.get('r14KeycloakTransportEnabled'),undefined)
})
