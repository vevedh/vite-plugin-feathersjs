import { feathers } from '@feathersjs/feathers'
import rest from '@feathersjs/rest-client'
import socketio from '@feathersjs/socketio-client'
import { io, type Socket } from 'socket.io-client'

import { notesPath } from '../../shared/feathers/notes.schema'
import type { Note, NoteEvent } from '../../shared/feathers/notes.schema'
export type { Note, NoteEvent } from '../../shared/feathers/notes.schema'
export { isNote, validateNotes, normalizeTitle } from '../../shared/feathers/notes.schema'

export interface Health {
  status: string
  transport: string
}

export interface NotesService {
  find(): Promise<Note[]>
  get(id: number): Promise<Note>
  create(data: { title: string }): Promise<Note>
  patch(id: number, data: { title: string }): Promise<Note>
  remove(id: number): Promise<Note>
  on(event: NoteEvent, listener: (note: Note) => void): void
  off(event: NoteEvent, listener: (note: Note) => void): void
}

export interface FeathersServiceApi<TService> {
  service: TService
  socket?: Socket
  disconnect(): void
}

export type NotesApi = FeathersServiceApi<NotesService>

function requireBrowser(): void {
  if (typeof window === 'undefined')
    throw new Error('Feathers demo client is browser-only')
}

/** Single Feathers v5 service transport, shared by all generated client adapters. */
export function createFeathersServiceApi<TService>(path: string, realtime: boolean, port: number): FeathersServiceApi<TService> {
  requireBrowser()
  if (!/^[a-z][a-z0-9-]*$/.test(path)) throw new Error('Invalid service path')
  const client = feathers()
  let socket: Socket | undefined
  if (realtime) {
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
      throw new Error('Invalid Socket.IO port')
    const url = `${window.location.protocol}//${window.location.hostname}:${port}`
    socket = io(url, { autoConnect: false, transports: ['websocket'], reconnection: true })
    client.configure(socketio(socket))
  }
  else {
    // The plugin exposes REST services through Vite middleware mounted at /api.
    client.configure(rest(`${window.location.origin}/api`).fetch(window.fetch.bind(window)))
  }
  const service = client.service(path) as unknown as TService
  const result: FeathersServiceApi<TService> = {
    service,
    disconnect() { socket?.removeAllListeners(); socket?.disconnect() },
  }
  if (socket) result.socket = socket
  return result
}

/** Compatibility wrapper retained for Basic r11/r12 imports. */
export function createNotesApi(realtime: boolean, port: number): NotesApi {
  return createFeathersServiceApi<NotesService>(notesPath, realtime, port)
}
