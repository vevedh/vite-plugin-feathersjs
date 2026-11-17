/**
 * P1 foundation. Identity MUST be attested by application-controlled code after
 * successful Feathers authentication and server-side role resolution.
 * Network-provided params.user, params.authentication, query and data are untrusted.
 * This module does not implement JWT/OIDC verification or a Feathers auth strategy.
 */
import {
  createRbacAuthorizer,
  RbacForbiddenError,
  type AuthorizedServiceContext,
  type RbacPolicyInput,
  type TrustedPrincipal,
} from './rbac-policy.js'

const ROLE_RE = /^[a-z][a-z0-9:_-]{0,63}$/

function snapshotPrincipal(value: unknown): TrustedPrincipal {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new RbacForbiddenError()
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new RbacForbiddenError()
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string')) throw new RbacForbiddenError()
  if (Object.values(descriptors).some(descriptor => !('value' in descriptor))) throw new RbacForbiddenError()
  const subject = descriptors['subject']?.value as unknown
  const roles = descriptors['roles']?.value as unknown
  if (typeof subject !== 'string' || subject.length < 1 || subject.length > 256) throw new RbacForbiddenError()
  if (!Array.isArray(roles) || roles.length > 128 || roles.some(role => typeof role !== 'string' || !ROLE_RE.test(role))) {
    throw new RbacForbiddenError()
  }
  if (new Set(roles).size !== roles.length) throw new RbacForbiddenError()
  return Object.freeze({ subject, roles: Object.freeze([...roles] as string[]) })
}

/**
 * A private WeakMap is the server-side attestation boundary: matching-looking
 * params on a different request cannot impersonate an authenticated principal.
 * Use a new context for each Feathers method call (the normal hook contract).
 */
export function createTrustedRbacBoundary<T extends AuthorizedServiceContext>(policy: RbacPolicyInput): Readonly<{
  attestAfterVerifiedAuthentication: (context: T, authenticatedIdentity: TrustedPrincipal) => T
  authorize: (context: T) => Promise<T>
}> {
  const verified = new WeakMap<object, TrustedPrincipal>()
  const authorize = createRbacAuthorizer<T>(policy, (context) => verified.get(context) ?? null)
  return Object.freeze({
    attestAfterVerifiedAuthentication(context: T, authenticatedIdentity: TrustedPrincipal): T {
      if (context === null || typeof context !== 'object') throw new RbacForbiddenError()
      // Copy/validate before insertion: never retain a mutable role array.
      const principal = snapshotPrincipal(authenticatedIdentity)
      if (verified.has(context)) throw new RbacForbiddenError()
      verified.set(context, principal)
      return context
    },
    authorize,
  })
}
