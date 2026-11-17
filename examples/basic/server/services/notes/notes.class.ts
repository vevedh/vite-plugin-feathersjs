import { NotFound } from '@feathersjs/errors'
import type { Note } from '../../../shared/feathers/notes.schema'
import { parseNoteId, parseNoteTitle } from './notes.schema'

/** One in-memory store per application instance; demo only, never public production storage. */
export class NotesService {
  private readonly records = new Map<number, Note>([[1, { id: 1, title: 'Hello from FeathersJS v5' }]])
  private nextId = 2

  async find(): Promise<Note[]> {
    return [...this.records.values()].map(record => ({ ...record }))
  }

  async get(id: unknown): Promise<Note> {
    const note = this.records.get(parseNoteId(id))
    if (!note) throw new NotFound('Note not found')
    return { ...note }
  }

  async create(data: unknown): Promise<Note> {
    const note: Note = { id: this.nextId++, title: parseNoteTitle(data) }
    this.records.set(note.id, note)
    return { ...note }
  }

  async patch(id: unknown, data: unknown): Promise<Note> {
    const key = parseNoteId(id)
    const previous = this.records.get(key)
    if (!previous) throw new NotFound('Note not found')
    const note: Note = { ...previous, title: parseNoteTitle(data) }
    this.records.set(key, note)
    return { ...note }
  }

  async remove(id: unknown): Promise<Note> {
    const key = parseNoteId(id)
    const note = this.records.get(key)
    if (!note) throw new NotFound('Note not found')
    this.records.delete(key)
    return { ...note }
  }
}
