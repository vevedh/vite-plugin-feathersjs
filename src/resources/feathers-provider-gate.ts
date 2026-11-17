/**
 * P2-R2: opt-in Feathers service health gate for an already-connected provider.
 * This does NOT implement or certify any SQL/Mongo/Redis driver. The host owns
 * actual adapter setup, migrations, and ProviderRegistry.closeAll() during
 * shutdown after stopping Feathers.
 */
import { Unavailable } from '@feathersjs/errors'
import { ProviderRegistry } from './provider-registry.js'

const VALID_NAME = /^[a-z][a-z0-9_-]{0,63}$/

/** A server-configured provider name only, never a user-provided value. */
export function createFeathersProviderHealthHook(
  registry: ProviderRegistry,
  configuredName: string,
): () => Promise<void> {
  if (!(registry instanceof ProviderRegistry) || !VALID_NAME.test(configuredName)) {
    throw new TypeError('Invalid provider health gate configuration')
  }
  return async () => {
    try {
      await registry.health(configuredName)
    } catch {
      // Fail closed; no driver raw message, DSN, credential or hostname.
      throw new Unavailable('Service unavailable')
    }
  }
}
