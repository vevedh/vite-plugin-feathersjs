import { Forbidden } from '@feathersjs/errors'
import { evaluateNotesAccess } from './auth-rbac-policy.mjs'

export function createNotesRbacHook(store) {
  if (!store || typeof store.getById !== 'function' || typeof store.validSession !== 'function') {
    throw new TypeError('Trusted RBAC store required')
  }
  return async function authorizeNotes(context) {
    try {
      if (await evaluateNotesAccess(context, store)) return context
    } catch {
      // Provider errors and identity details are never returned to clients.
    }
    throw new Forbidden('Forbidden')
  }
}
