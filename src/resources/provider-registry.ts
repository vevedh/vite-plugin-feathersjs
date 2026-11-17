/**
 * P2 lifecycle core; not database connectivity. Each real provider must supply
 * an audited driver and separate integration tests before being called supported.
 * No credentials, URLs, raw errors or connection objects are exposed in snapshots.
 */
export type ProviderKind = 'mongodb' | 'postgresql' | 'mysql' | 'mariadb' | 'sqlite' | 'mssql' | 'redis' | 'valkey'
export type ProviderState = 'idle' | 'connecting' | 'ready' | 'failed' | 'closing'

export interface ProviderAdapter<C> {
  connect(): Promise<C>
  health(connection: C): Promise<void>
  close(connection: C): Promise<void>
}
export interface ProviderSnapshot {
  readonly name: string
  readonly kind: ProviderKind
  readonly state: ProviderState
}
export class ProviderLifecycleError extends Error {
  constructor() {
    super('Provider unavailable')
    this.name = 'ProviderLifecycleError'
  }
}
export class ProviderConfigurationError extends Error {
  constructor() {
    super('Invalid provider configuration')
    this.name = 'ProviderConfigurationError'
  }
}
interface Entry {
  readonly name: string
  readonly kind: ProviderKind
  readonly adapter: ProviderAdapter<unknown>
  state: ProviderState
  connection: unknown
  queue: Promise<void>
}
const NAME_RE = /^[a-z][a-z0-9_-]{0,63}$/
const KINDS = new Set<ProviderKind>(['mongodb', 'postgresql', 'mysql', 'mariadb', 'sqlite', 'mssql', 'redis', 'valkey'])

export class ProviderRegistry {
  readonly #entries = new Map<string, Entry>()

  register<C>(name: string, kind: ProviderKind, adapter: ProviderAdapter<C>): void {
    if (typeof name !== 'string' || !NAME_RE.test(name) || !KINDS.has(kind)
      || this.#entries.has(name) || this.#entries.size >= 64 || adapter === null || typeof adapter !== 'object'
      || typeof adapter.connect !== 'function' || typeof adapter.health !== 'function' || typeof adapter.close !== 'function') {
      throw new ProviderConfigurationError()
    }
    this.#entries.set(name, {
      name, kind,
      adapter: adapter as ProviderAdapter<unknown>,
      state: 'idle', connection: undefined, queue: Promise.resolve(),
    })
  }

  snapshot(): readonly ProviderSnapshot[] {
    return Object.freeze([...this.#entries.values()].map(e => Object.freeze({ name: e.name, kind: e.kind, state: e.state })))
  }

  #get(name: string): Entry {
    const e = this.#entries.get(name)
    if (!e) throw new ProviderLifecycleError()
    return e
  }

  #enqueue<T>(entry: Entry, work: () => Promise<T>): Promise<T> {
    // Serialize connect/health/close to prevent cross-request double connect.
    const result = entry.queue.then(work, work)
    entry.queue = result.then(() => undefined, () => undefined)
    return result
  }

  async connect<C = unknown>(name: string): Promise<C> {
    const entry = this.#get(name)
    return this.#enqueue(entry, async () => {
      if (entry.state === 'ready') return entry.connection as C
      if (entry.state !== 'idle' && entry.state !== 'failed') throw new ProviderLifecycleError()
      // A failed health check may still hold a live connection. Explicitly close first.
      if (entry.connection !== undefined) throw new ProviderLifecycleError()
      entry.state = 'connecting'
      try {
        const connection = await entry.adapter.connect()
        if (connection === null || connection === undefined) throw new ProviderLifecycleError()
        entry.connection = connection
        entry.state = 'ready'
        return connection as C
      } catch {
        entry.connection = undefined
        entry.state = 'failed'
        throw new ProviderLifecycleError()
      }
    })
  }

  async health(name: string): Promise<void> {
    const entry = this.#get(name)
    return this.#enqueue(entry, async () => {
      if (entry.state !== 'ready') throw new ProviderLifecycleError()
      try {
        await entry.adapter.health(entry.connection)
      } catch {
        // Keep connection for explicit cleanup; never expose underlying secrets.
        entry.state = 'failed'
        throw new ProviderLifecycleError()
      }
    })
  }

  async close(name: string): Promise<void> {
    const entry = this.#get(name)
    return this.#enqueue(entry, async () => {
      if (entry.state === 'idle' || (entry.state === 'failed' && entry.connection === undefined)) {
        entry.state = 'idle'
        return
      }
      if (entry.connection === undefined) throw new ProviderLifecycleError()
      entry.state = 'closing'
      try {
        await entry.adapter.close(entry.connection)
        entry.connection = undefined
        entry.state = 'idle'
      } catch {
        entry.state = 'failed'
        throw new ProviderLifecycleError()
      }
    })
  }

  async closeAll(): Promise<void> {
    // Attempt ALL closures even when one provider refuses to close.
    const settled = await Promise.allSettled([...this.#entries.keys()].map(name => this.close(name)))
    if (settled.some(result => result.status === 'rejected')) throw new ProviderLifecycleError()
  }
}
