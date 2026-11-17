import { randomUUID } from 'node:crypto'

// Server-only durable identity and session repository. SQL queries are parameterized
// by Knex; MongoDB receives closed, validated field sets. No transport-specific data.
const users = 'app_auth_users'
const sessions = 'app_auth_sessions'
const isUUID = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)
const now = () => Date.now()
export function createAuthStore(provider) {
  if (!provider || !['postgresql','mariadb','mongodb'].includes(provider.adapter)) throw Error('AUTH_PROVIDER_REQUIRED')
  const mongo = provider.adapter === 'mongodb'
  const sql = provider.db
  const userColl = mongo ? sql.collection(users) : null
  const sessionColl = mongo ? sql.collection(sessions) : null
  const convert = row => row ? Object.freeze({ id: row.id, email: row.email, password: row.password, status: row.status, role: row.role, sessionVersion: row.session_version ?? row.sessionVersion }) : null
  const getById = async id => isUUID(id) ? convert(mongo ? await userColl.findOne({ id }) : await sql(users).where({ id }).first()) : null
  const getByEmail = async email => typeof email === 'string' && email.length <= 190
    ? convert(mongo ? await userColl.findOne({ email }) : await sql(users).where({ email }).first()) : null
  async function seedAdmin(email, hashed) {
    if (typeof email !== 'string' || !/^[a-z0-9.-]{1,80}@[a-z0-9.-]{1,70}$/.test(email) || typeof hashed !== 'string' || !/^\$2[aby]\$/.test(hashed)) throw Error('AUTH_BOOTSTRAP_INVALID')
    if (await getByEmail(email)) return false
    const record = { id: randomUUID(), email, password: hashed, status: 'active', role: 'admin' }
    if (mongo) await userColl.insertOne({ ...record, sessionVersion: 1 })
    else await sql(users).insert({ ...record, session_version: 1 })
    return true
  }
  async function createSession(userId, version, ttlMs = 900000) {
    if (!isUUID(userId) || !Number.isSafeInteger(version) || version < 1 || ttlMs !== 900000) throw Error('AUTH_SESSION_INVALID')
    const value = { id: randomUUID(), user_id: userId, session_version: version, expires_at: now() + ttlMs, revoked: false }
    if (mongo) await sessionColl.insertOne(value)
    else await sql(sessions).insert(value)
    return value.id
  }
  async function validSession(id, userId, version) {
    if (!isUUID(id) || !isUUID(userId) || !Number.isSafeInteger(version)) return false
    const row = mongo
      ? await sessionColl.findOne({ id, user_id: userId, session_version: version, revoked: false, expires_at: { $gt: now() } })
      : await sql(sessions).where({ id, user_id: userId, session_version: version, revoked: false }).where('expires_at', '>', now()).first()
    return Boolean(row)
  }
  async function consumeSession(id, userId, version) {
    if (!isUUID(id) || !isUUID(userId) || !Number.isSafeInteger(version)) return false
    const filter = { id, user_id: userId, session_version: version, revoked: false }
    if (mongo) {
      const result = await sessionColl.updateOne({ ...filter, expires_at: { $gt: now() } }, { $set: { revoked: true } })
      return result.modifiedCount === 1
    }
    const changed = await sql(sessions).where(filter).where('expires_at', '>', now()).update({ revoked: true })
    return changed === 1
  }
  return Object.freeze({ getById, getByEmail, seedAdmin, createSession, validSession, consumeSession })
}
