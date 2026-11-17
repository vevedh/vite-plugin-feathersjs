/** One provider per deployment, roles reloaded from the server-side store on each request. */
export const NOTES_PERMISSIONS = Object.freeze({
  viewer: Object.freeze(['find', 'get']),
  editor: Object.freeze(['find', 'get', 'create', 'patch']),
  admin: Object.freeze(['find', 'get', 'create', 'update', 'patch', 'remove']),
})

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const ROLES = new Set(Object.keys(NOTES_PERMISSIONS))
const METHODS = new Set(['find', 'get', 'create', 'update', 'patch', 'remove'])

export function canAccessNotes(role, method) {
  return typeof role === 'string' && typeof method === 'string'
    && ROLES.has(role) && METHODS.has(method) && NOTES_PERMISSIONS[role].includes(method)
}

/**
 * Called ONLY AFTER the Feathers authenticate('jwt') before hook.
 * Never grant access using a role from JWT claims, query, request body or socket metadata.
 * An internal service call without a documented server authority is denied as well.
 */
export async function evaluateNotesAccess(context, store) {
  if (!context || typeof context !== 'object' || context.path !== 'notes'
      || !METHODS.has(context.method) || !store || typeof store.getById !== 'function'
      || typeof store.validSession !== 'function') return false
  const params = context.params
  if (!params || !['rest', 'socketio'].includes(params.provider)) return false
  const provided = params.user
  const payload = params.authentication?.payload
  if (!provided || !UUID.test(provided.id) || !payload || !UUID.test(payload.sid)
      || payload.sub !== provided.id || !Number.isSafeInteger(payload.ver)
      || payload.ver < 1) return false
  // The authenticated user is only an identity pointer: roles come from the database.
  const authoritative = await store.getById(provided.id)
  if (!authoritative || authoritative.id !== provided.id || authoritative.status !== 'active'
      || !Number.isSafeInteger(authoritative.sessionVersion)
      || authoritative.sessionVersion !== payload.ver || !canAccessNotes(authoritative.role,context.method)) return false
  return Boolean(await store.validSession(payload.sid, authoritative.id, authoritative.sessionVersion))
}
