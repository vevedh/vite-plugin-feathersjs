import { Forbidden } from '@feathersjs/errors'
import { canAccessNotes } from './auth-rbac-policy.mjs'

// The lookup key is the actual server-side Feathers params object. Client
// JSON, query strings and JWT claims cannot populate this WeakMap.
const scopes = new WeakMap()
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const methods = new Set(['find','get','create','patch','update','remove'])

export function readTenantScope(params) {
  const scope = params && scopes.get(params)
  if (!scope) throw new Forbidden('Forbidden')
  return scope
}

/** Registered after authenticate('jwt') and the existing deny-by-default RBAC. */
export function createTenantScopeHook(store) {
  if (!store || typeof store.getById !== 'function' || typeof store.validSession !== 'function') throw Error('TENANT_STORE_INVALID')
  return async context => {
    const params = context?.params
    const id = params?.user?.id
    const claims = params?.authentication?.payload
    if (context?.path !== 'notes' || !methods.has(context.method) || !['rest','socketio'].includes(params?.provider)
        || !UUID.test(id) || claims?.sub !== id || !UUID.test(claims?.sid)
        || !Number.isSafeInteger(claims?.ver) || claims.ver < 1) throw new Forbidden('Forbidden')
    // Never use params.user.role/tenantId or a tenantId supplied by a client.
    const user = await store.getById(id)
    if (!user || user.id !== id || user.status !== 'active' || !UUID.test(user.tenantId) || !canAccessNotes(user.role,context.method)
        || !['viewer','editor','admin'].includes(user.role) || user.sessionVersion !== claims.ver
        || !await store.validSession(claims.sid, id, claims.ver)) throw new Forbidden('Forbidden')
    scopes.set(params, Object.freeze({ tenantId: user.tenantId, ownerId: id, role: user.role }))
    return context
  }
}
