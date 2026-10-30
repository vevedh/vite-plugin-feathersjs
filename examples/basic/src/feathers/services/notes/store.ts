import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createNotesApi, isNote, normalizeTitle, validateNotes } from '~/lib/feathers-client'
import type { Note, NoteEvent, NotesApi } from '~/lib/feathers-client'

declare const __FEATHERS_SOCKET_ENABLED__: boolean
declare const __FEATHERS_SOCKET_PORT__: number

type ConnectionStatus = 'disabled' | 'disconnected' | 'connected'

/** Dedicated Pinia store; no browser socket or service is instantiated during SSR. */
export const useNotesStore = defineStore('feathers-notes', () => {
  const byId = ref<Record<number, Note>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const status = ref<ConnectionStatus>('disabled')
  const events = ref<string[]>([])
  const notes = computed(() => Object.values(byId.value).sort((a, b) => a.id - b.id))
  let api: NotesApi | undefined
  let disposed = false
  let epoch = 0
  const listeners: Array<{ event: NoteEvent; listener: (note: Note) => void }> = []

  function upsert(note: Note): void { byId.value = { ...byId.value, [note.id]: note } }
  function removeLocal(id: number): void {
    const next = { ...byId.value }
    delete next[id]
    byId.value = next
  }
  function applyEvent(event: NoteEvent, note: Note): void {
    if (event === 'removed') removeLocal(note.id)
    else upsert(note)
    events.value = [`${event}: #${note.id}`, ...events.value].slice(0, 10)
  }

  async function refresh(): Promise<void> {
    if (!api) return
    const active = api
    const version = epoch
    loading.value = true
    error.value = null
    try {
      const result: unknown = await active.service.find()
      const records = validateNotes(result)
      if (disposed || version !== epoch) return
      byId.value = Object.fromEntries(records.map(note => [note.id, note]))
    }
    catch (cause: unknown) {
      if (version === epoch) error.value = cause instanceof Error ? cause.message : 'Unable to load notes'
    }
    finally { if (version === epoch) loading.value = false }
  }

  async function run(action: (current: NotesApi) => Promise<Note>, event: NoteEvent): Promise<void> {
    if (!api || loading.value) return
    loading.value = true
    error.value = null
    try {
      const result: unknown = await action(api)
      if (!isNote(result)) throw new Error('Invalid note response')
      // REST has no remote events; Socket.IO also applies the result optimistically.
      if (event === 'removed') removeLocal(result.id)
      else upsert(result)
    }
    catch (cause: unknown) { error.value = cause instanceof Error ? cause.message : 'Service operation failed' }
    finally { loading.value = false }
  }

  async function create(title: string): Promise<void> {
    let safe: string
    try { safe = normalizeTitle(title) }
    catch (cause: unknown) { error.value = cause instanceof Error ? cause.message : 'Invalid title'; return }
    await run(current => current.service.create({ title: safe }), 'created')
  }
  async function patch(id: number, title: string): Promise<void> {
    if (!Number.isSafeInteger(id) || id < 1) { error.value = 'Invalid note id'; return }
    let safe: string
    try { safe = normalizeTitle(title) }
    catch (cause: unknown) { error.value = cause instanceof Error ? cause.message : 'Invalid title'; return }
    await run(current => current.service.patch(id, { title: safe }), 'patched')
  }
  async function remove(id: number): Promise<void> {
    if (!Number.isSafeInteger(id) || id < 1) { error.value = 'Invalid note id'; return }
    await run(current => current.service.remove(id), 'removed')
  }

  function connect(): void {
    if (typeof window === 'undefined' || api) return
    disposed = false
    epoch++
    try {
      api = createNotesApi(__FEATHERS_SOCKET_ENABLED__, __FEATHERS_SOCKET_PORT__)
      status.value = api.socket ? 'disconnected' : 'disabled'
      if (api.socket) {
        api.socket.on('connect', () => { status.value = 'connected'; void refresh() })
        api.socket.on('disconnect', () => { status.value = 'disconnected' })
        for (const event of ['created', 'patched', 'removed'] as const) {
          const listener = (note: Note): void => { if (isNote(note)) applyEvent(event, note) }
          api.service.on(event, listener)
          listeners.push({ event, listener })
        }
        api.socket.connect()
      }
      void refresh()
    }
    catch (cause: unknown) { error.value = cause instanceof Error ? cause.message : 'Connection failed' }
  }

  function disconnect(): void {
    disposed = true
    epoch++
    if (api) {
      for (const { event, listener } of listeners) api.service.off(event, listener)
      listeners.length = 0
      api.disconnect()
    }
    api = undefined
    status.value = __FEATHERS_SOCKET_ENABLED__ ? 'disconnected' : 'disabled'
  }

  return { notes, loading, error, status, events, connect, disconnect, refresh, create, patch, remove }
})
