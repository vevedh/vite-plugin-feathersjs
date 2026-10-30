import { defineStore } from 'pinia'
import { ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
export interface Note { id: number; title: string }
const realtime = import.meta.env.VITE_FEATHERS_REALTIME === '1'
export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([])
  const loading = ref(false)
  const error = ref('')
  const realtimeConnected = ref(false)
  let socket: Socket | undefined
  async function load(): Promise<void> {
    try {
      const response = await fetch('/api/notes', { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload: unknown = await response.json()
      if (!Array.isArray(payload)) throw new Error('Unexpected notes response')
      notes.value = payload as Note[]
      error.value = ''
    }
    catch (cause) { error.value = cause instanceof Error ? cause.message : 'API unavailable' }
  }
  async function create(title: string): Promise<void> {
    if (loading.value || !title.trim()) return
    loading.value = true
    try {
      const response = await fetch('/api/notes', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await load()
    }
    catch (cause) { error.value = cause instanceof Error ? cause.message : 'Create failed' }
    finally { loading.value = false }
  }
  function connectRealtime(): void {
    if (!realtime || typeof window === 'undefined' || socket) return
    socket = io(window.location.origin, { path: '/socket.io', transports: ['websocket'] })
    socket.on('connect', () => { realtimeConnected.value = true })
    socket.on('disconnect', () => { realtimeConnected.value = false })
    socket.on('notes created', () => { void load() })
  }
  function disconnectRealtime(): void { socket?.disconnect(); socket = undefined; realtimeConnected.value = false }
  return { notes, loading, error, realtimeConnected, load, create, connectRealtime, disconnectRealtime }
})
