/** P3-R1: per-request client ownership, transport-agnostic and fail-closed.
 * Construct within each SSR request or each browser application instance.
 * Never cache this object at module scope on the server.
 */
export type EventHandler = (...args: readonly unknown[]) => void
export interface RealtimeEmitter {
  on(event: string, handler: EventHandler): unknown
  off(event: string, handler: EventHandler): unknown
}
export interface ScopedClient {
  readonly identity: string | null
  readonly transport: RealtimeEmitter
  readonly dispose: () => Promise<void> | void
}
export interface ScopedClientSnapshot { readonly identity: string | null; readonly closed: boolean; readonly subscriptions: number }

const EVENT = /^[a-z][a-z0-9:_-]{0,127}$/i
const REJECT = /^(?:__proto__|constructor|prototype)$/i

export class FeathersRequestScope {
  readonly #client: ScopedClient
  readonly #subscriptions = new Set<readonly [string, EventHandler]>()
  #state: 'active' | 'closing' | 'closed' = 'active'
  #closing: Promise<void> | null = null

  constructor(client: ScopedClient) {
    if (!client || typeof client.dispose !== 'function' || !client.transport
      || typeof client.transport.on !== 'function' || typeof client.transport.off !== 'function'
      || (client.identity !== null && (typeof client.identity !== 'string' || client.identity.length > 256))) {
      throw new TypeError('Invalid per-request Feathers client')
    }
    this.#client = client
  }

  get snapshot(): ScopedClientSnapshot {
    return Object.freeze({ identity: this.#state === 'active' ? this.#client.identity : null,
      closed: this.#state !== 'active', subscriptions: this.#subscriptions.size })
  }

  subscribe(event: string, handler: EventHandler): () => void {
    if (this.#state !== 'active') throw new Error('Feathers request scope is closed')
    if (typeof event !== 'string' || !EVENT.test(event) || REJECT.test(event) || typeof handler !== 'function') {
      throw new TypeError('Invalid realtime subscription')
    }
    const pair: readonly [string, EventHandler] = [event, handler]
    this.#client.transport.on(event, handler)
    this.#subscriptions.add(pair)
    let removed = false
    return () => {
      if (removed) return
      removed = true
      this.#subscriptions.delete(pair)
      this.#client.transport.off(event, handler)
    }
  }

  async close(): Promise<void> {
    if (this.#closing) return this.#closing
    this.#state = 'closing'
    this.#closing = this.#shutdown()
    return this.#closing
  }

  async #shutdown(): Promise<void> {
    const failures: unknown[] = []
    for (const [event, handler] of this.#subscriptions) {
      try { this.#client.transport.off(event, handler) } catch (error) { failures.push(error) }
    }
    this.#subscriptions.clear()
    try { await this.#client.dispose() } catch (error) { failures.push(error) }
    this.#state = 'closed'
    if (failures.length > 0) throw new AggregateError(failures.map(() => new Error('Feathers scope cleanup failed')), 'Feathers scope cleanup failed')
  }
}

export function createFeathersRequestScope(factory: () => ScopedClient): FeathersRequestScope {
  if (typeof factory !== 'function') throw new TypeError('Per-request factory required')
  return new FeathersRequestScope(factory())
}
