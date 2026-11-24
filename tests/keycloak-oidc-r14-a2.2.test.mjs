import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { createKeycloakAccessTokenVerifier, createFeathersKeycloakVerifier, FeathersKeycloakStrategy, KeycloakNotAuthenticatedError } from '../dist/security/feathers-keycloak-oidc.js'

const issuer = 'https://127.0.0.1:8444/realms/vevedh-lab'
const audience = 'cfapp-lab-api'
const authorizedParty = 'cfapp-lab-spa'
const sub = '00000000-0000-4000-a000-000000000123'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: 'local-kid-1', kty: 'RSA', alg: 'RS256', use: 'sig' }
const encode = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')
const now = () => Math.floor(Date.now() / 1000)
const claims = () => ({ iss: issuer, aud: audience, azp: authorizedParty, typ: 'Bearer', sub, iat: now() - 3, nbf: now() - 3, exp: now() + 300, realm_access: { roles: ['admin'] } })
function token(payload = claims(), header = { alg: 'RS256', typ: 'JWT', kid: 'local-kid-1' }, key = privateKey) {
  const head = encode(header)
  const body = encode(payload)
  const signature = sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key).toString('base64url')
  return `${head}.${body}.${signature}`
}
function harness({ discovery = {}, jwks = { keys: [publicJwk] }, user = { subject: sub, roles: ['viewer'] }, status = 200 } = {}) {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    const target = url.endsWith('/.well-known/openid-configuration') ? { issuer, jwks_uri: `${issuer}/protocol/openid-connect/certs`, ...discovery } : jwks
    return new Response(JSON.stringify(target), { status, headers: { 'content-type': 'application/json' } })
  }
  const options = { enabled: true, issuer, audience, authorizedParty, resolvePrincipal: async () => user, fetchImpl }
  return { verify: createKeycloakAccessTokenVerifier(options), options, calls }
}

test('jeton RS256 signe et compte serveur actif acceptes; role malveillant ignore', async () => {
  const h = harness()
  const result = await h.verify(token())
  assert.deepEqual(result, { subject: sub, roles: ['viewer'] })
  assert.equal(Object.isFrozen(result.roles), true)
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[0].init.redirect, 'error')
  assert.equal(h.calls[1].init.redirect, 'error')
})

test('cache JWKS reutilise, sans recharger la cle a chaque appel', async () => {
  const h = harness()
  assert.ok(await h.verify(token()))
  assert.ok(await h.verify(token()))
  assert.equal(h.calls.length, 2)
})

test('signature modifiee refusee', async () => {
  const h = harness()
  const signed = token(); const segments = signed.split('.')
  const last = segments[2]
  segments[2] = `${last[0] === 'A' ? 'B' : 'A'}${last.slice(1)}`
  assert.equal(await h.verify(segments.join('.')), null)
})

test('alg none, HS256 et jku distant refuses', async () => {
  const h = harness()
  assert.equal(await h.verify(token(claims(), { alg: 'none', kid: publicJwk.kid })), null)
  assert.equal(await h.verify(token(claims(), { alg: 'HS256', kid: publicJwk.kid })), null)
  assert.equal(await h.verify(token(claims(), { alg: 'RS256', kid: publicJwk.kid, jku: 'https://evil.invalid/jwks' })), null)
  assert.equal(h.calls.length, 0)
})

test('issuer, audience, azp et type de jeton testes et refuses', async () => {
  for (const override of [
    { iss: 'https://evil.invalid/realms/lab' }, { aud: 'account' },
    { azp: 'other-client' }, { typ: 'ID' }, { sub: '' }, { sub: 'admin\nroot' }
  ]) {
    const h = harness()
    assert.equal(await h.verify(token({ ...claims(), ...override })), null)
  }
})

test('JWT expire, nbf futur, iat futur, duree de vie excessive ou missing iat refuses', async () => {
  for (const override of [
    { exp: now() - 100 }, { nbf: now() + 1000 }, { iat: now() + 1000 },
    { iat: now() - 4000 }, { iat: undefined }
  ]) {
    const h = harness()
    assert.equal(await h.verify(token({ ...claims(), ...override })), null)
  }
})

test('keycloak desactive et URLs non canonique refuses a la construction', () => {
  const h = harness()
  for (const invalid of [
    { enabled: false }, { issuer: 'http://127.0.0.1:8444/realms/vevedh-lab' },
    { issuer: `${issuer}?x=1` }, { issuer: 'https://evil.invalid/a' },
    { issuer: 'https://user:secret@127.0.0.1:8444/realms/vevedh-lab' },
    { audience: '' }, { authorizedParty: 'x y' }, { clockToleranceSeconds: 60 }
  ]) assert.throws(() => createKeycloakAccessTokenVerifier({ ...h.options, ...invalid }))
})

test('discovery issuer ou JWKS URI divergents refuses', async () => {
  for (const discovery of [{ issuer: 'https://evil.invalid' }, { jwks_uri: 'https://evil.invalid/jwks' }]) {
    const h = harness({ discovery })
    assert.equal(await h.verify(token()), null)
    assert.equal(h.calls.length, 1)
  }
})

test('JWKS cle privee, alg interdit, duplicate kid et vide refuses', async () => {
  const invalid = [
    { keys: [{ ...publicJwk, d: 'secret' }] },
    { keys: [{ ...publicJwk, alg: 'HS256' }] },
    { keys: [{ ...publicJwk }, { ...publicJwk }] },
    { keys: [] },
    { keys: [{ ...publicJwk, use: 'enc' }] },
    { keys: [{ ...publicJwk, n: 'AQAB' }] },
  ]
  for (const jwks of invalid) assert.equal(await harness({ jwks }).verify(token()), null)
})

test('rotation JWKS inconnue : nouveau kid force un seul refresh apres cooldown', async () => {
  const before = Date.now
  let time = before()
  try {
    Date.now = () => time
    const second = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const rotated = { ...second.publicKey.export({ format: 'jwk' }), kid: 'rotated-kid', kty: 'RSA', alg: 'RS256', use: 'sig' }
    const jwks = { keys: [publicJwk] }
    const h = harness({ jwks })
    assert.ok(await h.verify(token()))
    jwks.keys = [rotated]
    time += 16000
    assert.deepEqual(await h.verify(token(claims(), { alg: 'RS256', typ: 'JWT', kid: 'rotated-kid' }, second.privateKey)), { subject: sub, roles: ['viewer'] })
    assert.equal(h.calls.length, 4)
  } finally { Date.now = before }
})

test('un kid inconnu ne force pas des requetes a repetition', async () => {
  const h = harness()
  const unknown = token(claims(), { alg: 'RS256', kid: 'other-kid' })
  assert.equal(await h.verify(unknown), null)
  assert.equal(await h.verify(unknown), null)
  assert.equal(h.calls.length, 2)
})

test('identite suspendue ou loader en erreur refuse et aucune exception divulguee', async () => {
  assert.equal(await harness({ user: null }).verify(token()), null)
  assert.equal(await harness({ user: { subject: sub, roles: ['admin', 'bad role'] } }).verify(token()), null)
  const h = harness()
  assert.equal(await createKeycloakAccessTokenVerifier({ ...h.options, resolvePrincipal: async () => { throw Error('DB_PRIVATE_ERROR') } })(token()), null)
})

test('jeton contrefait, segments malformes et surcharge refuses sans requetes', async () => {
  const h = harness()
  for (const candidate of ['', 'bad', 'a.b.c', `${'a'.repeat(8200)}.b.c`, token().replaceAll('.', '..')]) assert.equal(await h.verify(candidate), null)
  assert.equal(h.calls.length, 0)
})

test('strategie Feathers refuse la production de JWT local et exige parseStrategies explicite', () => {
  const h = harness(); const strategy = new FeathersKeycloakStrategy(h.options)
  assert.doesNotThrow(() => strategy.setAuthentication({ configuration: { entity: 'user', authStrategies: ['jwt', 'local'], parseStrategies: ['keycloak', 'jwt'] } }))
  assert.throws(() => strategy.setAuthentication({ configuration: { entity: 'user', authStrategies: ['jwt'], parseStrategies: ['jwt', 'keycloak'] } }))
  assert.throws(() => strategy.setAuthentication({ configuration: { entity: 'user', authStrategies: ['jwt', 'keycloak'], parseStrategies: ['keycloak'] } }))
  assert.throws(() => strategy.setAuthentication({ configuration: { entity: 'user', authStrategies: ['jwt'], parseStrategies: ['jwt'] } }))
  assert.throws(() => strategy.setAuthentication({ configuration: { entity: null, authStrategies: ['jwt'], parseStrategies: ['keycloak'] } }))
})

test('REST parse extrait uniquement un Bearer et refuse doublons / schémas concurrents', () => {
  const strategy = new FeathersKeycloakStrategy(harness().options)
  const accessToken = token()
  assert.deepEqual(strategy.parse({ headers: { authorization: `Bearer ${accessToken}` }, rawHeaders: ['Authorization', `Bearer ${accessToken}`] }), { strategy: 'keycloak', accessToken })
  assert.equal(strategy.parse({ headers: {} }), null)
  assert.equal(strategy.parse({ headers: { authorization: `Bearer ${token(claims(), { typ: 'access', alg: 'HS256', kid: 'local' })}` } }), null)
  assert.throws(() => strategy.parse({ headers: { authorization: `Basic ${accessToken}` } }), KeycloakNotAuthenticatedError)
  assert.throws(() => strategy.parse({ headers: { authorization: `Bearer ${accessToken}` }, rawHeaders: ['Authorization', 'x', 'authorization', 'y'] }), KeycloakNotAuthenticatedError)
})

test('Socket.IO metadata authentification keycloak validees sans requete HTTP', async () => {
  const strategy = new FeathersKeycloakStrategy(harness().options)
  const result = await strategy.authenticate({ strategy: 'keycloak', accessToken: token() })
  assert.deepEqual(result, { authentication: { strategy: 'keycloak' }, user: { id: sub, roles: ['viewer'] } })
  await assert.rejects(strategy.authenticate({ strategy: 'keycloak', accessToken: token(), user: { roles: ['admin'] } }), { code: 401 })
  await assert.rejects(strategy.authenticate({ strategy: 'jwt', accessToken: token() }), { code: 401 })
  await assert.rejects(strategy.authenticate({ strategy: 'keycloak', accessToken: 'invalid' }), { code: 401 })
})

test('createFeathersKeycloakVerifier a meme contrat que VerifiedTokenResolver pour RBAC existant', async () => {
  const h = harness()
  const verify = createFeathersKeycloakVerifier(h.options)
  assert.deepEqual(await verify(token(), { path: 'notes', method: 'find' }), { subject: sub, roles: ['viewer'] })
})



test('WebCrypto refuse une signature altérée sans altérer le tampon original', async () => {
  const signed = token()
  const h = harness()
  assert.ok(await h.verify(signed))
  const parts = signed.split('.')
  const bytes = Buffer.from(parts[2], 'base64url')
  bytes[bytes.length - 1] ^= 0x01
  const altered = `${parts[0]}.${parts[1]}.${bytes.toString('base64url')}`
  assert.equal(await h.verify(altered), null)
})


// R14-A2.3-R2.4: real Keycloak-style profile, independently generated keys.
const encryptionPair = generateKeyPairSync('rsa', { modulusLength: 2048 })
const encryptionJwk = { ...encryptionPair.publicKey.export({ format: 'jwk' }), kid: 'local-enc-1', kty: 'RSA', alg: 'RSA-OAEP', use: 'enc' }
function withoutNbf() { const { nbf, ...rest } = claims(); return rest }

test('R2.4: absent nbf alone is accepted on a signed access token', async () => {
  assert.deepEqual(await harness().verify(token(withoutNbf())), { subject: sub, roles: ['viewer'] })
})
test('R2.4: mixed public JWKS alone is accepted; encryption key is not used', async () => {
  for (const keys of [[encryptionJwk, publicJwk], [publicJwk, encryptionJwk]]) {
    const h = harness({jwks:{keys}})
    assert.ok(await h.verify(token()))
    assert.equal(await h.verify(token(claims(), {alg:'RS256',typ:'JWT',kid:encryptionJwk.kid}, encryptionPair.privateKey)), null)
  }
})
test('R2.4: combined real profile (mixed JWKS, optional nbf, array audience)', async () => {
  const h = harness({jwks:{keys:[encryptionJwk,publicJwk]}})
  assert.deepEqual(await h.verify(token({...withoutNbf(),aud:['account',audience]})), { subject: sub, roles: ['viewer'] })
})
test('R2.4: present nbf must be a valid integer, nonfuture and no later than exp', async () => {
  for (const nbf of [null, '0', false, [], {}, 0, -1, 1.25, now()+60, 4102444801]) {
    assert.equal(await harness().verify(token({...claims(),nbf})),null)
  }
  assert.equal(await harness().verify(token({...claims(),exp:now()+1,nbf:now()+2})),null)
})
test('R2.4: missing nbf does not bypass iat exp audience azp issuer type or account checks', async () => {
  for (const override of [{iat:undefined},{exp:undefined},{exp:now()-100},{iat:now()-4000},{aud:'account'},{azp:'wrong'},{iss:'https://wrong.invalid/realms/lab'},{typ:'ID'},{sub:'other'}]) {
    assert.equal(await harness({jwks:{keys:[encryptionJwk,publicJwk]}}).verify(token({...withoutNbf(),...override})),null)
  }
  assert.equal(await harness({user:null,jwks:{keys:[encryptionJwk,publicJwk]}}).verify(token(withoutNbf())),null)
})
test('R2.4: duplicates across signing and encryption, private members and malformed encryption keys refused', async () => {
  for (const extra of [{...encryptionJwk,kid:publicJwk.kid},{...encryptionJwk,d:'secret'},{...encryptionJwk,k:'secret'},{...encryptionJwk,n:'AQAB'},{...encryptionJwk,alg:'HS256'},{...encryptionJwk,alg:'RS256'},{...encryptionJwk,key_ops:['verify']},{...encryptionJwk,key_ops:['encrypt','encrypt']},{...encryptionJwk,kid:undefined}]) {
    assert.equal(await harness({jwks:{keys:[publicJwk,extra]}}).verify(token(withoutNbf())),null)
  }
  assert.equal(await harness({jwks:{keys:[publicJwk,encryptionJwk,encryptionJwk]}}).verify(token(withoutNbf())),null)
  assert.equal(await harness({jwks:{keys:[encryptionJwk]}}).verify(token(withoutNbf())),null)
})
test('R2.4: wrong signature with valid signing kid is refused in mixed JWKS', async () => {
  assert.equal(await harness({jwks:{keys:[encryptionJwk,publicJwk]}}).verify(token(withoutNbf(),{alg:'RS256',typ:'JWT',kid:publicJwk.kid},encryptionPair.privateKey)),null)
})
