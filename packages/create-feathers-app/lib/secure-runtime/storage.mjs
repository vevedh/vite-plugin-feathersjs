/** Explicit schema provisioning. Never drops tables, collections, records or indexes. */
export const storageNames = Object.freeze({ users: 'app_users', documents: 'app_documents' })
export async function prepareIdentityStorage(provider) {
  if (!provider || !['postgresql','mariadb','mongodb'].includes(provider.adapter)) throw Error('UNSUPPORTED_PROVIDER')
  const { users, documents } = storageNames
  if (provider.adapter === 'mongodb') {
    for (const name of [users, documents]) {
      try { await provider.db.createCollection(name) } catch (error) { if (error?.code !== 48) throw error }
    }
    await provider.db.collection(users).createIndex({ id: 1 }, { unique: true })
    await provider.db.collection(users).createIndex({ email: 1 }, { unique: true })
    await provider.db.collection(documents).createIndex({ id: 1 }, { unique: true })
    await provider.db.collection(documents).createIndex({ ownerId: 1 })
  } else {
    const db = provider.db
    if (!await db.schema.hasTable(users)) await db.schema.createTable(users, t => {
      t.string('id', 36).primary(); t.string('email', 120).notNullable().unique()
      t.string('password', 120).notNullable(); t.string('role', 16).notNullable()
      t.string('status', 16).notNullable(); t.integer('sessionVersion').notNullable()
    })
    if (!await db.schema.hasTable(documents)) await db.schema.createTable(documents, t => {
      t.string('id', 36).primary(); t.string('title', 80).notNullable()
      t.string('ownerId', 36).notNullable().index(); t.text('internal').nullable()
    })
    // Existing tables must contain every required column; no implicit destructive migration.
    for (const [table, columns] of [[users, ['id','email','password','role','status','sessionVersion']], [documents, ['id','title','ownerId','internal']]]) {
      for (const column of columns) if (!await db.schema.hasColumn(table, column)) throw Error('SCHEMA_MIGRATION_REQUIRED')
    }
  }
  return storageNames
}
