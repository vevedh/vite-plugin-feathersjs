import { randomInt } from 'node:crypto'
import { BadRequest, NotFound } from '@feathersjs/errors'

// Laboratory-only, unauthenticated Feathers service using a real database adapter.
// Never expose it beyond the local reverse proxy; P5-R6-B will add JWT/RBAC.
function idOf(value) {
  const n = typeof value === 'string' && /^[1-9][0-9]{0,9}$/.test(value) ? Number(value) : value
  if (!Number.isSafeInteger(n) || n < 1 || n > 2147483647) throw new BadRequest('Invalid note ID')
  return n
}
function titleOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).join(',') !== 'title') {
    throw new BadRequest('Invalid note data')
  }
  const title = value.title
  if (typeof title !== 'string' || title.trim().length < 1 || title.length > 120 || /[\u0000-\u001f\u007f]/.test(title)) {
    throw new BadRequest('Invalid note title')
  }
  return title.trim()
}
function noQuery(params) {
  const query = params?.query
  if (query !== undefined && (query === null || typeof query !== 'object' || Array.isArray(query) || Object.keys(query).length !== 0)) {
    throw new BadRequest('Query operators are not allowed in this laboratory service')
  }
}
function present(value) {
  if (!value || typeof value !== 'object') throw new Error('DB_RECORD_INVALID')
  const id = idOf(value.id)
  if (typeof value.title !== 'string') throw new Error('DB_RECORD_INVALID')
  return { id, title: value.title }
}
export class PersistentNotesService {
  constructor(databaseAdapter) {
    if (!databaseAdapter || ['find','get','create','patch','remove'].some(name => typeof databaseAdapter[name] !== 'function')) {
      throw new Error('DB_ADAPTER_REQUIRED')
    }
    this.adapter = databaseAdapter
    for (const method of ['find','get','create','patch','remove']) this[method] = this[method].bind(this)
  }
  async find(params) {
    noQuery(params)
    const rows = await this.adapter.find({ query: { $limit: 100 }, paginate: false })
    if (!Array.isArray(rows)) throw new Error('DB_LIST_INVALID')
    return rows.map(present)
  }
  async get(id, params) {
    noQuery(params)
    try { return present(await this.adapter.get(idOf(id))) }
    catch (error) { if (error?.code === 404) throw new NotFound('Note not found'); throw error }
  }
  async create(data, params) {
    noQuery(params)
    // Numeric IDs retain compatibility with the published Vue/Pinia Note interface.
    // No in-memory counter; id uniqueness is enforced by the DB primary key/index.
    return present(await this.adapter.create({ id: randomInt(1, 2147483647), title: titleOf(data) }))
  }
  async patch(id, data, params) {
    noQuery(params)
    try { return present(await this.adapter.patch(idOf(id), { title: titleOf(data) })) }
    catch (error) { if (error?.code === 404) throw new NotFound('Note not found'); throw error }
  }
  async remove(id, params) {
    noQuery(params)
    try { return present(await this.adapter.remove(idOf(id))) }
    catch (error) { if (error?.code === 404) throw new NotFound('Note not found'); throw error }
  }
}
