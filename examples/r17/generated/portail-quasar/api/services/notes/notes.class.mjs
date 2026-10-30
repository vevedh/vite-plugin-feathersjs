import { NotFound, BadRequest } from '@feathersjs/errors'
export class NotesService {
  // Feathers v5 exposes service methods through its own service wrapper. The
  // wrapper is not necessarily this class instance, so native #private slots
  // cannot be read through an unbound method call. Bind to the owning instance.
  // Keep this per-service-instance: never hoist records or IDs to module scope.
  constructor() {
    for (const name of ['find', 'get', 'create', 'patch', 'remove']) {
      this[name] = this[name].bind(this)
    }
  }
  #records = new Map([[1, { id: 1, title: 'Hello from FeathersJS v5' }]])
  #nextId = 2
  #id(value) { const n = Number(value); if (!Number.isSafeInteger(n) || n < 1) throw new BadRequest('Invalid note ID'); return n }
  #title(value) {
    const title = value?.title
    if (typeof title !== 'string' || title.trim().length < 1 || title.length > 120) throw new BadRequest('Invalid note title')
    return title.trim()
  }
  async find() { return [...this.#records.values()].map(note => ({ ...note })) }
  async get(id) { const note = this.#records.get(this.#id(id)); if (!note) throw new NotFound('Note not found'); return { ...note } }
  async create(data) { const note = { id: this.#nextId++, title: this.#title(data) }; this.#records.set(note.id, note); return { ...note } }
  async patch(id, data) { const key = this.#id(id); if (!this.#records.has(key)) throw new NotFound('Note not found'); const note = { id: key, title: this.#title(data) }; this.#records.set(key, note); return { ...note } }
  async remove(id) { const key = this.#id(id); const note = this.#records.get(key); if (!note) throw new NotFound('Note not found'); this.#records.delete(key); return { ...note } }
}
