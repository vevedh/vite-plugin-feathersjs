import { openNamedDatabaseProviders } from '../api/runtime/database-providers.generated.mjs'
import { databaseDeclarations } from '../api/config/database-connections.generated.mjs'
import { prepareNotesStorage } from '../api/runtime/storage.mjs'
import { readFile, lstat } from 'node:fs/promises'

if (process.env.NODE_ENV !== 'production' || process.env.P5_PERSISTENCE_MODE !== 'notes-lab' || databaseDeclarations.length !== 1) {
  console.error('P5_DB_INIT=REFUSED'); process.exitCode = 2
} else {
  let providers
  try {
    const declaration = databaseDeclarations[0]
    const file = process.env.P5_DATABASE_PASSWORD_FILE
    if (file !== '/run/secrets/p5_database_password') throw new Error('DB_SECRET_MISSING')
    const stat = await lstat(file)
    if (!stat.isFile() || stat.size < 16 || stat.size > 256) throw new Error('DB_SECRET_INVALID')
    const password = (await readFile(file, 'utf8')).replace(/\r?\n$/, '')
    if (password.length < 16 || password.length > 256 || /[\u0000-\u001f\u007f]/.test(password)) throw new Error('DB_SECRET_INVALID')
    providers = await openNamedDatabaseProviders({ ...process.env, [`${declaration.envPrefix}_PASSWORD`]: password })
    await prepareNotesStorage(providers.get(declaration.alias))
    console.log('P5_DB_INIT=PASS | NOTES_SCHEMA=READY | NO_SEED=YES')
  } catch {
    console.error('P5_DB_INIT=FAIL | NO_SCHEMA_DOWNGRADE')
    process.exitCode = 2
  } finally {
    try { await providers?.close() } catch { process.exitCode = 2 }
  }
}
