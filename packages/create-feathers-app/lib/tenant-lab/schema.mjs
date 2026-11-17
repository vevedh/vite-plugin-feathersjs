const NOTES = 'app_notes'
const USERS = 'app_auth_users'
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const supported = new Set(['postgresql','mariadb','mongodb'])
function requireProvider(provider) {
  if (!provider || !supported.has(provider.adapter) || !provider.db) throw Error('TENANT_PROVIDER_REQUIRED')
}
async function assertNoLegacyDocuments(coll, fields) {
  // $not also rejects null, non-strings, blanks and malformed UUIDs.
  const invalid = { $or: fields.map(field => ({ [field]:{ $not:UUID } })) }
  if (await coll.countDocuments(invalid,{limit:1})) throw Error('TENANT_LEGACY_DATA_REQUIRES_MIGRATION')
}
async function assertNoLegacyRows(db, table, columns) {
  const old = await db(table).whereNull(columns[0]).first()
  if (old) throw Error('TENANT_LEGACY_DATA_REQUIRES_MIGRATION')
  if (columns.length > 1 && await db(table).whereNull(columns[1]).first()) throw Error('TENANT_LEGACY_DATA_REQUIRES_MIGRATION')
}
export async function prepareTenantSchema(provider) {
  requireProvider(provider)
  const db = provider.db
  if (provider.adapter === 'mongodb') {
    const notes=db.collection(NOTES),users=db.collection(USERS)
    await assertNoLegacyDocuments(notes,['tenant_id','owner_id'])
    await assertNoLegacyDocuments(users,['tenant_id'])
    await notes.createIndex({tenant_id:1,id:1})
    await notes.createIndex({tenant_id:1,owner_id:1,id:1})
    await users.createIndex({tenant_id:1,id:1})
    return
  }
  const changed = new Set()
  for(const [name,fields] of [[NOTES,['tenant_id','owner_id']],[USERS,['tenant_id']]]){
    const missing=[]
    for (const field of fields) if (!await db.schema.hasColumn(name,field)) missing.push(field)
    if (missing.length) {
      // Refuse to assign historical rows to an arbitrary tenant. No destructive
      // migration and no "default organization" for existing data.
      const row = await db(name).first()
      if (row) throw Error('TENANT_LEGACY_DATA_REQUIRES_MIGRATION')
      await db.schema.alterTable(name, t => {
        for (const field of missing) t.string(field,36).notNullable()
      })
      changed.add(name)
    }
    await assertNoLegacyRows(db,name,fields)
  }
  // Indexes are created only during the first additive column migration;
  // recreating the Compose stack must not attempt to recreate them.
  if (changed.has(NOTES)) await db.schema.alterTable(NOTES,t => { t.index(['tenant_id','id'],'idx_notes_tenant_id');t.index(['tenant_id','owner_id'],'idx_notes_tenant_owner') })
  if (changed.has(USERS)) await db.schema.alterTable(USERS,t => { t.index(['tenant_id','id'],'idx_auth_users_tenant') })
}
export async function checkTenantSchema(provider) {
  requireProvider(provider)
  const db=provider.db
  if (provider.adapter==='mongodb') {
    for (const name of [NOTES,USERS]) if (!await db.listCollections({name}).hasNext()) throw Error('TENANT_SCHEMA_NOT_READY')
    await assertNoLegacyDocuments(db.collection(NOTES),['tenant_id','owner_id'])
    await assertNoLegacyDocuments(db.collection(USERS),['tenant_id'])
  } else {
    for (const [name, fields] of [[NOTES,['tenant_id','owner_id']],[USERS,['tenant_id']]]) {
      for (const field of fields) if (!await db.schema.hasColumn(name,field)) throw Error('TENANT_SCHEMA_NOT_READY')
      await assertNoLegacyRows(db,name,fields)
    }
  }
}
export function isTenantId(value) { return typeof value === 'string' && UUID.test(value) }
