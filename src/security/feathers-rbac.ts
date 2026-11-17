/**
 * P1-R2: explicit Feathers v5 RBAC hook. Opt-in, independent of Vite/Nitro.
 * The injected verifier MUST cryptographically validate JWTs or another approved
 * credential and resolve permissions from a trusted server-side source.
 * A token-equality test fixture is NOT a production authentication strategy.
 */
import { Forbidden } from '@feathersjs/errors'
import {
  createRbacAuthorizer,
  type AuthorizedServiceContext,
  type RbacPolicyInput,
  type TrustedPrincipal,
} from './rbac-policy.js'

export interface FeathersRbacContext extends AuthorizedServiceContext {
  readonly params?: unknown
}

export type VerifiedTokenResolver = (
  accessToken: string,
  action: Readonly<AuthorizedServiceContext>,
) => Promise<TrustedPrincipal | null> | TrustedPrincipal | null

export type FeathersRbacBeforeHook = (context: FeathersRbacContext) => Promise<void>

const attached = new WeakMap<object, Set<string>>()
const BEARER = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i
const TOKEN = /^[A-Za-z0-9._~+/-]+=*$/
const SERVICE_PATH = /^[a-z][a-z0-9_-]*(?:\/[a-z][a-z0-9_-]*)*$/

function ownField(source: unknown, key: string): unknown {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) return undefined
  const d = Object.getOwnPropertyDescriptor(source, key)
  if (!d) return undefined
  if (!('value' in d)) throw new TypeError('Unsafe credential field')
  return d.value as unknown
}

function tokenValue(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || value.length < 1 || value.length > 8192 || !TOKEN.test(value)) {
    throw new TypeError('Invalid access token')
  }
  return value
}

/** Extract a bearer credential, NEVER user, principal, claims or roles. */
export function extractFeathersAccessToken(params: unknown): string | null {
  const authentication = ownField(params, 'authentication')
  const socketToken = tokenValue(ownField(authentication, 'accessToken'))
  const headers = ownField(params, 'headers')
  const lower = ownField(headers, 'authorization')
  const upper = ownField(headers, 'Authorization')
  if (lower !== undefined && upper !== undefined && lower !== upper) throw new TypeError('Ambiguous Authorization header')
  const header = lower ?? upper
  let bearer: string | null = null
  if (header !== undefined && header !== null) {
    if (typeof header !== 'string') throw new TypeError('Invalid Authorization header')
    const match = BEARER.exec(header)
    if (!match) throw new TypeError('Unsupported Authorization scheme')
    bearer = tokenValue(match[1])
  }
  if (socketToken && bearer && socketToken !== bearer) throw new TypeError('Conflicting credentials')
  return socketToken ?? bearer
}

/**
 * Apply policy to every service method invocation, including internal calls.
 * Missing rules and unverifiable credentials are always denied. Public methods
 * do not invoke the verifier. All verifier failures are rendered generically.
 */
export function createFeathersRbacBeforeHook(
  policies: RbacPolicyInput,
  verifyToken: VerifiedTokenResolver,
): FeathersRbacBeforeHook {
  if (typeof verifyToken !== 'function') throw new TypeError('Server credential verifier required')
  const authorize = createRbacAuthorizer<FeathersRbacContext>(policies, async context => {
    const token = extractFeathersAccessToken(context.params)
    return token === null ? null : verifyToken(token, Object.freeze({ path: context.path, method: context.method }))
  })
  return async context => {
    try {
      await authorize(context)
    } catch {
      // Do not leak verifier errors, roles, tokens, database details or policy.
      throw new Forbidden('Forbidden')
    }
  }
}

interface HookableService {
  hooks(hooks: { before: { all: readonly FeathersRbacBeforeHook[] } }): unknown
}
interface ServiceApp {
  service(path: string): unknown
}

/**
 * Install AFTER registering the target service (e.g. options.afterRegister).
 * Per-service registration avoids accidentally intercepting authentication.create.
 * Never apply an unaudited global hook to all Feathers services.
 */
export function installFeathersServiceRbac(
  app: ServiceApp,
  servicePath: string,
  policies: RbacPolicyInput,
  verifyToken: VerifiedTokenResolver,
): void {
  if (app === null || (typeof app !== 'object' && typeof app !== 'function')
      || typeof app.service !== 'function' || !SERVICE_PATH.test(servicePath) || servicePath.length > 128) {
    throw new TypeError('Invalid Feathers service installation')
  }
  const hook = createFeathersRbacBeforeHook(policies, verifyToken)
  const service = app.service(servicePath)
  if (service === null || (typeof service !== 'object' && typeof service !== 'function')
      || typeof (service as { hooks?: unknown }).hooks !== 'function') {
    throw new TypeError('Target Feathers service must be registered before RBAC')
  }
  const key = service as object
  const installed = attached.get(key)
  if (installed?.has(servicePath)) throw new TypeError('RBAC already installed for service')
  // Reserve the slot before hooking to prevent retry after partial registration.
  const names = installed ?? new Set<string>()
  names.add(servicePath)
  attached.set(key, names)
  ;(service as HookableService).hooks({ before: { all: [hook] } })
}

/**
 * Optional adapter for a REAL Feathers v5 AuthenticationService registered by
 * the host. It MUST be configured with a working JWT strategy. Role resolution
 * runs server-side; JWT/user-supplied `roles` are intentionally ignored.
 */
export interface FeathersJwtAuthenticationService {
  authenticate(data: { strategy: 'jwt'; accessToken: string }, params: object, ...strategies: ['jwt']): Promise<unknown>
}
export type ServerPrincipalLoader = (verifiedEntityId: string) => Promise<TrustedPrincipal | null> | TrustedPrincipal | null

export function createFeathersJwtVerifier(
  authService: FeathersJwtAuthenticationService,
  resolveServerPrincipal: ServerPrincipalLoader,
): VerifiedTokenResolver {
  if (!authService || typeof authService.authenticate !== 'function' || typeof resolveServerPrincipal !== 'function') {
    throw new TypeError('JWT authentication service and principal loader required')
  }
  return async accessToken => {
    try {
      const result = await authService.authenticate({ strategy: 'jwt', accessToken }, {}, 'jwt')
      const user = ownField(result, 'user')
      const id = ownField(user, 'id')
      const entityId = typeof id === 'string' ? id : (typeof id === 'number' && Number.isSafeInteger(id) ? String(id) : null)
      if (!entityId || entityId.length > 256) return null
      // The loader MUST query a trusted store and reject disabled/revoked users.
      // Do not use roles, claims, or profile fields from the incoming JWT.
      return await resolveServerPrincipal(entityId)
    } catch {
      return null
    }
  }
}
