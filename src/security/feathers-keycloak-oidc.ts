/**
 * R14-A2.2: opt-in Keycloak access-token validation for FeathersJS v5.
 * Uses WebCrypto RS256 and fetch available in Node >=22.12, without secrets.
 * Does not implement OAuth login or mint/refresh a Feathers token.
 * Do not derive privileges from Keycloak claims: resolve them server-side.
 */

export interface KeycloakTrustedPrincipal {
  readonly subject: string
  readonly roles: readonly string[]
}

export interface KeycloakOidcOptions {
  readonly enabled: true
  /** Canonical OIDC issuer, e.g. https://127.0.0.1:8444/realms/vevedh-lab */
  readonly issuer: string
  /** Dedicated API resource audience; not an SPA ID token audience. */
  readonly audience: string
  /** The OIDC client allowed to obtain access tokens for this API (azp). */
  readonly authorizedParty: string
  /** Trusted database lookup, including status / disable / tenant checks. */
  readonly resolvePrincipal: (subject: string) => Promise<KeycloakTrustedPrincipal | null>
  /** Only for tests; production must use default TLS-validating global fetch. */
  readonly fetchImpl?: typeof fetch
  readonly cacheTtlMs?: number
  readonly requestTimeoutMs?: number
  readonly clockToleranceSeconds?: number
  readonly maxTokenLifetimeSeconds?: number
}

export class KeycloakNotAuthenticatedError extends Error {
  readonly code = 401
  readonly className = 'not-authenticated'
  readonly data = undefined
  constructor() {
    super('Not authenticated')
    this.name = 'NotAuthenticated'
  }
}

interface KeycloakJwtHeader {
  readonly alg: 'RS256'
  readonly kid: string
}
interface RsaPublicJwk {
  readonly kty: 'RSA'
  readonly n: string
  readonly e: string
  readonly kid: string
  readonly use?: 'sig'
  readonly alg?: 'RS256'
  readonly key_ops?: readonly string[]
}
/** Use the installed Node WebCrypto return type, without DOM globals. */
type ImportedVerificationKey = Awaited<ReturnType<typeof globalThis.crypto.subtle.importKey>>

interface KeySet {
  readonly keys: ReadonlyMap<string, ImportedVerificationKey>
  readonly expiry: number
}

const ENCODED = /^[A-Za-z0-9_-]+$/
const KID = /^[A-Za-z0-9._-]{1,128}$/
const CLIENT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SUBJECT = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/
const ROLE = /^[a-z][a-z0-9:_-]{0,63}$/
const ACCESS_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const PRIVATE_JWK_FIELDS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k'] as const
const MAX_JSON_BYTES = 65536

function object(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null ? value as Record<string, unknown> : null
}

function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}

function canonicalIssuer(value: string): string {
  if (typeof value !== 'string' || value.length > 1024 || /[\s\\\u0000-\u001f]/.test(value) || /%[0-9a-f]{2}/i.test(value)) throw new TypeError('Invalid issuer')
  let url: URL
  try { url = new URL(value) } catch { throw new TypeError('Invalid issuer') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !/^\/realms\/[A-Za-z0-9_-]{1,64}$/.test(url.pathname) || url.href !== value ||
      url.hostname.length > 253) throw new TypeError('Invalid issuer')
  return url.href
}

function base64url(value: string, maxBytes: number): Uint8Array {
  if (!ENCODED.test(value) || value.length > Math.ceil(maxBytes * 4 / 3) + 4 || value.length % 4 === 1) throw new KeycloakNotAuthenticatedError()
  try {
    const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4))
    if (raw.length > maxBytes) throw new KeycloakNotAuthenticatedError()
    const bytes = Uint8Array.from(raw, char => char.charCodeAt(0))
    // Reject non-canonical base64 encodings (ambiguous signatures / keys).
    const canonical = btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    if (canonical !== value) throw new KeycloakNotAuthenticatedError()
    return bytes
  } catch { throw new KeycloakNotAuthenticatedError() }
}

function parseJson(bytes: Uint8Array): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    const record = object(parsed)
    if (record === null) throw new Error('Bad JSON')
    return record
  } catch { throw new KeycloakNotAuthenticatedError() }
}

/** Keycloak also publishes RSA encryption keys. Never import them for signature verification. */
function validPublicEncryptionKey(value: Record<string, unknown>): boolean {
  if (value['use'] !== 'enc' || value['kty'] !== 'RSA' ||
      typeof value['alg'] !== 'string' || !['RSA-OAEP', 'RSA-OAEP-256', 'RSA-OAEP-384', 'RSA-OAEP-512'].includes(value['alg']) ||
      (value['key_ops'] !== undefined && (!Array.isArray(value['key_ops']) || value['key_ops'].length === 0 ||
        new Set(value['key_ops']).size !== value['key_ops'].length ||
        !value['key_ops'].every(op => op === 'encrypt' || op === 'wrapKey'))) ||
      typeof value['n'] !== 'string' || typeof value['e'] !== 'string') return false
  try {
    return base64url(value['n'], 1024).length >= 256 &&
      base64url(value['e'], 8).length === 3 && value['e'] === 'AQAB'
  } catch { return false }
}

function validPublicRsaKey(value: unknown): value is RsaPublicJwk {
  const key = object(value)
  if (!key || key['kty'] !== 'RSA' || typeof key['kid'] !== 'string' || !KID.test(key['kid']) ||
      typeof key['n'] !== 'string' || typeof key['e'] !== 'string' ||
      (key['use'] !== undefined && key['use'] !== 'sig') ||
      (key['alg'] !== undefined && key['alg'] !== 'RS256') ||
      (key['key_ops'] !== undefined && (!Array.isArray(key['key_ops']) || key['key_ops'].length !== 1 || key['key_ops'][0] !== 'verify')) ||
      PRIVATE_JWK_FIELDS.some(field => Object.hasOwn(key, field))) return false
  try {
    return base64url(key['n'], 1024).length >= 256 &&
      base64url(key['e'], 8).length === 3 && key['e'] === 'AQAB'
  } catch { return false }
}

async function limitedJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok || response.status !== 200 || response.redirected) throw new KeycloakNotAuthenticatedError()
  const reader = response.body?.getReader()
  if (!reader) throw new KeycloakNotAuthenticatedError()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > MAX_JSON_BYTES) throw new KeycloakNotAuthenticatedError()
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return parseJson(bytes)
}

function arrayAudience(value: unknown, expected: string): boolean {
  return value === expected ||
    (Array.isArray(value) && value.length > 0 && value.length <= 16 && value.every(aud => typeof aud === 'string') && value.includes(expected))
}

function snapshotPrincipal(value: unknown, subject: string): KeycloakTrustedPrincipal | null {
  const principal = object(value)
  if (!principal || principal['subject'] !== subject || !Array.isArray(principal['roles']) || principal['roles'].length > 32) return null
  const roles = principal['roles']
  if (!roles.every(role => typeof role === 'string' && ROLE.test(role)) || new Set(roles).size !== roles.length) return null
  return Object.freeze({ subject, roles: Object.freeze([...roles] as string[]) })
}

function verifyTimes(claims: Record<string, unknown>, options: Required<Pick<KeycloakOidcOptions, 'clockToleranceSeconds' | 'maxTokenLifetimeSeconds'>>): boolean {
  const now = Math.floor(Date.now() / 1000)
  const { clockToleranceSeconds: skew, maxTokenLifetimeSeconds: max } = options
  const { exp, nbf, iat } = claims
  if (!integer(exp, 1, 4102444800) || !integer(iat, 1, 4102444800)) return false
  if (exp <= now - skew || iat > now + skew) return false
  // RFC 7519 §4.1.5: nbf is optional. An explicitly present claim must be valid.
  if (Object.hasOwn(claims, 'nbf') && (!integer(nbf, 1, 4102444800) || nbf > now + skew || nbf > exp)) return false
  return exp > iat && exp - iat <= max
}

/** Independent verifier: no JWT payload is trusted before signature verification. */
export function createKeycloakAccessTokenVerifier(options: KeycloakOidcOptions): (accessToken: string) => Promise<KeycloakTrustedPrincipal | null> {
  if (!options || options.enabled !== true || typeof options.resolvePrincipal !== 'function') throw new TypeError('Keycloak opt-in and trusted principal loader required')
  const issuer = canonicalIssuer(options.issuer)
  if (!CLIENT.test(options.audience) || !CLIENT.test(options.authorizedParty)) throw new TypeError('Invalid Keycloak audience or azp')
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') throw new TypeError('HTTPS fetch required')
  const ttl = options.cacheTtlMs ?? 60000
  const timeout = options.requestTimeoutMs ?? 5000
  const skew = options.clockToleranceSeconds ?? 10
  const maxLifetime = options.maxTokenLifetimeSeconds ?? 3600
  if (!integer(ttl, 500, 300000) || !integer(timeout, 100, 15000) || !integer(skew, 0, 30) || !integer(maxLifetime, 30, 3600)) throw new TypeError('Invalid Keycloak safety limits')
  const jwksUri = `${issuer}/protocol/openid-connect/certs`
  const discoveryUri = `${issuer}/.well-known/openid-configuration`
  let cache: KeySet | undefined
  let loading: Promise<KeySet> | undefined
  let lastRefresh = 0
  const download = async (url: string): Promise<Record<string, unknown>> => {
    try {
      const response = await fetchImpl(url, { method: 'GET', redirect: 'error', headers: { accept: 'application/json', 'cache-control': 'no-store' }, signal: AbortSignal.timeout(timeout) })
      if (response.url && response.url !== url) throw new KeycloakNotAuthenticatedError()
      return await limitedJson(response)
    } catch { throw new KeycloakNotAuthenticatedError() }
  }
  async function fetchKeys(): Promise<KeySet> {
    const discovery = await download(discoveryUri)
    if (discovery['issuer'] !== issuer || discovery['jwks_uri'] !== jwksUri) throw new KeycloakNotAuthenticatedError()
    const jwks = await download(jwksUri)
    const keys = jwks['keys']
    if (!Array.isArray(keys) || keys.length === 0 || keys.length > 16) throw new KeycloakNotAuthenticatedError()
    const trusted = new Map<string, ImportedVerificationKey>()
    const seen = new Set<string>()
    for (const item of keys) {
      const record = object(item)
      // Validate the entire collection, including keys that will not be imported.
      if (!record || typeof record['kid'] !== 'string' || !KID.test(record['kid']) ||
          seen.has(record['kid']) || PRIVATE_JWK_FIELDS.some(field => Object.hasOwn(record, field))) throw new KeycloakNotAuthenticatedError()
      seen.add(record['kid'])
      if (record['use'] === 'enc') {
        if (!validPublicEncryptionKey(record)) throw new KeycloakNotAuthenticatedError()
        continue
      }
      if (!validPublicRsaKey(item)) throw new KeycloakNotAuthenticatedError()
      try {
        const key = await globalThis.crypto.subtle.importKey('jwk', {
          kty: 'RSA', n: item.n, e: item.e, alg: 'RS256', ext: true, key_ops: ['verify']
        }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
        trusted.set(item.kid, key)
      } catch { throw new KeycloakNotAuthenticatedError() }
    }
    if (trusted.size === 0) throw new KeycloakNotAuthenticatedError()
    return { keys: trusted, expiry: Date.now() + ttl }
  }
  async function getKeys(force = false): Promise<KeySet> {
    if (!force && cache && cache.expiry > Date.now()) return cache
    if (!loading) {
      lastRefresh = Date.now()
      loading = fetchKeys().then(value => { cache = value; return value }).finally(() => { loading = undefined })
    }
    return loading
  }
  return async accessToken => {
    try {
      if (typeof accessToken !== 'string' || accessToken.length > 8192 || !ACCESS_TOKEN.test(accessToken)) return null
      const parts = accessToken.split('.')
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null
      const header = parseJson(base64url(parts[0], 2048))
      const candidate = object(header)
      if (!candidate || candidate['alg'] !== 'RS256' || typeof candidate['kid'] !== 'string' || !KID.test(candidate['kid']) ||
          (candidate['typ'] !== undefined && candidate['typ'] !== 'JWT') || candidate['crit'] !== undefined || candidate['jku'] !== undefined || candidate['x5u'] !== undefined) return null
      const typedHeader: KeycloakJwtHeader = { alg: 'RS256', kid: candidate['kid'] }
      const claims = parseJson(base64url(parts[1], 8192))
      const signature = base64url(parts[2], 1024)
      let keys = await getKeys()
      let key = keys.keys.get(typedHeader.kid)
      // Permit genuine key rotation but cap unknown-kid forced refreshes.
      if (!key && Date.now() - lastRefresh >= 15000) {
        keys = await getKeys(true)
        key = keys.keys.get(typedHeader.kid)
      }
      if (!key) return null
      const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
      // WebCrypto in TS 5.9+ requires ArrayBuffer-backed BufferSource.
      // Uint8Array.from creates a fresh ArrayBuffer rather than a potentially
      // SharedArrayBuffer-backed view received from an untrusted decoder.
      const signatureBuffer = Uint8Array.from(signature)
      const signingInputBuffer = Uint8Array.from(signingInput)
      if (!await globalThis.crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signatureBuffer, signingInputBuffer)) return null
      if (claims['iss'] !== issuer || !arrayAudience(claims['aud'], options.audience) || claims['azp'] !== options.authorizedParty ||
          claims['typ'] !== 'Bearer' || typeof claims['sub'] !== 'string' || !SUBJECT.test(claims['sub']) ||
          !verifyTimes(claims, { clockToleranceSeconds: skew, maxTokenLifetimeSeconds: maxLifetime })) return null
      const principal = await options.resolvePrincipal(claims['sub'])
      return snapshotPrincipal(principal, claims['sub'])
    } catch { return null }
  }
}

/** Shape-compatible with VerifiedTokenResolver from feathers-rbac.ts. */
export function createFeathersKeycloakVerifier(options: KeycloakOidcOptions): (accessToken: string) => Promise<KeycloakTrustedPrincipal | null> {
  return createKeycloakAccessTokenVerifier(options)
}

/**
 * Optional Feathers v5 AuthenticationService strategy. Register as `keycloak`.
 * `keycloak` MUST be in parseStrategies and MUST NOT be in authStrategies:
 * authentication.create() would otherwise mint an unintended local JWT.
 */
export class FeathersKeycloakStrategy {
  private readonly verify: ReturnType<typeof createKeycloakAccessTokenVerifier>
  constructor(options: KeycloakOidcOptions) { this.verify = createKeycloakAccessTokenVerifier(options) }
  setAuthentication(service: { readonly configuration: unknown }): void {
    const settings = object(service?.configuration)
    if (!settings || !Array.isArray(settings['authStrategies']) || settings['authStrategies'].includes('keycloak') ||
        !Array.isArray(settings['parseStrategies']) || !settings['parseStrategies'].includes('keycloak') ||
        (settings['parseStrategies'].includes('jwt') && settings['parseStrategies'].indexOf('keycloak') > settings['parseStrategies'].indexOf('jwt')) ||
        settings['entity'] !== 'user') throw new TypeError('Unsafe Feathers Keycloak authentication configuration')
  }
  parse(request: { readonly headers?: Record<string, unknown>; readonly rawHeaders?: readonly string[] }): { strategy: 'keycloak'; accessToken: string } | null {
    const headers = object(request?.headers)
    const authorization = headers?.['authorization']
    if (authorization === undefined) return null
    if (typeof authorization !== 'string' || authorization.length > 8200) throw new KeycloakNotAuthenticatedError()
    const raw = request.rawHeaders
    if (raw && (!Array.isArray(raw) || raw.filter((value, index) => index % 2 === 0 && typeof value === 'string' && value.toLowerCase() === 'authorization').length !== 1)) throw new KeycloakNotAuthenticatedError()
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(authorization)
    if (!match || !match[1]) throw new KeycloakNotAuthenticatedError()
    // `jwt` and `keycloak` both parse Bearer. Route only Keycloak RS256/JWT
    // candidates here; local Feathers `typ=access` falls through to `jwt`.
    // The JOSE header is an untrusted routing hint, NEVER authentication.
    let header: Record<string, unknown>
    try { header = parseJson(base64url(match[1].split('.')[0] ?? '', 2048)) }
    catch { return null }
    if (header['typ'] !== 'JWT' || header['alg'] !== 'RS256') return null
    return { strategy: 'keycloak', accessToken: match[1] }
  }
  async authenticate(data: unknown): Promise<{ authentication: { strategy: 'keycloak' }; user: { id: string; roles: readonly string[] } }> {
    const fields = object(data)
    if (!fields || Reflect.ownKeys(fields).length !== 2 || fields['strategy'] !== 'keycloak' ||
        typeof fields['accessToken'] !== 'string') throw new KeycloakNotAuthenticatedError()
    const principal = await this.verify(fields['accessToken'])
    if (!principal) throw new KeycloakNotAuthenticatedError()
    return { authentication: { strategy: 'keycloak' }, user: { id: principal.subject, roles: principal.roles } }
  }
}
