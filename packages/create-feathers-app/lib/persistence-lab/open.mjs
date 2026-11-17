import { readFile, lstat } from 'node:fs/promises'
import { openNamedDatabaseProviders } from './database-providers.generated.mjs'
import { databaseDeclarations } from '../config/database-connections.generated.mjs'
import { checkNotesStorage } from './storage.mjs'

// Docker secrets are read only at runtime, not copied into images or exposed via VITE_*.
export async function openNotesDatabase() {
  if (process.env.NODE_ENV !== 'production' || process.env.P5_PERSISTENCE_MODE !== 'notes-lab') {
    throw new Error('PERSISTENCE_PROFILE_NOT_ENABLED')
  }
  if (databaseDeclarations.length !== 1) throw new Error('DB_SINGLE_PROVIDER_REQUIRED')
  const declaration = databaseDeclarations[0]
  const secretFile = process.env.P5_DATABASE_PASSWORD_FILE
  if (secretFile !== '/run/secrets/p5_database_password') throw new Error('DB_SECRET_MISSING')
  const stat = await lstat(secretFile)
  if (!stat.isFile() || stat.size < 16 || stat.size > 256) throw new Error('DB_SECRET_INVALID')
  const password = (await readFile(secretFile, 'utf8')).replace(/\r?\n$/, '')
  if (password.length < 16 || password.length > 256 || /[\u0000-\u001f\u007f]/.test(password)) throw new Error('DB_SECRET_INVALID')
  const providers = await openNamedDatabaseProviders({
    ...process.env,
    [`${declaration.envPrefix}_PASSWORD`]: password,
  })
  try {
    const adapter = await checkNotesStorage(providers.get(declaration.alias))
    return { adapter, close: () => providers.close() }
  } catch {
    await providers.close()
    throw new Error('DB_SCHEMA_NOT_READY')
  }
}
