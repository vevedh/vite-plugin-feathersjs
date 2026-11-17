const users = 'app_auth_users'
const sessions = 'app_auth_sessions'
// Additive only. Never remove tables, columns or MongoDB collections.
export async function prepareAuthSchema(provider) {
  if (!provider || !['postgresql','mariadb','mongodb'].includes(provider.adapter)) throw Error('AUTH_PROVIDER_REQUIRED')
  const db = provider.db
  if (provider.adapter === 'mongodb') {
    for (const name of [users,sessions]) {
      try { await db.createCollection(name) } catch (error) { if (error?.code !== 48) throw error }
      await db.collection(name).createIndex({ id: 1 }, { unique: true })
    }
    await db.collection(users).createIndex({ email: 1 }, { unique: true })
    await db.collection(sessions).createIndex({ user_id: 1, expires_at: 1 })
    return
  }
  if (!await db.schema.hasTable(users)) await db.schema.createTable(users, table => {
    table.string('id', 36).primary()
    table.string('email', 190).notNullable().unique()
    table.string('password', 255).notNullable()
    table.string('status', 16).notNullable()
    table.string('role', 16).notNullable()
    table.integer('session_version').notNullable()
  })
  if (!await db.schema.hasTable(sessions)) await db.schema.createTable(sessions, table => {
    table.string('id', 36).primary()
    table.string('user_id', 36).notNullable().index()
    table.integer('session_version').notNullable()
    table.bigInteger('expires_at').notNullable()
    table.boolean('revoked').notNullable().defaultTo(false)
  })
  for (const [name, columns] of [[users,['id','email','password','status','role','session_version']], [sessions,['id','user_id','session_version','expires_at','revoked']]]) {
    for (const field of columns) if (!await db.schema.hasColumn(name,field)) throw Error('AUTH_SCHEMA_MIGRATION_REQUIRED')
  }
}
export async function checkAuthSchema(provider) {
  if (!provider || !['postgresql','mariadb','mongodb'].includes(provider.adapter)) throw Error('AUTH_PROVIDER_REQUIRED')
  if (provider.adapter === 'mongodb') {
    for (const name of [users,sessions]) if (!await provider.db.listCollections({ name }).hasNext()) throw Error('AUTH_SCHEMA_NOT_READY')
  } else {
    for (const name of [users,sessions]) if (!await provider.db.schema.hasTable(name)) throw Error('AUTH_SCHEMA_NOT_READY')
  }
}
