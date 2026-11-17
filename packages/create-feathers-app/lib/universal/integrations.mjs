/** Optional integrations from the architecture R4 are contracts, not mock services.
 * Fail closed until an authenticated, tested driver is bound to Feathers.
 */
export async function enableIntegrationBlueprints(files, options) {
  if (options.persistence === 'lab') throw new Error('LAB_INTEGRATIONS_NOT_CERTIFIED')
  if (options.cache === 'none' && options.storage === 'none') return
  const config = Object.freeze({
    cache: options.cache,
    storage: options.storage,
    status: 'configuration-only',
    secrets: 'server-only',
  })
  files.set('api/config/integrations.generated.json', JSON.stringify(config, null, 2) + '\n')
  files.set('INTEGRATIONS.md', `# Intégrations optionnelles — contrat non opérationnel\n\nCache demandé : ${options.cache}. Stockage demandé : ${options.storage}.\n\nCes options sont présentes dans le CLI pour conserver la configuration souhaitée ; aucun client Valkey ou S3 n'est créé et aucun identifiant n'est écrit dans l'application. Les services Feathers sont bloqués au démarrage jusqu'à l'installation d'un provider authentifié et testé.\n\nNe pas présenter ce profil comme déployable.\n`)
  // Existing template guard already rejects non-memory DBs and non-none auth.
  // For an otherwise open memory demo, explicitly reject these unprovisioned providers.
  const before = files.get('api/config/capabilities.mjs')
  if (typeof before !== 'string' || !before.includes('export function assertCapabilities(){')) {
    throw new Error('INTEGRATIONS_GUARD_DRIFT')
  }
  files.set('api/config/capabilities.mjs', before.replace('export function assertCapabilities(){',
    `export function assertCapabilities(){\n  throw new Error('OPTIONAL_INTEGRATIONS_NOT_PROVISIONED')`))
}
