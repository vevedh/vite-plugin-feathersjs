/**
 * Universal CRUD laboratory: a single named database port with a server-only
 * allowlisted provider selection. This does not route queries between DBs.
 * Each Compose file represents one independent deployment and volume.
 */
const kinds = Object.freeze(['postgresql', 'mariadb', 'mongodb'])
const capabilityMap = Object.freeze({
  postgresql: Object.freeze({ crud: true, durable: true, sql: true, transactions: true, changeStreams: false }),
  mariadb: Object.freeze({ crud: true, durable: true, sql: true, transactions: true, changeStreams: false }),
  mongodb: Object.freeze({ crud: true, durable: true, sql: false, transactions: false, changeStreams: false }),
})
function once(source, needle, replacement, reason) {
  if (typeof source !== 'string' || source.split(needle).length !== 2) throw new Error('Universal template drift: ' + reason)
  return source.replace(needle, replacement)
}
function profileCompose(value, adapter, projectName) {
  let compose = once(value, `name: ${projectName}-prod\n`, `name: ${projectName}-universal-${adapter}\n`, 'name')
  const line = '      P5_PERSISTENCE_MODE: notes-lab\n'
  if (compose.split(line).length !== 3) throw new Error('Universal Compose must set env on API and migrate')
  compose = compose.replaceAll(line, line + `      P5_DATABASE_ADAPTER: ${adapter}\n`)
  return compose
}

export async function enableUniversalLab(files, options, enableSingle) {
  if (options.databaseMode !== 'universal' || options.databases.length !== 1 || options.databases[0].adapter !== 'universal') {
    throw new Error('UNIVERSAL_MODE_REQUIRED')
  }
  const original = new Map(files)
  const results = new Map()
  for (const adapter of kinds) {
    const staged = new Map(original)
    await enableSingle(staged, {
      ...options,
      databaseMode: 'single',
      databases: [{ alias: options.databases[0].alias, adapter }],
    })
    results.set(adapter, staged)
  }
  // Keep every byte of the certified RC8 single-provider scaffold except the
  // narrowly specified runtime selector and new Compose choices.
  const base = results.get('postgresql')
  for (const [path, value] of base) files.set(path, value)
  for (const adapter of kinds) {
    const destination = adapter === 'postgresql' ? 'compose.prod.yaml' : `compose.${adapter}.yaml`
    files.set(destination, profileCompose(results.get(adapter).get('compose.prod.yaml'), adapter, options.name))
  }

  const alias = options.databases[0].alias
  const envPrefix = `P5_DB_${alias.replaceAll('-', '_').toUpperCase()}`
  files.set('api/config/database-connections.generated.mjs', `// Server-only selection from a closed list; no user-provided DSN or tenant routing.
const allowed = Object.freeze(['postgresql', 'mariadb', 'mongodb'])
const selected = process.env.P5_DATABASE_ADAPTER
if (!allowed.includes(selected)) throw new Error('UNIVERSAL_PROVIDER_NOT_ALLOWED')
export const databaseDeclarations = Object.freeze([Object.freeze({alias:${JSON.stringify(alias)},adapter:selected,envPrefix:${JSON.stringify(envPrefix)}})])
export const databaseCapabilities = Object.freeze(${JSON.stringify(capabilityMap)})
export const activeDatabaseCapabilities = databaseCapabilities[selected]
`)
  // The single-provider package only includes pg/Knex: install all supported
  // drivers, because the Node image must be identical across provider choices.
  const manifest = JSON.parse(files.get('package.json'))
  Object.assign(manifest.dependencies, {
    '@feathersjs/knex': '5.0.50',
    '@feathersjs/mongodb': '5.0.51',
    knex: '3.3.0',
    pg: '8.23.1',
    mysql2: '3.24.6',
    mongodb: '6.19.0',
  })
  files.set('package.json', JSON.stringify(manifest, null, 2) + '\n')

  // Domain-level port: service code has no provider-specific import. Runtime
  // compatibility and optional capabilities remain explicit in a typed file.
  files.set('api/contracts/universal-database.ts', `export type DatabaseKind = 'postgresql' | 'mariadb' | 'mongodb'
export type DatabaseCapability = 'crud' | 'durable' | 'sql' | 'transactions' | 'changeStreams'
export interface DatabaseCapabilities {
  readonly crud: boolean
  readonly durable: boolean
  readonly sql: boolean
  readonly transactions: boolean
  readonly changeStreams: boolean
}
export interface UniversalCrudRepository<TRecord extends { readonly id: number }, TCreate, TPatch> {
  find(options?: Readonly<{ limit?: number }>): Promise<readonly TRecord[]>
  get(id: number): Promise<TRecord>
  create(data: Readonly<TCreate>): Promise<TRecord>
  patch(id: number, data: Readonly<TPatch>): Promise<TRecord>
  remove(id: number): Promise<TRecord>
}
export function requireDatabaseCapability(
  capabilities: DatabaseCapabilities,
  capability: DatabaseCapability,
): void {
  if (!capabilities[capability]) throw new Error('UNSUPPORTED_DATABASE_CAPABILITY')
}
`)
  files.set('PERSISTENCE.md', `# Adaptateur universel — laboratoire Docker Production

Le service Feathers \`notes\` utilise **un port CRUD unique** quel que soit le moteur. Le provider est sélectionné au démarrage **sur le serveur**, exclusivement à partir des trois fichiers Compose générés. Il n'est jamais choisi par une requête HTTP, Socket.IO ou un champ client.

## Démarrage

\`\`\`powershell
node scripts/create-lab-secret.mjs
corepack pnpm install --lockfile-only
docker compose -f compose.prod.yaml up --build -d
\`\`\`

**Provider PostgreSQL :** \`compose.prod.yaml\` (défaut).
**Provider MariaDB :** \`compose.mariadb.yaml\`.
**Provider MongoDB :** \`compose.mongodb.yaml\`.

Pour les autres providers, utiliser exactement la même commande en remplaçant le fichier \`-f\`. Le nom Compose et le volume sont distincts par provider : aucune bascule automatique ni migration implicite des données.

## Sécurité et limites

- Les bases, l'API et les jobs de préparation sont sur un réseau Docker interne ; seul Nginx est publié sur \`127.0.0.1\`.
- Le secret \`secrets/db_password\` reste hors Git, hors image et hors de la SPA. Il n'est pas régénéré si déjà présent.
- Chaque moteur conserve son volume après \`docker compose down\`. Ne pas utiliser \`down -v\`.
- Une seule base **active par déploiement** : le mode multi-provider et les transactions distribuées ne sont pas implémentés.
- Seules les opérations CRUD de démonstration sont certifiables ici ; les transactions et recherches avancées sont optionnelles et conditionnées aux capacités.
- ${options.auth === 'jwt' ? 'JWT et sessions durables du laboratoire activés ; RBAC, TLS public, sauvegarde/restauration et transfert inter-bases restent à certifier.' : 'JWT/RBAC, TLS public, sauvegarde/restauration et changement de moteur avec transfert de données ne sont pas intégrés.'} Ne jamais exposer ce laboratoire sur Internet.
- Le compte MongoDB de démonstration possède des privilèges élevés selon le profil historique RC8. Créer un compte applicatif à privilèges minimaux avant une exploitation réelle.
`)
  const readme = files.get('README.md')
  files.set('README.md', once(readme, 'Les données de démonstration sont en mémoire ; sans authentification les services ne doivent pas être exposés publiquement.',
    (options.auth === 'jwt' ? 'Le profil universel persistant et ses sessions JWT sont décrits dans PERSISTENCE.md et AUTHENTICATION.md. Laboratoire privé uniquement.' : 'Le profil universel persistant est détaillé dans PERSISTENCE.md. Laboratoire local sans JWT/RBAC : aucune exposition publique.'), 'application README'))
  files.set('api/config/database-capabilities.generated.json', JSON.stringify({
    mode: 'universal', primary: alias, selection: 'server-env-only',
    allowedProviders: kinds, capabilities: capabilityMap,
    multiDatabaseTransactions: false,
  }, null, 2) + '\n')
}
