/**
 * Standalone Feathers runtime lifecycle coordinator.
 * No Vite, Nitro, Nuxt or Feathers-specific imports.
 * Transport implementations are supplied by the host application.
 */
export type FeathersLifecycleState =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'failed'
  | 'closing'
  | 'closed'

export interface FeathersLifecycleTransport {
  start(): Promise<void>
  close(): Promise<void>
}

export interface FeathersLifecycleSnapshot {
  readonly state: FeathersLifecycleState
  readonly readyAt: number | null
}

export interface FeathersLifecycle<T extends FeathersLifecycleTransport> {
  /** Starts only once. Concurrent callers receive the same startup result. */
  start(): Promise<T>
  /** Waits for an already-started runtime; never triggers implicit startup. */
  whenReady(): Promise<T>
  /** Terminal and idempotent; concurrent shutdowns share the same cleanup. */
  close(): Promise<void>
  /** Public, secret-free readiness metadata (no credentials or error messages). */
  snapshot(): Readonly<FeathersLifecycleSnapshot>
}

/**
 * Wraps createFeathersRuntime() or any compatible Feathers transport factory.
 * A single coordinator owns exactly one runtime instance. To restart after
 * shutdown, construct a new coordinator, rather than reviving a closed one.
 */
export function createFeathersLifecycle<T extends FeathersLifecycleTransport>(
  create: () => T | Promise<T>,
): FeathersLifecycle<T> {
  if (typeof create !== 'function')
    throw new TypeError('Feathers runtime factory must be a function')

  let state: FeathersLifecycleState = 'idle'
  let runtime: T | undefined
  let startup: Promise<T> | undefined
  let shutdown: Promise<void> | undefined
  let failure: unknown
  let readyAt: number | null = null

  const readState = (): FeathersLifecycleState => state
  const terminalError = (): Error => new Error(`Feathers runtime is ${state}`)

  const start = (): Promise<T> => {
    if (state === 'closing' || state === 'closed')
      return Promise.reject(terminalError())
    if (state === 'failed')
      return Promise.reject(failure ?? terminalError())
    if (startup)
      return startup

    state = 'initializing'
    startup = (async (): Promise<T> => {
      let candidate: T | undefined
      try {
        candidate = await create()
        // Check transport shape before retaining it, to avoid incomplete cleanup.
        if (!candidate || typeof candidate.start !== 'function' || typeof candidate.close !== 'function')
          throw new TypeError('Invalid Feathers transport: start() and close() required')
        runtime = candidate
        if (readState() !== 'initializing')
          throw new Error('Feathers runtime shutdown requested during initialization')
        await candidate.start()
        if (readState() !== 'initializing')
          throw new Error('Feathers runtime shutdown requested during initialization')
        readyAt = Date.now()
        state = 'ready'
        return candidate
      }
      catch (error: unknown) {
        // The coordinator, not the caller, owns rollback of a partially started runtime.
        if (candidate && typeof candidate.close === 'function') {
          try {
            await candidate.close()
          }
          catch (cleanupError: unknown) {
            error = new AggregateError([error, cleanupError], 'Feathers startup and rollback both failed')
          }
        }
        runtime = undefined
        failure = error
        if (readState() !== 'closing')
          state = 'failed'
        throw error
      }
    })()
    return startup
  }

  const whenReady = (): Promise<T> => {
    if (state === 'ready' && runtime)
      return Promise.resolve(runtime)
    if (state === 'initializing' && startup)
      return startup
    if (state === 'failed')
      return Promise.reject(failure ?? terminalError())
    return Promise.reject(terminalError())
  }

  const close = (): Promise<void> => {
    if (shutdown)
      return shutdown
    if (state === 'closed')
      return Promise.resolve()

    state = 'closing'
    // Preserve the startup promise even when it rejects: shutdown always cleans up.
    const activeStartup = startup
    shutdown = (async (): Promise<void> => {
      try {
        await activeStartup?.catch(() => undefined)
        const active = runtime
        runtime = undefined
        if (active)
          await active.close()
        state = 'closed'
      }
      catch (error: unknown) {
        failure = error
        state = 'failed'
        throw error
      }
    })()
    return shutdown
  }

  const snapshot = (): Readonly<FeathersLifecycleSnapshot> =>
    Object.freeze({ state, readyAt })

  return Object.freeze({ start, whenReady, close, snapshot })
}
