import type { FeathersApp } from './types.js'

/** A bounded, runtime-only audit of Feathers v5 service registrations. */
export type ServiceRegistrationPhase = 'configure' | 'services' | 'afterRegister'

export interface ServiceRegistrationRecord {
  readonly path: string
  readonly phase: ServiceRegistrationPhase
  /** A categorical label, never a source-file path. */
  readonly source: string
}

export interface ServiceRegistrationGuard {
  run(phase: ServiceRegistrationPhase, source: string, registrar: () => void | Promise<void>): Promise<void>
  snapshot(): readonly ServiceRegistrationRecord[]
}

interface RegistrableFeathersApp {
  use: (...args: unknown[]) => unknown
  services?: Record<string, unknown>
}

function normalizedPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const path = value.replace(/^\/+|\/+$/g, '')
  if (path.length === 0 || path.length > 160 || !/^[a-zA-Z0-9_.:-]+(?:\/[a-zA-Z0-9_.:-]+)*$/.test(path)) {
    throw new TypeError('Invalid Feathers service registration path')
  }
  return path
}

/**
 * An opt-in registration guard scoped to a single Feathers application.
 *
 * The guard wraps app.use *only while* a synchronous/awaited registrar runs,
 * and restores the original function in finally. It intentionally does not
 * intercept late/background registrations or arbitrary Express middleware.
 */
export function createServiceRegistrationGuard(app: FeathersApp): ServiceRegistrationGuard {
  if (!app || typeof app.use !== 'function') throw new TypeError('A Feathers app with use() is required')
  const web = app as unknown as RegistrableFeathersApp
  const seen = new Map<string, ServiceRegistrationRecord>()
  let running = false

  function snapshot(): readonly ServiceRegistrationRecord[] {
    return Object.freeze([...seen.values()].map(record => Object.freeze({ ...record })))
  }

  async function run(phase: ServiceRegistrationPhase, source: string, registrar: () => void | Promise<void>): Promise<void> {
    if (!['configure', 'services', 'afterRegister'].includes(phase) || !/^(configure|afterRegister|module#[1-9][0-9]*)$/.test(source)) {
      throw new TypeError('Invalid Feathers service registration phase/source')
    }
    if (typeof registrar !== 'function') throw new TypeError('Feathers registrar must be callable')
    if (running) throw new Error('Concurrent Feathers registration phases are not supported')
    running = true
    const original = web.use
    web.use = function guardedUse(this: unknown, ...args: unknown[]): unknown {
      // Feathers service objects use app.use(path, service). Functions passed to
      // Express app.use(path, middleware) are middleware, not services.
      if (typeof args[0] !== 'string' || args[1] === null || typeof args[1] !== 'object') {
        return original.apply(this, args)
      }
      const path = normalizedPath(args[0])
      if (!path) return original.apply(this, args)
      const first = seen.get(path)
      const existing = web.services && (Object.prototype.hasOwnProperty.call(web.services, path)
        || Object.prototype.hasOwnProperty.call(web.services, `/${path}`))
      if (first || existing) {
        const prior = first ? `${first.phase}/${first.source}` : 'pre-existing'
        throw new Error(`Duplicate Feathers service registration: ${path} (first: ${prior}; second: ${phase}/${source})`)
      }
      const result = original.apply(this, args)
      // Only register a service if Feathers actually installed it. This avoids
      // counting ordinary framework middleware whose path is a string.
      const installed = web.services && (Object.prototype.hasOwnProperty.call(web.services, path)
        || Object.prototype.hasOwnProperty.call(web.services, `/${path}`))
      if (installed) seen.set(path, Object.freeze({ path, phase, source }))
      return result
    }
    try {
      await registrar()
    } finally {
      web.use = original
      running = false
    }
  }

  return Object.freeze({ run, snapshot })
}
