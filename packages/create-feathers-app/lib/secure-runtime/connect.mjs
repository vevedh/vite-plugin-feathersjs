import { openNamedDatabaseProviders } from '../runtime/database-providers.generated.mjs'
import { storageNames } from '../runtime/storage.mjs'
import { registerSecuredPersistence } from './register.mjs'

/** Attach real persistence/auth to an unstarted Feathers app; caller owns listener and shutdown.
 * No schema creation, account seeding or socket broadcast occurs during startup.
 */
export async function connectSecuredPersistence(app, config) {
  if (!config || Object.keys(config).sort().join(',') !== 'alias,audience,issuer,secret') throw Error('INVALID_SECURITY_CONFIG')
  let providers
  try {
    providers = await openNamedDatabaseProviders()
    const provider = providers.get(config.alias)
    // Readiness checks the actual schema/collections before registration.
    if (provider.adapter === 'mongodb') {
      for (const name of Object.values(storageNames)) {
        if (!await provider.db.listCollections({ name }).hasNext()) throw Error('STORAGE_NOT_PREPARED')
      }
    } else {
      for (const name of Object.values(storageNames)) if (!await provider.db.schema.hasTable(name)) throw Error('STORAGE_NOT_PREPARED')
    }
    registerSecuredPersistence(app, providers, { ...config, ...storageNames })
    return Object.freeze({ close: () => providers.close() })
  } catch (error) {
    try { await providers?.close() } catch {}
    throw error
  }
}
