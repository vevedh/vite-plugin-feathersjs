import { defineStore } from 'pinia'
import { ref } from 'vue'
import { feathers } from '@feathersjs/feathers'
import rest from '@feathersjs/rest-client'
import socketioClient from '@feathersjs/socketio-client'
import { io, type Socket } from 'socket.io-client'

export interface Note { id: number; title: string }
function baseUrl() {
  return typeof window === 'undefined'
    ? (process.env.FEATHERS_INTERNAL_URL || 'http://127.0.0.1:3030/api')
    : `${window.location.origin}/api`
}
function createClient() {
  const client = feathers()
  client.configure(rest(baseUrl()).fetch(globalThis.fetch.bind(globalThis)))
  return client
}
export const useNotesStore = defineStore('quasar-ssr-notes', () => {
  const notes = ref<Note[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const realtimeConnected = ref(false)
  // Store instance is created in each Quasar SSR request.
  // Socket connection is always browser-only and never persisted in Pinia state.
  let socket: Socket | undefined
  let removeListeners: (() => void) | undefined
  async function load() {
    loading.value = true
    error.value = null
    try {
      const service = createClient().service('notes')
      const result = await service.find() as Note[]
      notes.value = result
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'API indisponible'
      throw cause
    } finally { loading.value = false }
  }
  async function create(title: string) {
    if (!title.trim()) throw new Error('Le titre est obligatoire')
    await createClient().service('notes').create({ title: title.trim() })
    await load()
  }
  function connectRealtime() {
    if (typeof window === 'undefined' || socket) return
    if (import.meta.env.VITE_FEATHERS_REALTIME !== '1') return
    const ws = io(window.location.origin, { path: '/socket.io', transports: ['websocket', 'polling'], autoConnect: false })
    // Browser-only, per-store connection state. Neither socket nor listeners are serialized by SSR.
    ws.on('connect', () => { realtimeConnected.value = true })
    ws.on('disconnect', () => { realtimeConnected.value = false })
    ws.on('connect_error', () => { realtimeConnected.value = false })
    const realtimeClient = feathers()
    realtimeClient.configure(socketioClient(ws))
    const service = realtimeClient.service('notes')
    const refresh = () => { void load().catch(() => {}) }
    for (const event of ['created', 'patched', 'removed', 'updated']) service.on(event, refresh)
    removeListeners = () => { for (const event of ['created', 'patched', 'removed', 'updated']) service.off(event, refresh) }
    socket = ws
    ws.connect()
  }
  function disconnectRealtime() {
    removeListeners?.()
    removeListeners = undefined
    socket?.removeAllListeners('connect')
    socket?.removeAllListeners('disconnect')
    socket?.removeAllListeners('connect_error')
    socket?.disconnect()
    socket = undefined
    realtimeConnected.value = false
  }
  return { notes, loading, error, realtimeConnected, load, create, connectRealtime, disconnectRealtime }
})
