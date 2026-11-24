/**
 * R14-A2.2-R5: opt-in Feathers v5 REST + Socket.IO transport bridge for Keycloak.
 * The host MUST register a real Feathers AuthenticationService beforehand.
 * No URL/query token, no browser-supplied role, no Feathers JWT minting.
 */
import { Forbidden, NotAuthenticated } from '@feathersjs/errors'
import { createRbacAuthorizer, RbacForbiddenError, type RbacPolicyInput, type TrustedPrincipal } from './rbac-policy.js'
import {
  FeathersKeycloakStrategy,
  type KeycloakOidcOptions,
} from './feathers-keycloak-oidc.js'

const PATH = /^[a-z][a-z0-9_-]*(?:\/[a-z][a-z0-9_-]*)*$/
const TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const ROLE = /^[a-z][a-z0-9:_-]{0,63}$/
const SUBJECT = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/
const SESSION_PATH = 'keycloak-session'

export interface KeycloakTransportHost {
  get(name: string): unknown
  set(name: string, value: unknown): unknown
  service(path: string): unknown
  use(path: string, service: object, options: { methods: string[]; events: string[] }): unknown
  on(event: string, listener: (...args: unknown[]) => void): unknown
}

export interface KeycloakServiceHookContext {
  readonly path: string
  readonly method: string
  readonly params: unknown
}

interface AuthenticationGateway {
  readonly configuration: unknown
  register(name: string, strategy: FeathersKeycloakStrategy): unknown
  authenticate(data: { strategy: 'keycloak'; accessToken: string }, params: object, ...strategies: ['keycloak']): Promise<unknown>
  getStrategy?(name: string): unknown
}

interface ProtectedService {
  hooks(value: { before: { all: Array<(context: KeycloakServiceHookContext) => Promise<void>> } }): unknown
}

export interface KeycloakTransportOptions {
  readonly oidc: KeycloakOidcOptions
  /** Every protected service/method must have an explicit RBAC policy. */
  readonly policies: RbacPolicyInput
}

export interface KeycloakTransportBridge {
  /** Call from FeathersPluginOptions.configure, after registering host auth service. */
  configure(app: KeycloakTransportHost): void
  /** Call from FeathersPluginOptions.afterRegister after the service is registered. */
  protect(app: KeycloakTransportHost, servicePath: string): void
}

function own(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const proto: unknown = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return null
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string') || Object.values(descriptors).some(item => !('value' in item))) return null
  return value as Record<string, unknown>
}

function field(value: unknown, key: string): unknown {
  if (value === null || typeof value !== 'object') return undefined
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor || !('value' in descriptor)) return undefined
  return descriptor.value as unknown
}

function ensureAuthService(value: unknown): AuthenticationGateway {
  if (value === null || typeof value !== 'object') throw new TypeError('Existing Feathers AuthenticationService required')
  const candidate = value as Partial<AuthenticationGateway>
  if (typeof candidate.register !== 'function' || typeof candidate.authenticate !== 'function') {
    throw new TypeError('Existing Feathers AuthenticationService required')
  }
  return value as AuthenticationGateway
}

function principalFromAuthResult(result: unknown): TrustedPrincipal | null {
  const user = own(field(result, 'user'))
  if (!user || typeof user['id'] !== 'string' || !SUBJECT.test(user['id']) || !Array.isArray(user['roles']) || user['roles'].length > 32) return null
  const roles: unknown[] = user['roles']
  if (!roles.every(role => typeof role === 'string' && ROLE.test(role)) || new Set(roles).size !== roles.length) return null
  return Object.freeze({ subject: user['id'], roles: Object.freeze([...roles] as string[]) })
}

function connectionFrom(params: unknown): object | null {
  const connection = field(params, 'connection')
  if (!connection || typeof connection !== 'object' || Array.isArray(connection)) return null
  return connection
}

function tokenFromRest(params: unknown, strategy: FeathersKeycloakStrategy): string | null {
  const headers = field(params, 'headers')
  if (!own(headers)) return null
  const auth = field(headers, 'authorization')
  const alt = field(headers, 'Authorization')
  if (auth !== undefined && alt !== undefined) return null
  const value = auth ?? alt
  if (typeof value !== 'string' || value.length > 8200) return null
  // Reject a comma-joined authorization header and any non-Bearer scheme.
  const parsed = strategy.parse({ headers: { authorization: value } })
  return parsed?.accessToken ?? null
}

function credential(value: unknown): string | null {
  const data = own(value)
  if (!data || Reflect.ownKeys(data).length !== 2 || data['strategy'] !== 'keycloak' || typeof data['accessToken'] !== 'string') return null
  return data['accessToken'].length <= 8192 && TOKEN.test(data['accessToken']) ? data['accessToken'] : null
}

/** Deny by default; the bridge never reads roles from transport-supplied params. */
export function createKeycloakTransportBridge(options: KeycloakTransportOptions): KeycloakTransportBridge {
  if (!options || !options.oidc || options.oidc.enabled !== true || !options.policies) throw new TypeError('Keycloak opt-in and RBAC policy required')
  const strategy = new FeathersKeycloakStrategy(options.oidc)
  // Compile the RBAC policy before any host mutations.
  const verified = new WeakMap<object, TrustedPrincipal>()
  const authorize = createRbacAuthorizer<KeycloakServiceHookContext>(options.policies, context => verified.get(context) ?? null)
  const sockets = new WeakMap<object, string>()
  const configured = new WeakMap<object, AuthenticationGateway>()
  const protectedServices = new WeakSet<object>()

  function authenticate(auth: AuthenticationGateway, accessToken: string): Promise<TrustedPrincipal | null> {
    return auth.authenticate({ strategy: 'keycloak', accessToken }, {}, 'keycloak')
      .then(principalFromAuthResult, () => null)
  }

  return Object.freeze({
    configure(app: KeycloakTransportHost): void {
      if (!app || typeof app.get !== 'function' || typeof app.set !== 'function' || typeof app.service !== 'function' ||
          typeof app.use !== 'function' || typeof app.on !== 'function' || configured.has(app)) {
        throw new TypeError('Invalid or already configured Feathers application')
      }
      const auth = ensureAuthService(app.service('authentication'))
      const configuration = own(app.get('authentication'))
      if (!configuration || configuration['entity'] !== 'user' || !Array.isArray(configuration['authStrategies']) ||
          configuration['authStrategies'].includes('keycloak') || configuration['authStrategies'].length === 0 ||
          !configuration['authStrategies'].every(name => typeof name === 'string') ||
          (configuration['parseStrategies'] !== undefined && (!Array.isArray(configuration['parseStrategies']) ||
            !configuration['parseStrategies'].every(name => typeof name === 'string')))) {
        throw new TypeError('Unsafe authentication configuration')
      }
      const existing = configuration['parseStrategies'] ?? configuration['authStrategies']
      if (!Array.isArray(existing) || existing.includes('keycloak')) throw new TypeError('Keycloak authentication already configured')
      if (typeof auth.getStrategy === 'function' && auth.getStrategy('keycloak')) throw new TypeError('Keycloak strategy already registered')
      // Detect collision prior to changing auth configuration or installing a strategy.
      let existingSession: unknown
      try { existingSession = app.service(SESSION_PATH) } catch { existingSession = undefined }
      if (existingSession) throw new TypeError('Keycloak session service already exists')
      const next = { ...configuration, parseStrategies: ['keycloak', ...existing] }
      // The strategy independently rejects keycloak in authStrategies (JWT mint protection).
      strategy.setAuthentication({ configuration: next })
      app.set('authentication', next)
      try { auth.register('keycloak', strategy) } catch (error) {
        app.set('authentication', configuration)
        throw error
      }
      const sessions = {
        async create(data: unknown, params: unknown): Promise<{ authenticated: true }> {
          if (field(params, 'provider') !== 'socketio') throw new NotAuthenticated('Not authenticated')
          const connection = connectionFrom(params)
          const token = credential(data)
          if (!connection) throw new NotAuthenticated('Not authenticated')
          // A failed reauthentication must invalidate any previous token.
          sockets.delete(connection)
          if (!token || !await authenticate(auth, token)) throw new NotAuthenticated('Not authenticated')
          sockets.set(connection, token)
          // Never echo tokens, roles, or identity in transport responses.
          return { authenticated: true }
        },
      }
      app.use(SESSION_PATH, sessions, { methods: ['create'], events: [] })
      app.on('disconnect', (...args: unknown[]) => {
        const connection = args[0]
        if (connection && typeof connection === 'object') sockets.delete(connection)
      })
      app.set('r14KeycloakTransportEnabled', true)
      configured.set(app, auth)
    },
    protect(app: KeycloakTransportHost, servicePath: string): void {
      const auth = configured.get(app)
      if (!auth || !PATH.test(servicePath) || servicePath === SESSION_PATH || servicePath === 'authentication') throw new TypeError('Invalid Keycloak service protection')
      const service = app.service(servicePath) as Partial<ProtectedService> | undefined
      if (!service || typeof service !== 'object' || typeof service.hooks !== 'function' || protectedServices.has(service)) throw new TypeError('Invalid or already protected service')
      const hook = async (context: KeycloakServiceHookContext): Promise<void> => {
        try {
          const params = context.params
          const provider = field(params, 'provider')
          let token: string | null = null
          if (provider === 'rest') token = tokenFromRest(params, strategy)
          else if (provider === 'socketio') {
            const connection = connectionFrom(params)
            if (connection) token = sockets.get(connection) ?? null
          }
          // No internal bypass: applications can use a separate audited service
          // or explicitly construct a trusted internal principal elsewhere.
          if (!token) throw new NotAuthenticated('Not authenticated')
          const principal = await authenticate(auth, token)
          if (!principal) throw new NotAuthenticated('Not authenticated')
          // WeakMap keyed by this specific Feathers hook context prevents
          // cross-request identity bleed during concurrent async authorizations.
          verified.set(context, principal)
          try { await authorize(context) } finally { verified.delete(context) }
        } catch (error) {
          if (error instanceof RbacForbiddenError) throw new Forbidden('Forbidden')
          // Feathers v5 REST and Socket.IO serialize FeathersError instances.
          // A custom Error with just code=401 is not sufficient at this boundary.
          throw new NotAuthenticated('Not authenticated')
        }
      }
      protectedServices.add(service)
      service.hooks({ before: { all: [hook] } })
    },
  })
}
