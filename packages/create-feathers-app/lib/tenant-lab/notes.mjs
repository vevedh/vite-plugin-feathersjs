import { randomInt } from 'node:crypto'
import { BadRequest, NotFound, Forbidden } from '@feathersjs/errors'
import { canAccessNotes } from './auth-rbac-policy.mjs'
import { readTenantScope } from './tenant-scope.mjs'

const TABLE = 'app_notes'
function scopeFor(params,method) {
  const scope=readTenantScope(params)
  if(!canAccessNotes(scope.role,method))throw new Forbidden('Forbidden')
  return scope
}
function idOf(input) {
  const number = typeof input === 'string' && /^[1-9][0-9]{0,9}$/.test(input) ? Number(input) : input
  if (!Number.isSafeInteger(number) || number < 1 || number > 2147483647) throw new BadRequest('Invalid note id')
  return number
}
function titleOf(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)
      || Object.keys(data).length !== 1 || !Object.hasOwn(data,'title')
      || typeof data.title !== 'string' || data.title.trim().length < 1 || data.title.length > 120
      || /[\u0000-\u001f\u007f]/.test(data.title)) throw new BadRequest('Invalid note data')
  return data.title.trim()
}
function checkQuery(params) {
  const query = params?.query
  // This profile deliberately supports NO client-side operators (including
  // $or/$in, tenantId, ownerId, $limit and array filters).
  if (query !== undefined && (query === null || typeof query !== 'object' || Array.isArray(query)
      || Object.keys(query).length !== 0)) throw new BadRequest('Query refused')
}
function view(record) {
  if (!record) throw new NotFound('Note not found')
  // Do not expose tenant/owner identifiers in the public Note DTO.
  return { id: idOf(record.id), title: record.title }
}
export class TenantNotesService {
  constructor(provider) {
    if (!provider || !['postgresql','mariadb','mongodb'].includes(provider.adapter) || !provider.db) throw Error('TENANT_DB_REQUIRED')
    this.db = provider.db
    this.mongo = provider.adapter === 'mongodb'
    for(const method of ['find','get','create','patch','update','remove']) this[method]=this[method].bind(this)
  }
  criteria(scope, id, write=false) {
    const criteria = { tenant_id: scope.tenantId }
    if (id !== undefined) criteria.id = idOf(id)
    // Editors may modify ONLY their own notes; tenant admins may manage all
    // records inside their tenant. Cross-tenant superadmin is not supported.
    if (write && scope.role !== 'admin') criteria.owner_id = scope.ownerId
    return criteria
  }
  async find(params) {
    checkQuery(params)
    const scope = scopeFor(params,'find')
    const filter = this.criteria(scope)
    const records = this.mongo
      ? await this.db.collection(TABLE).find(filter).sort({ id: 1 }).limit(100).toArray()
      : await this.db(TABLE).where(filter).orderBy('id','asc').limit(100).select('*')
    return records.map(view)
  }
  async get(id,params) {
    checkQuery(params)
    const filter = this.criteria(scopeFor(params,'get'),id)
    const record = this.mongo
      ? await this.db.collection(TABLE).findOne(filter)
      : await this.db(TABLE).where(filter).first()
    return view(record)
  }
  async create(data,params) {
    checkQuery(params)
    const scope = scopeFor(params,'create')
    const record = { id: randomInt(1,2147483647), title: titleOf(data), tenant_id:scope.tenantId, owner_id:scope.ownerId }
    if (this.mongo) await this.db.collection(TABLE).insertOne(record)
    else await this.db(TABLE).insert(record)
    return view(record)
  }
  async patch(id,data,params) { return this.change(id,data,params,'patch') }
  async update(id,data,params) { return this.change(id,data,params,'update') }
  async change(id,data,params,method) {
    checkQuery(params)
    const scope = scopeFor(params,method)
    const title = titleOf(data)
    const filter = this.criteria(scope,id,true)
    if (this.mongo) {
      const result = await this.db.collection(TABLE).findOneAndUpdate(filter,{ $set:{ title } },{ returnDocument:'after',includeResultMetadata:false })
      return view(result)
    }
    const changed = await this.db(TABLE).where(filter).update({ title })
    if (changed !== 1) throw new NotFound('Note not found')
    return view(await this.db(TABLE).where(filter).first())
  }
  async remove(id,params) {
    checkQuery(params)
    const filter = this.criteria(scopeFor(params,'remove'),id,true)
    if (this.mongo) return view(await this.db.collection(TABLE).findOneAndDelete(filter,{includeResultMetadata:false}))
    const previous = await this.db(TABLE).where(filter).first()
    if (!previous || await this.db(TABLE).where(filter).del() !== 1) throw new NotFound('Note not found')
    return view(previous)
  }
}
