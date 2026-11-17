import { defineStore } from 'pinia'
import { ref } from 'vue'
import { io, type Socket } from 'socket.io-client'

export interface Note { id: number; title: string }
const realtime = import.meta.env.VITE_FEATHERS_REALTIME === '1'

function isNote(value: unknown): value is Note {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'number' && Number.isSafeInteger(record.id) && record.id > 0
    && typeof record.title === 'string' && record.title.length <= 120
}

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([])
  const loading = ref(false)
  const error = ref('')
  const apiAvailable = ref(false)
  const apiChecked = ref(false)
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
  const realtimeConnected = ref(false)
  let socket: Socket | undefined

  function explainError(cause: unknown): string {
    if (!online.value) return 'Hors ligne : l’interface reste disponible, mais les notes nécessitent la connexion à l’API.'
    if (cause instanceof Error && /^HTTP (404|502|503)$/.test(cause.message)) {
      return 'API Feathers indisponible. En prévisualisation, lancer aussi le serveur API local (pnpm run dev:api).'
    }
    return 'Connexion à l’API impossible. Vérifier le serveur Feathers et le proxy /api.'
  }

  async function load(): Promise<void> {
    if (!online.value) {
      apiAvailable.value = false
      apiChecked.value = true
      error.value = explainError(new Error('offline'))
      return
    }
    try {
      const response = await fetch('/api/notes', {
        headers: { Accept: 'application/json' }, cache: 'no-store',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload: unknown = await response.json()
      if (!Array.isArray(payload) || !payload.every(isNote)) throw new Error('Invalid notes response')
      notes.value = payload
      apiAvailable.value = true
      error.value = ''
    } catch (cause: unknown) {
      apiAvailable.value = false
      error.value = explainError(cause)
    } finally {
      apiChecked.value = true
    }
  }

  async function create(title: string): Promise<void> {
    const value = title.trim()
    if (loading.value || !apiAvailable.value || !online.value || value.length < 1 || value.length > 120) return
    loading.value = true
    try {
      const response = await fetch('/api/notes', {
        method: 'POST', headers: { 'content-type': 'application/json', Accept: 'application/json' },
        cache: 'no-store', body: JSON.stringify({ title: value }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await load()
    } catch (cause: unknown) {
      apiAvailable.value = false
      error.value = explainError(cause)
      // Never retry POST automatically: the server may have created the note.
    } finally {
      loading.value = false
    }
  }

  function setConnectivity(connected: boolean): void {
    online.value = connected
    if (!connected) {
      apiAvailable.value = false
      error.value = explainError(new Error('offline'))
      socket?.disconnect()
      realtimeConnected.value = false
    } else {
      void load()
      socket?.connect()
    }
  }

  function connectRealtime(): void {
    if (!realtime || typeof window === 'undefined' || socket || !online.value) return
    socket = io(window.location.origin, { path: '/socket.io', transports: ['websocket'] })
    socket.on('connect', () => { realtimeConnected.value = true })
    socket.on('disconnect', () => { realtimeConnected.value = false })
    socket.on('notes created', () => { void load() })
  }
  function disconnectRealtime(): void {
    socket?.disconnect()
    socket = undefined
    realtimeConnected.value = false
  }
  return { notes, loading, error, apiAvailable, apiChecked, online,
    realtimeConnected, load, create, setConnectivity, connectRealtime, disconnectRealtime }
})
