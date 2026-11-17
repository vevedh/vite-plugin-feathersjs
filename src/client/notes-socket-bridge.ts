/** Bridge for Feathers v5 Socket.IO `notes <event>` notifications.
 * Construct for one SSR request or one browser Pinia root. Never a module singleton.
 * Socket event payloads are discarded: reconciliation reads the service.
 */
import { createFeathersRequestScope, type EventHandler, type RealtimeEmitter } from './ssr-request-scope.js'
import { createRealtimeReconciliation, type ReconciliationController, type ReconciliationPort, type ReadNotes } from './realtime-reconcile.js'

export interface NotesSocket extends RealtimeEmitter {
  readonly connected: boolean
  disconnect(): unknown
}
export interface NotesSocketBindingOptions {
  readonly socket: NotesSocket
  readonly readNotes: ReadNotes
  readonly store: ReconciliationPort
  readonly ownership: 'owned' | 'borrowed'
  readonly identity?: string | null
}
export interface NotesSocketBinding {
  readonly controller: ReconciliationController
  readonly refresh: () => Promise<void>
  readonly close: () => Promise<void>
}

const FEATHERS_EVENTS = new Set(['created', 'updated', 'patched', 'removed'])
const CONNECTION_EVENTS = new Set(['connect', 'disconnect', 'connect_error'])

export function createNotesSocketBinding(options: NotesSocketBindingOptions): NotesSocketBinding {
  if (!options || typeof options !== 'object' || !options.socket ||
    typeof options.socket.on !== 'function' || typeof options.socket.off !== 'function' ||
    typeof options.socket.disconnect !== 'function' ||
    typeof options.socket.connected !== 'boolean' ||
    typeof options.readNotes !== 'function' || !options.store ||
    typeof options.store.update !== 'function' ||
    (options.ownership !== 'owned' && options.ownership !== 'borrowed')) {
    throw new TypeError('Invalid notes socket binding')
  }
  const { socket } = options
  let active = true
  // Reconciliation subscribes to ordinary service event names; Feathers v5 Socket.IO
  // announces service events with the actual path prefix: `notes created`.
  const serviceEvents: RealtimeEmitter = {
    on(event: string, handler: EventHandler): void {
      if (!FEATHERS_EVENTS.has(event)) throw new TypeError('Unsupported Feathers event')
      socket.on(`notes ${event}`, handler)
    },
    off(event: string, handler: EventHandler): void {
      if (!FEATHERS_EVENTS.has(event)) throw new TypeError('Unsupported Feathers event')
      socket.off(`notes ${event}`, handler)
    }
  }
  const connection: RealtimeEmitter = {
    on(event: string, handler: EventHandler): void {
      if (!CONNECTION_EVENTS.has(event)) throw new TypeError('Unsupported socket connection event')
      socket.on(event, handler)
      // Bindings may be created after the socket has connected. The microtask
      // replays only the connection state, not arbitrary socket data.
      if (event === 'connect' && socket.connected) {
        queueMicrotask(() => { if (active && socket.connected) handler() })
      }
    },
    off(event: string, handler: EventHandler): void {
      if (!CONNECTION_EVENTS.has(event)) throw new TypeError('Unsupported socket connection event')
      socket.off(event, handler)
    }
  }
  const scope = createFeathersRequestScope(() => ({
    identity: options.identity ?? null,
    transport: serviceEvents,
    dispose: () => { active = false; if (options.ownership === 'owned') socket.disconnect() }
  }))
  try {
    const controller = createRealtimeReconciliation({
      scope, connection, service: options.readNotes, store: options.store
    })
    return Object.freeze({ controller, refresh: () => controller.refresh(), close: () => controller.close() })
  } catch {
    active = false
    void scope.close().catch(() => {})
    throw new Error('Notes socket binding failed')
  }
}
