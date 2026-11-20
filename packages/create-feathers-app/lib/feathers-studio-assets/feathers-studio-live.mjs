/** Feathers Studio R7: opt-in local runtime observation. No records or credentials. */
const METHODS = Object.freeze(['created', 'updated', 'patched', 'removed'])
const identifier = value => typeof value === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && value.length <= 48

export function createFeathersStudioLiveBridge() {
  let generation = 0
  let services = new Map()
  let unsubscribe = []
  let sequence = 0
  const listeners = new Set()
  const recent = []

  function publish(kind, service) {
    if (kind !== 'registry' && !METHODS.includes(kind)) return
    const item = { sequence: ++sequence, kind, service }
    recent.push(item)
    if (recent.length > 32) recent.shift()
    for (const listener of listeners) {
      try { listener(item) } catch { listeners.delete(listener) }
    }
  }
  function detach() {
    for (const stop of unsubscribe) stop()
    unsubscribe = []
  }
  function afterRegister(app) {
    if (!app || (typeof app !== 'object' && typeof app !== 'function') || !app.services || typeof app.services !== 'object' || typeof app.service !== 'function') throw Error('INVALID_FEATHERS_APPLICATION')
    const paths = Object.keys(app.services)
    if (paths.length > 128) throw Error('RUNTIME_SERVICE_LIMIT')
    // Validate all paths before attaching any event listener.
    const normalized = paths.map(path => ({ path, name: path.replace(/^\/+/, '') }))
    if (normalized.some(entry => !identifier(entry.name)) || new Set(normalized.map(entry => entry.name)).size !== normalized.length) throw Error('RUNTIME_SERVICE_PATH_REFUSED')
    const next = new Map()
    const subs = []
    try {
      for (const entry of normalized) {
        const service = app.service(entry.path)
        if (!service || typeof service !== 'object') throw Error('RUNTIME_SERVICE_MISSING')
        next.set(entry.name, { name: entry.name, eventsObserved: 0, status: 'registered' })
        if (typeof service.on === 'function' && typeof service.off === 'function') {
          for (const kind of METHODS) {
            const handle = () => {
              const item = next.get(entry.name)
              if (!item || services !== next) return
              item.eventsObserved = Math.min(item.eventsObserved + 1, 999999)
              // Deliberately discard event arguments, record ids, query params and user context.
              publish(kind, entry.name)
            }
            service.on(kind, handle)
            subs.push(() => service.off(kind, handle))
          }
        }
      }
    } catch (error) {
      for (const stop of subs.reverse()) stop()
      throw error
    }
    detach()
    services = next
    unsubscribe = subs
    generation++
    publish('registry', 'runtime')
  }
  function snapshot() {
    return { version: 1, mode: 'READ_ONLY', generation, services: [...services.values()].map(entry => ({ ...entry })), recent: recent.slice(-20).map(item => ({ ...item })) }
  }
  function subscribe(listener) {
    if (typeof listener !== 'function' || listeners.size >= 6) throw Error('LIVE_SUBSCRIBERS_LIMIT')
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  function close() {
    detach()
    services = new Map()
    listeners.clear()
  }
  return Object.freeze({ afterRegister, snapshot, subscribe, close })
}
