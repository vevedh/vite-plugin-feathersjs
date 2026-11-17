import { openNamedDatabaseProviders } from '../api/runtime/database-providers.generated.mjs'
import { prepareIdentityStorage } from '../api/runtime/storage.mjs'
const [mode, flag, alias, ...extra] = process.argv.slice(2)
if (mode !== '--apply' || flag !== '--alias' || !/^[a-z][a-z0-9-]{0,31}$/.test(alias ?? '') || extra.length) {
  console.error('STORAGE=REFUSED | EXPECTED=--apply --alias NAME'); process.exitCode = 2
} else {
  let providers
  try {
    providers = await openNamedDatabaseProviders()
    await prepareIdentityStorage(providers.get(alias))
    console.log('STORAGE=PREPARED | ACCOUNTS_CREATED=0 | PUBLIC_RUNTIME=BLOCKED')
  } catch { console.error('STORAGE=FAILED | PUBLIC_RUNTIME=BLOCKED'); process.exitCode = 2 }
  finally { try { await providers?.close() } catch { console.error('STORAGE=CLEANUP_FAILED'); process.exitCode = 2 } }
}
