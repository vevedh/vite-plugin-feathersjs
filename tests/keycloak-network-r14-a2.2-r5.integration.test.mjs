/**
 * REAL Feathers v5 REST + Socket.IO transport smoke (independent signed JWKS fixture).
 * Run under the installed fork after npm run build. Requires actual Feathers deps.
 * Does NOT certify a real Keycloak deployment or audience mapper.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { feathers } from '@feathersjs/feathers'
import express, { json, rest, errorHandler } from '@feathersjs/express'
import socketio from '@feathersjs/socketio'
import { AuthenticationService, JWTStrategy } from '@feathersjs/authentication'
import { io } from 'socket.io-client'
import { createKeycloakTransportBridge } from '../dist/security/feathers-keycloak-transport.js'

// Diagnostic-only R14-A2.2-R5-R4: no change to JWT validation or production runtime.
const HTTP_TIMEOUT_MS = 7000
const SOCKET_TIMEOUT_MS = 5000
const CLEANUP_TIMEOUT_MS = 5000

function stage(name) {
  console.error(`[R14_R5_NETWORK] STAGE=${name}`)
}
function bounded(promise, ms, label) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`TIMEOUT_${label}`)), ms) }),
  ]).finally(() => clearTimeout(timer))
}
function request(url, init = {}) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
}
function connected(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => settle(new Error('SOCKET_CONNECT_TIMEOUT')), SOCKET_TIMEOUT_MS)
    const onConnect = () => settle(null)
    const onError = error => settle(error)
    function settle(error) {
      clearTimeout(timer)
      socket.off('connect', onConnect)
      socket.off('connect_error', onError)
      if (error) reject(error)
      else resolve()
    }
    socket.once('connect', onConnect)
    socket.once('connect_error', onError)
    socket.connect()
  })
}

const issuer = 'https://127.0.0.1:8444/realms/vevedh-lab'
const { publicKey, privateKey } = generateKeyPairSync('rsa', {modulusLength:2048})
const key = { ...publicKey.export({format:'jwk'}),kid:'r5-network-key',alg:'RS256',use:'sig',kty:'RSA' }
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url')
function token(sub='test-actor') {
  const n=Math.floor(Date.now()/1000)
  const base=`${b64({alg:'RS256',kid:'r5-network-key',typ:'JWT'})}.${b64({iss:issuer,aud:'cfapp-lab-api',azp:'cfapp-lab-spa',typ:'Bearer',sub,iat:n-2,nbf:n-2,exp:n+60,realm_access:{roles:['admin']}})}`
  return `${base}.${sign('RSA-SHA256',Buffer.from(base),privateKey).toString('base64url')}`
}

async function laboratory() {
  const app=express(feathers())
  app.disable('x-powered-by')
  app.use(json())
  app.configure(rest())
  app.configure(socketio({cors:{origin:['http://127.0.0.1:3333'],methods:['GET','POST']}}))
  const accounts=new Map([['test-actor',{id:'test-actor',active:true,roles:['viewer']} ]])
  app.use('users', {id:'id',async get(id){return accounts.get(id)??null}}, {methods:[]})
  app.set('authentication',{secret:randomBytes(40).toString('hex'),entity:'user',service:'users',authStrategies:['jwt'],parseStrategies:['jwt'],jwtOptions:{algorithm:'HS256',issuer:'feathers-r5-lab',audience:'r5-lab'}})
  const auth=new AuthenticationService(app)
  auth.register('jwt',new JWTStrategy())
  app.use('authentication',auth,{methods:['create']})
  const lookup=async (sub)=> {
    const user=accounts.get(sub)
    return user?.active ? {subject:sub,roles:user.roles}:null
  }
  const bridge=createKeycloakTransportBridge({
    oidc:{enabled:true,issuer,audience:'cfapp-lab-api',authorizedParty:'cfapp-lab-spa',resolvePrincipal:lookup,
      fetchImpl:async url => new Response(JSON.stringify(url.endsWith('configuration')?
        {issuer,jwks_uri:`${issuer}/protocol/openid-connect/certs`}:{keys:[key]}),{status:200})},
    policies:{notes:{find:'authenticated',create:{roles:['editor']}}}
  })
  bridge.configure(app)
  app.use('notes', {async find(){return [{text:'public-fixture'}]},async create(data){return data}}, {methods:['find','create']})
  bridge.protect(app,'notes')
  app.use(errorHandler({logger:false}))
  const server=createServer(app)
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)})
  stage('FEATHERS_SETUP')
  try {
    await bounded(app.setup(server), HTTP_TIMEOUT_MS, 'FEATHERS_SETUP')
  } catch (error) {
    // Boot failed before the laboratory handle could be returned: release it here.
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
    server.close()
    throw error
  }
  const address=server.address()
  if(!address||typeof address==='string')throw Error('Invalid bound address')
  const base=`http://127.0.0.1:${address.port}`
  return { app, server, accounts, base, async close() {
    stage('TEARDOWN')
    let firstError
    try {
      await bounded(app.teardown(server), CLEANUP_TIMEOUT_MS, 'FEATHERS_TEARDOWN')
    } catch (error) { firstError = error }
    // HTTP keep-alive connections should not prevent the test process from exiting.
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
    if (server.listening) {
      try {
        await bounded(new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())), CLEANUP_TIMEOUT_MS, 'HTTP_CLOSE')
      } catch (error) { firstError ??= error }
    }
    if (firstError) throw firstError
  }}
}
function emit(socket, method, path, ...args) {
  return new Promise((resolve, reject) => {
    // Feathers Socket.IO protocol uses an acknowledgement callback. Never
    // allow a missing acknowledgement to retain this test indefinitely.
    const timer = setTimeout(() => reject(new Error(`SOCKET_ACK_TIMEOUT_${method.toUpperCase()}`)), SOCKET_TIMEOUT_MS)
    socket.emit(method, path, ...args, (error, value) => {
      clearTimeout(timer)
      if (error) reject(error)
      else resolve(value)
    })
  })
}

test('live transport Feathers REST et Socket.IO : session requise, refus JWT contrefait, RBAC serveur', { timeout: 40000 }, async () => {
  let lab
  let socket
  let step = 'BOOT'
  const at = name => { step = name; stage(name) }
  try {
    at('BOOT_FEATHERS')
    lab = await bounded(laboratory(), HTTP_TIMEOUT_MS, 'BOOT_FEATHERS')
    at('REST_ANONYMOUS')
    const anon = await request(`${lab.base}/notes`)
    assert.equal(anon.status, 401, 'anonymous REST request must reject with 401, not 500')
    const anonBody = await anon.json()
    assert.equal(anonBody.code, 401)
    assert.equal(anonBody.className, 'not-authenticated')
    assert.doesNotMatch(JSON.stringify(anonBody), /stack|accessToken|privateKey/i)

    const valid = token()
    at('REST_VALID_RS256')
    const ok = await request(`${lab.base}/notes`, { headers: { Authorization: `Bearer ${valid}` } })
    assert.equal(ok.status, 200)
    at('REST_FORBIDDEN_RBAC')
    const denied = await request(`${lab.base}/notes`, {
      method: 'POST', headers: { Authorization: `Bearer ${valid}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'blocked' }),
    })
    assert.equal(denied.status, 403, 'RBAC must return native Feathers Forbidden (403)')
    const forbiddenBody = await denied.json()
    assert.equal(forbiddenBody.code, 403)
    assert.equal(forbiddenBody.className, 'forbidden')

    at('SOCKET_CONNECT')
    socket = io(lab.base, { transports: ['websocket'], reconnection: false, autoConnect: false, timeout: SOCKET_TIMEOUT_MS })
    await connected(socket)
    at('SOCKET_ANONYMOUS')
    await assert.rejects(emit(socket, 'find', 'notes'), error => error?.code === 401)
    at('SOCKET_AUTH_SESSION')
    const proof = await emit(socket, 'create', 'keycloak-session', { strategy: 'keycloak', accessToken: valid })
    assert.deepEqual(proof, { authenticated: true })
    at('SOCKET_AUTHENTICATED_FIND')
    const found = await emit(socket, 'find', 'notes')
    assert.deepEqual(found, [{ text: 'public-fixture' }])
    at('SOCKET_FORBIDDEN_RBAC')
    await assert.rejects(emit(socket, 'create', 'notes', { text: 'denied' }), error => error?.code === 403)
    at('SOCKET_REVOKED_USER')
    lab.accounts.get('test-actor').active = false
    await assert.rejects(emit(socket, 'find', 'notes'), error => error?.code === 401)
    at('NETWORK_ASSERTIONS_PASS')
  } catch (error) {
    console.error(`[R14_R5_NETWORK] FAILED_STAGE=${step} | ERROR=${error?.code || error?.name || 'UNKNOWN'}`)
    throw error
  } finally {
    // Socket must close BEFORE the Feathers/HTTP server teardown.
    if (socket) {
      at('SOCKET_DISCONNECT')
      socket.disconnect()
      socket.removeAllListeners()
    }
    if (lab) {
      await lab.close()
    }
    at('CLEANUP_FINISHED')
  }
})
