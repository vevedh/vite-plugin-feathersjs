/**
 * R14-A2.3-R1 — explicit deny-by-default event fence for Keycloak-protected services.
 * Register LAST in afterRegister, after bridge.protect() and all other publishers.
 * This prevents Feathers channel publication; it does not intercept raw app.io emits.
 */
const SERVICE_PATH = /^[a-z][a-z0-9_-]*(?:\/[a-z][a-z0-9_-]*)*$/
const EVENTS = ['created', 'updated', 'patched', 'removed'] as const

type Publisher = (_data: unknown, _context: unknown) => null
interface PublishingService {
  publish(fn: Publisher): unknown
  publish(event: string, fn: Publisher): unknown
}
export interface KeycloakEventFenceApp {
  get(name: string): unknown
  service(path: string): unknown
}
export interface KeycloakEventFenceReceipt {
  readonly enabled: true
  readonly protectedPaths: readonly string[]
  readonly mode: 'DENY_ALL_FEATHERS_SERVICE_EVENTS'
}

const DENY: Publisher = () => null

/**
 * Explicit target list: never mutates other Feathers services.
 * Does not grant any access, create channel membership or publish data.
 * The host MUST NOT register publishers for these services after installing it.
 */
export function installKeycloakEventFence(
  app: KeycloakEventFenceApp,
  protectedPaths: readonly string[],
): KeycloakEventFenceReceipt {
  if (!app || typeof app.get !== 'function' || typeof app.service !== 'function' ||
      app.get('r14KeycloakTransportEnabled') !== true || !Array.isArray(protectedPaths) ||
      protectedPaths.length === 0 || protectedPaths.length > 64) {
    throw new TypeError('Keycloak event fence requires enabled transport and explicit services')
  }
  const pending = new Map<string, PublishingService>()
  // Validate the complete list before changing the first service.
  for (const path of protectedPaths) {
    if (typeof path !== 'string' || !SERVICE_PATH.test(path) || path === 'authentication' ||
        path === 'keycloak-session' || pending.has(path)) {
      throw new TypeError('Invalid or duplicated protected event service')
    }
    const service = app.service(path)
    if (!service || typeof service !== 'object' || typeof (service as Partial<PublishingService>).publish !== 'function') {
      throw new TypeError('Protected service does not support Feathers publishing')
    }
    pending.set(path, service as PublishingService)
  }
  // Service-wide and event-specific callbacks outrank app-wide publishers.
  // A null result means no channel receives the event.
  for (const service of pending.values()) {
    service.publish(DENY)
    for (const event of EVENTS) service.publish(event, DENY)
  }
  return Object.freeze({
    enabled: true as const,
    protectedPaths: Object.freeze([...pending.keys()]),
    mode: 'DENY_ALL_FEATHERS_SERVICE_EVENTS' as const,
  })
}
