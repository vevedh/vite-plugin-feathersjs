import { isIP } from 'node:net'
import { join } from 'node:path'
import { emit, localPath, parseFlags, readSafeJson } from './command-safety.mjs'

const PROVIDERS = new Set(['oauth2','oidc','keycloak'])
const UNSAFE_HOST = /^(?:localhost|.*\.localhost|.*\.local|.*\.internal)$/i
function issuerUrl(value, provider) {
  if (typeof value !== 'string' || value.length > 1024 || /[\s\\\u0000-\u001f]/.test(value) || /%[0-9a-f]{2}/i.test(value)) throw new Error('INVALID_ISSUER')
  let url
  try { url = new URL(value) } catch { throw new Error('INVALID_ISSUER') }
  const host = url.hostname.toLowerCase()
  // Read-only plans never contact this URL, but reject predictable unsafe destinations.
  if (url.protocol !== 'https:' || !host || isIP(host.replace(/^\[/, '').replace(/\]$/, '')) !== 0 || UNSAFE_HOST.test(host) || host === '0.0.0.0' ||
    host === '127.0.0.1' || host === '[::1]' || /^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    url.username || url.password || url.search || url.hash || url.port && url.port !== '443' ||
    !/^[a-z0-9.\-\[\]:]+$/i.test(host) || url.pathname.includes('..') || /%[0-9a-f]{2}/i.test(url.pathname)) throw new Error('UNSAFE_ISSUER')
  if (provider === 'keycloak' && !/^\/realms\/[a-zA-Z0-9_-]{1,64}\/?$/.test(url.pathname)) throw new Error('KEYCLOAK_REALM_ISSUER_REQUIRED')
  return url.origin + (url.pathname === '/' ? '' : url.pathname.replace(/\/$/, ''))
}
export function planAuth(flags) {
  const provider = flags.get('--provider')
  if (!PROVIDERS.has(provider)) throw new Error('UNSUPPORTED_AUTH_PROVIDER')
  const issuer = issuerUrl(flags.get('--issuer'), provider)
  const clientId = flags.get('--client-id')
  if (typeof clientId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(clientId)) throw new Error('INVALID_CLIENT_ID')
  const redirect = flags.get('--redirect-uri')
  if (redirect !== undefined) {
    let url
    try { url = new URL(redirect) } catch { throw new Error('INVALID_REDIRECT_URI') }
    const local = (url.hostname === '127.0.0.1' || url.hostname === '[::1]') && url.protocol === 'http:'
    if ((!local && url.protocol !== 'https:') || url.username || url.password || url.hash || url.search || !url.pathname.startsWith('/') || redirect.length > 512) throw new Error('INVALID_REDIRECT_URI')
  }
  return {
    status: 'AUTH_PLAN_ONLY',
    message: `Provider ${provider}: configuration only; no authentication strategy installed`,
    provider, issuer, clientId,
    ...(redirect === undefined ? {} : { redirectUri: redirect }),
    protocol: provider === 'oauth2' ? 'OAuth 2.0 (authorization, NOT identity)' : 'OpenID Connect',
    requirements: ['server-side issuer and audience validation', 'trusted JWKS and algorithm allowlist', 'state, nonce (OIDC), PKCE S256', 'short-lived access tokens and session revocation', 'server-side RBAC with external REST and Socket.IO tests'],
    identityReady: false, runtimeReady: false, secretsStored: false,
  }
}
export function inspectAuth(flags, cwd) {
  const root = localPath(cwd, flags.get('--project') || '.', {allowRoot:true})
  const profile = readSafeJson(join(root, 'api/config/profile.json'))
  // Deliberately emit only fixed, non-secret fields; no claims, tokens, usernames or endpoints.
  const identity = typeof profile.auth === 'string' && /^(none|jwt|oauth2|oidc|keycloak)$/.test(profile.auth) ? profile.auth : 'unknown'
  return { status: 'AUTH_INSPECT_ONLY', message: 'Read-only profile inspection; no runtime readiness claim', profileAuth: identity, runtimeReady: false, secretsStored: false }
}
export async function runAuthCommand(args, cwd = process.cwd()) {
  const action = args[0]
  if (action === 'add') throw new Error('AUTH_ADD_BLOCKED_PENDING_RUNTIME_CERTIFICATION')
  if (action !== 'plan' && action !== 'inspect') throw new Error('USE_AUTH_PLAN_OR_INSPECT')
  const allowed = action === 'plan' ? new Set(['--provider','--issuer','--client-id','--redirect-uri','--json']) : new Set(['--project','--json'])
  const flags = parseFlags(args.slice(1), allowed)
  const result = action === 'plan' ? planAuth(flags) : inspectAuth(flags, cwd)
  emit(result, flags.has('--json'))
  return result
}
