/** P3-R2: one owner per SSR request or browser Pinia instance.
 * All event payloads are untrusted. Reconcile using the Feathers service read.
 * This module never starts a socket or shares user state at module scope.
 */
import type { FeathersRequestScope, RealtimeEmitter } from './ssr-request-scope.js'

export interface ReconciledNote {
  readonly id: number | string
  readonly title: string
}
export interface ReconciliationView {
  readonly notes: readonly ReconciledNote[]
  readonly pending: boolean
  readonly connected: boolean
  readonly stale: boolean
  readonly error: string | null
}
export interface ReconciliationPort {
  readonly update: (view: ReconciliationView) => void
}
export type ReadNotes = (signal: AbortSignal) => Promise<unknown>
export interface ReconciliationOptions {
  readonly scope: FeathersRequestScope
  readonly service: ReadNotes
  readonly store: ReconciliationPort
  readonly connection?: RealtimeEmitter
}
export interface ReconciliationController {
  readonly refresh: () => Promise<void>
  readonly close: () => Promise<void>
  readonly snapshot: () => ReconciliationView
}

const EVENTS = ['created', 'updated', 'patched', 'removed'] as const
const DISCONNECTED = 'Données temporairement indisponibles'
const READ_FAILED = 'Impossible de synchroniser les données'
function ownValue(record: Record<string, unknown>, key: string): unknown {
  const d = Object.getOwnPropertyDescriptor(record, key)
  if (!d || !('value' in d)) throw new TypeError('Invalid service data')
  return d.value
}
function parseNotes(input: unknown): readonly ReconciledNote[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    if (!Array.isArray(input)) throw new TypeError('Invalid service data')
  }
  const rows: unknown = Array.isArray(input) ? input : ownValue(input as Record<string, unknown>, 'data')
  if (!Array.isArray(rows) || rows.length > 500) throw new TypeError('Invalid service data')
  const result: ReconciledNote[] = []
  const ids = new Set<number | string>()
  for (const raw of rows as unknown[]) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Invalid service row')
    const data = raw as Record<string, unknown>
    const id = ownValue(data, 'id')
    const title = ownValue(data, 'title')
    if (!((typeof id === 'number' && Number.isSafeInteger(id) && id >= 0) ||
       (typeof id === 'string' && /^[a-z0-9_-]{1,128}$/i.test(id) && !/^(?:__proto__|constructor|prototype)$/i.test(id))) || ids.has(id as number | string) ||
       typeof title !== 'string' || title.length < 1 || title.length > 200 || /[\u0000-\u001f\u007f]/u.test(title)) {
      throw new TypeError('Invalid service row')
    }
    ids.add(id as number | string)
    result.push(Object.freeze({ id: id as number | string, title }))
  }
  return Object.freeze(result)
}
export function createRealtimeReconciliation(options: ReconciliationOptions): ReconciliationController {
  const { scope, service, store, connection } = options
  if (!scope || typeof scope.subscribe !== 'function' || typeof scope.close !== 'function' ||
      typeof service !== 'function' || !store || typeof store.update !== 'function' ||
      (connection && (typeof connection.on !== 'function' || typeof connection.off !== 'function'))) {
    throw new TypeError('Invalid reconciliation configuration')
  }
  let closed = false
  let epoch = 0
  let wanted = false
  let running: Promise<void> | null = null
  let request: AbortController | null = null
  let closing: Promise<void> | null = null
  let current: ReconciliationView = Object.freeze({ notes: [], pending: false, connected: false, stale: true, error: null })
  const cleanups: Array<() => void> = []
  const publish = (patch: Partial<ReconciliationView>): void => {
    if (closed) return
    current = Object.freeze({ ...current, ...patch })
    store.update(current)
  }
  const loop = async (): Promise<void> => {
    while (wanted && !closed) {
      wanted = false
      const started = epoch
      const controller = new AbortController()
      request = controller
      publish({ pending: true, error: null })
      try {
        const value = parseNotes(await service(controller.signal))
        if (!closed && epoch === started) publish({ notes: value, stale: false, error: null })
      } catch {
        if (!closed && epoch === started) publish({ stale: true, error: READ_FAILED })
      } finally {
        if (request === controller) request = null
        if (!closed) publish({ pending: false })
      }
    }
  }
  const refresh = (): Promise<void> => {
    if (closed) return Promise.resolve()
    wanted = true
    if (!running) {
      running = loop().finally(() => {
        running = null
        // An event arriving between the loop's last check and settlement must not be lost.
        if (wanted && !closed) void refresh()
      })
    }
    return running
  }
  const onDisconnect = (): void => {
    if (closed) return
    epoch++
    request?.abort()
    publish({ connected: false, stale: true, error: DISCONNECTED })
  }
  const onConnect = (): void => {
    if (closed) return
    publish({ connected: true, error: null })
    void refresh()
  }
  try {
    for (const event of EVENTS) cleanups.push(scope.subscribe(event, () => { void refresh() }))
    if (connection) {
      connection.on('connect', onConnect)
      cleanups.push(() => connection.off('connect', onConnect))
      connection.on('disconnect', onDisconnect)
      cleanups.push(() => connection.off('disconnect', onDisconnect))
      connection.on('connect_error', onDisconnect)
      cleanups.push(() => connection.off('connect_error', onDisconnect))
    }
  } catch {
    for (const unlisten of cleanups.reverse()) { try { unlisten() } catch { /* caller can close scope */ } }
    throw new Error('Realtime listener installation failed')
  }
  store.update(current)
  const close = (): Promise<void> => {
    if (closing) return closing
    closed = true
    epoch++
    wanted = false
    request?.abort()
    const task = async (): Promise<void> => {
      const errors: unknown[] = []
      for (const unlisten of cleanups.reverse()) {
        try { unlisten() } catch { errors.push(new Error('Realtime cleanup failed')) }
      }
      try { await scope.close() } catch { errors.push(new Error('Realtime cleanup failed')) }
      if (running) await running.catch(() => {})
      if (errors.length) throw new AggregateError(errors, 'Realtime cleanup failed')
    }
    closing = task()
    return closing
  }
  return Object.freeze({ refresh, close, snapshot: () => current })
}
