// Explicit additive schema provisioning; never drop a table, document, index or volume.
const table = 'app_notes'
export async function prepareNotesStorage(provider) {
  if (!provider || !['postgresql','mariadb','mongodb'].includes(provider.adapter)) throw new Error('DB_UNSUPPORTED')
  if (provider.adapter === 'mongodb') {
    try { await provider.db.createCollection(table) }
    catch (error) { if (error?.code !== 48) throw error }
    await provider.db.collection(table).createIndex({ id: 1 }, { unique: true })
  } else {
    if (!await provider.db.schema.hasTable(table)) {
      await provider.db.schema.createTable(table, t => {
        t.integer('id').primary()
        t.string('title', 120).notNullable()
      })
    }
    for (const column of ['id', 'title']) {
      if (!await provider.db.schema.hasColumn(table, column)) throw new Error('DB_SCHEMA_MIGRATION_REQUIRED')
    }
  }
}
export async function checkNotesStorage(provider) {
  if (!provider || !['postgresql','mariadb','mongodb'].includes(provider.adapter)) throw new Error('DB_UNSUPPORTED')
  if (provider.adapter === 'mongodb') {
    if (!await provider.db.listCollections({ name: table }).hasNext()) throw new Error('DB_SCHEMA_NOT_READY')
  } else if (!await provider.db.schema.hasTable(table)) throw new Error('DB_SCHEMA_NOT_READY')
  return provider.service(table)
}
