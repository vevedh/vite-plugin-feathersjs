// Browser-only and read-only. Never execute or render contract content as HTML.
const byId = (id) => document.getElementById(id)
const state = { services: [], selected: '' }
function text(node, value) { node.textContent = String(value ?? '') }
function el(tag, className, value) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (value !== undefined) text(node, value)
  return node
}
function show() {
  const current = state.services.find((service) => service.name === state.selected)
  const sidebar = byId('services')
  sidebar.replaceChildren()
  for (const service of state.services) {
    const button = el('button', 'service')
    button.type = 'button'
    button.setAttribute('aria-current', String(service.name === state.selected))
    button.append(el('b', '', service.name), el('small', '', `${service.schema} · ${service.fields.length} champs`))
    button.addEventListener('click', () => { state.selected = service.name; show() })
    sidebar.append(button)
  }
  text(byId('counter'), `${state.services.length} service(s) · catalogue local`)
  text(byId('service-title'), current ? `Service ${current.name}` : 'Inspecteur des services')
  text(byId('service-route'), current ? current.route : 'Aucun contrat validé trouvé dans api/services/*/contract.json')
  const details = byId('details')
  const model = byId('model')
  details.replaceChildren()
  model.replaceChildren()
  const prepare = byId('prepare-draft')
  prepare.disabled = !current || current.schema === 'manual' || !current.sourceVerified
  if (!current) return
  for (const [key, value] of [['Moteur', current.schema], ['Documentation', current.docs], ['Route', current.route], ['Méthodes', current.methods.join(', ')], ['Sources', current.sourceVerified ? 'Empreintes vérifiées' : 'Non vérifiées'], ['SHA-256 contrat', current.fingerprint || 'Indisponible']]) {
    details.append(el('dt', '', key), el('dd', '', value))
  }
  for (const field of current.fields) {
    const tile = el('article', 'field')
    const heading = el('div', 'field-head')
    heading.append(el('span', 'field-name', field.name), el('span', 'field-type', field.type))
    const badge = el('div', field.required ? 'field-badge' : 'field-badge optional', field.required ? '● Obligatoire' : '○ Facultatif')
    tile.append(heading, badge, el('small', 'constraint', field.type === 'string' ? `Longueur : ${field.minLength}–${field.maxLength}` : ''))
    model.append(tile)
  }
}
async function load() {
  text(byId('notice'), 'Lecture du catalogue…')
  try {
    const response = await fetch('/__feathers-studio/catalog', { credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } })
    if (!response.ok) throw Error('Catalogue indisponible')
    const body = await response.json()
    if (body?.mode !== 'READ_ONLY' || body?.version !== 1 || !Array.isArray(body.services)) throw Error('Contrat de catalogue invalide')
    state.services = body.services
    if (!state.services.some((item) => item.name === state.selected)) state.selected = state.services[0]?.name ?? ''
    text(byId('notice'), state.services.length ? 'Source canonique · consultation uniquement' : 'Aucun contrat canonique disponible. Les services sans contract.json ne sont pas exposés.')
    show()
  } catch {
    state.services = []; state.selected = ''; show()
    text(byId('notice'), 'Lecture refusée : vérifiez le serveur de développement et les contrats locaux.')
  }
}
byId('reload').addEventListener('click', () => { void load() })
void load()

// A navigation action only: never POST, never generate an executable migration.
byId('prepare-draft').addEventListener('click', () => {
  const service = state.services.find(item => item.name === state.selected)
  if (!service || service.schema === 'manual' || service.sourceVerified !== true || !/^[a-z][a-z0-9]{0,47}$/.test(service.name)) return
  window.open(`/schema-designer.html?service=${encodeURIComponent(service.name)}`, '_blank', 'noopener,noreferrer')
})


// R7: only server-filtered registry metadata; never display business records.
function showRuntime(snapshot) {
  const services = byId('runtime-services')
  const databases = byId('runtime-databases')
  services.replaceChildren()
  databases.replaceChildren()
  if (snapshot?.mode !== 'READ_ONLY' || snapshot?.version !== 1 || !Array.isArray(snapshot.services) || !Array.isArray(snapshot.databases)) return
  const runtimeNames = new Set(snapshot.services.map(item => item.name))
  for (const service of snapshot.services.slice(0, 64)) {
    const item = el('div', 'live-row')
    item.append(el('b', '', service.name), el('small', '', `Enregistré · événements : ${service.eventsObserved ?? 0}`))
    services.append(item)
  }
  if (runtimeNames.size === 0) services.append(el('div', 'hint', 'Aucun service enregistré observé'))
  for (const database of snapshot.databases.slice(0, 8)) {
    const item = el('div', 'live-row')
    item.append(el('b', '', `${database.alias} · ${database.engine}`), el('small', '', 'Déclarée · connexion non vérifiée'))
    databases.append(item)
  }
  if (snapshot.databases.length === 0) databases.append(el('div', 'hint', 'Aucune base déclarée'))
}
let runtimeRefreshTimer = null
function scheduleRuntimeRefresh() {
  if (runtimeRefreshTimer !== null) return
  runtimeRefreshTimer = setTimeout(() => { runtimeRefreshTimer = null; void loadRuntime() }, 750)
}
function showLiveEvent(event) {
  const list = byId('runtime-events')
  if (!event || !['created', 'updated', 'patched', 'removed', 'registry'].includes(event.kind) || typeof event.service !== 'string') return
  list.prepend(el('li', '', `${event.kind} · ${event.service}`))
  while (list.childNodes.length > 20) list.lastChild?.remove()
}
async function loadRuntime() {
  try {
    const response = await fetch('/__feathers-studio/runtime', { credentials: 'omit', cache: 'no-store' })
    if (!response.ok) throw Error('Unavailable')
    const snapshot = await response.json()
    showRuntime(snapshot)
  } catch {
    text(byId('live-connection'), 'Runtime indisponible')
  }
}
void loadRuntime()
// SSE is same-origin, unidirectional and never transmits record contents.
const liveEvents = new EventSource('/__feathers-studio/events', { withCredentials: false })
liveEvents.addEventListener('open', () => { text(byId('live-connection'), 'Connecté'); void loadRuntime() })
liveEvents.addEventListener('error', () => { text(byId('live-connection'), 'Reconnexion…') })
liveEvents.addEventListener('service', (message) => {
  try { showLiveEvent(JSON.parse(message.data)); scheduleRuntimeRefresh() } catch { /* Invalid event ignored */ }
})
liveEvents.addEventListener('registry', () => { void loadRuntime() })
window.addEventListener('pagehide', () => { liveEvents.close(); if (runtimeRefreshTimer !== null) clearTimeout(runtimeRefreshTimer) }, { once: true })
