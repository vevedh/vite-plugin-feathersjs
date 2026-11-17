/**
 * Strict server-side RBAC policy compiler (P1-R1).
 * Framework-neutral by design: Feathers hook integration follows in P1-R2.
 * No request-derived roles, cookies, query params, or client metadata are read here.
 */
export const FEATHERS_STANDARD_METHODS = [
  'find', 'get', 'create', 'update', 'patch', 'remove',
] as const

export type FeathersStandardMethod = (typeof FEATHERS_STANDARD_METHODS)[number]
export type RbacRuleInput = 'public' | 'authenticated' | Readonly<{ roles: readonly string[] }>
export type RbacPolicyInput = Readonly<Record<string, Readonly<Partial<Record<FeathersStandardMethod, RbacRuleInput>>>>>
export interface TrustedPrincipal {
  readonly subject: string
  readonly roles: readonly string[]
}
export interface AuthorizedServiceContext {
  readonly path: string
  readonly method: string
}
export type TrustedPrincipalResolver<T extends AuthorizedServiceContext> = (
  context: T,
) => TrustedPrincipal | null | Promise<TrustedPrincipal | null>

export class RbacForbiddenError extends Error {
  readonly code = 403
  readonly className = 'forbidden'
  constructor() {
    super('Forbidden')
    this.name = 'Forbidden'
  }
}

export class RbacConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RbacConfigurationError'
  }
}

type CompiledRule =
  | Readonly<{ type: 'public' }>
  | Readonly<{ type: 'authenticated' }>
  | Readonly<{ type: 'roles'; roles: ReadonlySet<string> }>

const KNOWN_METHODS = new Set<string>(FEATHERS_STANDARD_METHODS)
const PATH_RE = /^[a-z][a-z0-9_-]*(?:\/[a-z][a-z0-9_-]*)*$/
const ROLE_RE = /^[a-z][a-z0-9:_-]{0,63}$/

function plainEntries(value: unknown, description: string): Array<[string, unknown]> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RbacConfigurationError(`${description} must be a plain object`)
  }
  const prototype: unknown = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RbacConfigurationError(`${description} must be a plain object`)
  }
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string')) {
    throw new RbacConfigurationError(`${description} cannot contain symbol keys`)
  }
  const descriptors = Object.getOwnPropertyDescriptors(value)
  return Object.entries(descriptors).map(([key, descriptor]) => {
    if (!('value' in descriptor)) throw new RbacConfigurationError(`${description} cannot contain accessors`)
    return [key, descriptor.value as unknown]
  })
}

function validPath(path: string): boolean {
  return path.length > 0 && path.length <= 128 && PATH_RE.test(path)
}

function compileRule(input: unknown): CompiledRule {
  if (input === 'public' || input === 'authenticated') return Object.freeze({ type: input })
  const entries = plainEntries(input, 'RBAC role rule')
  if (entries.length !== 1 || entries[0]?.[0] !== 'roles') {
    throw new RbacConfigurationError('RBAC role rule only accepts roles')
  }
  const roles = entries[0][1]
  if (!Array.isArray(roles) || roles.length === 0 || roles.length > 32 || roles.some(role => typeof role !== 'string' || !ROLE_RE.test(role))) {
    throw new RbacConfigurationError('RBAC role rule requires 1–32 valid roles')
  }
  if (new Set(roles as string[]).size !== roles.length) {
    throw new RbacConfigurationError('RBAC role rule contains duplicate roles')
  }
  return { type: 'roles', roles: new Set(roles as string[]) }
}

function isTrustedPrincipal(value: unknown): value is TrustedPrincipal {
  if (value === null || typeof value !== 'object') return false
  const p = value as Partial<TrustedPrincipal>
  return typeof p.subject === 'string'
    && p.subject.length > 0
    && p.subject.length <= 256
    && Array.isArray(p.roles)
    && p.roles.length <= 128
    && p.roles.every(role => typeof role === 'string' && ROLE_RE.test(role))
}

/**
 * Compiles a deny-by-default RBAC policy. No implicit public endpoints or bypasses.
 * The principal resolver MUST take identity from trusted server-side authentication.
 * Never implement it using transport-controlled `params`, query, or request body.
 */
export function createRbacAuthorizer<T extends AuthorizedServiceContext>(
  policies: RbacPolicyInput,
  resolveTrustedPrincipal: TrustedPrincipalResolver<T>,
): (context: T) => Promise<T> {
  if (typeof resolveTrustedPrincipal !== 'function') {
    throw new RbacConfigurationError('A trusted server-side principal resolver is required')
  }
  const compiled = new Map<string, ReadonlyMap<FeathersStandardMethod, CompiledRule>>()
  const routes = plainEntries(policies, 'RBAC policies')
  if (routes.length > 256) throw new RbacConfigurationError('Too many RBAC service policies')

  for (const [path, methods] of routes) {
    if (!validPath(path)) throw new RbacConfigurationError('Invalid RBAC service path')
    const methodEntries = plainEntries(methods, 'RBAC service methods')
    const methodRules = new Map<FeathersStandardMethod, CompiledRule>()
    for (const [method, rule] of methodEntries) {
      if (!KNOWN_METHODS.has(method)) throw new RbacConfigurationError('Unsupported Feathers method in RBAC policy')
      methodRules.set(method as FeathersStandardMethod, compileRule(rule))
    }
    compiled.set(path, methodRules)
  }

  return async (context: T): Promise<T> => {
    if (context === null || typeof context !== 'object'
      || typeof context.path !== 'string' || !validPath(context.path)
      || typeof context.method !== 'string' || !KNOWN_METHODS.has(context.method)) {
      throw new RbacForbiddenError()
    }
    const rule = compiled.get(context.path)?.get(context.method as FeathersStandardMethod)
    if (!rule) throw new RbacForbiddenError()
    if (rule.type === 'public') return context
    // Identity is resolved by a server-injected callback, never from caller-controlled context.params.
    const principal: unknown = await resolveTrustedPrincipal(context)
    if (!isTrustedPrincipal(principal)) throw new RbacForbiddenError()
    if (rule.type === 'authenticated') return context
    if (!principal.roles.some(role => rule.roles.has(role))) throw new RbacForbiddenError()
    return context
  }
}
