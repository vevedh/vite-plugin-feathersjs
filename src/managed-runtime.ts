/**
 * Explicit lifecycle for a Feathers runtime already constructed by the host.
 * This adapter does not import Vite, Nuxt or Feathers and is safe in Node.js.
 */
import { createFeathersLifecycle } from './runtime-lifecycle.js'
import type { FeathersLifecycle, FeathersLifecycleTransport } from './runtime-lifecycle.js'

export type ManagedFeathersRuntime<T extends FeathersLifecycleTransport> = T & {
  readonly lifecycle: FeathersLifecycle<T>
}

/**
 * Wraps a runtime without changing its app or HTTP handler identity.
 * start() is single-flight, close() is idempotent, and failure triggers rollback.
 * Do not call the unwrapped runtime's start()/close() after handing it over.
 */
export function manageFeathersRuntime<T extends FeathersLifecycleTransport>(
  original: T,
): ManagedFeathersRuntime<T> {
  if (!original || typeof original.start !== 'function' || typeof original.close !== 'function')
    throw new TypeError('Invalid Feathers runtime: start() and close() required')

  const lifecycle = createFeathersLifecycle(() => original)
  // Spread preserves the existing Feathers runtime's own app and handler properties.
  return {
    ...original,
    async start(): Promise<void> { await lifecycle.start() },
    close(): Promise<void> { return lifecycle.close() },
    lifecycle,
  } as ManagedFeathersRuntime<T>
}
