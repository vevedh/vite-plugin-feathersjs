import { readFile } from 'node:fs/promises'
import { enableUniversalLab } from './universal/lab.mjs'
import { enableJwtSessionLab } from './auth-lab.mjs'

const adapters = Object.freeze({
  postgresql: { image: 'postgres:16-alpine', port: 5432, volume: '/var/lib/postgresql/data',
    environment: `      POSTGRES_USER: featherslab\n      POSTGRES_DB: feathers_lab\n      POSTGRES_PASSWORD_FILE: /run/secrets/p5_database_password\n`,
    health: `      test: ["CMD-SHELL", "pg_isready -U featherslab -d feathers_lab"]\n` },
  mariadb: { image: 'mariadb:11.4', port: 3306, volume: '/var/lib/mysql',
    environment: `      MARIADB_USER: featherslab\n      MARIADB_DATABASE: feathers_lab\n      MARIADB_PASSWORD_FILE: /run/secrets/p5_database_password\n      MARIADB_RANDOM_ROOT_PASSWORD: "1"\n`,
    health: `      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]\n` },
  mongodb: { image: 'mongo:7', port: 27017, volume: '/data/db',
    environment: `      MONGO_INITDB_ROOT_USERNAME: featherslab\n      MONGO_INITDB_ROOT_PASSWORD_FILE: /run/secrets/p5_database_password\n`,
    health: `      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand({ping:1}).ok"]\n` },
})
function change(files, path, before, after) {
  const old = files.get(path)
  if (typeof old !== 'string' || old.split(before).length !== 2) {
    throw new Error(`Persistence template drift: ${path}`)
  }
  files.set(path, old.replace(before, after))
}
const source = async name => readFile(new URL(`./persistence-lab/${name}`, import.meta.url), 'utf8')

/** Opt-in, single-provider, unauthenticated *local laboratory* only.
 * No implicit weakening of the existing auth/DB capability guard.
 */
export async function enablePersistentLab(files, options) {
  if (options.persistence !== 'lab' || options.compose !== 'prod' || options.render !== 'spa' || !['none','jwt'].includes(options.auth) || options.databases.length !== 1) {
    throw new Error('Persistence lab requires SPA --compose prod --auth none and exactly one DB')
  }
  const declaration = options.databases[0]
  if (declaration.adapter === 'universal') return enableUniversalLab(files, options, enablePersistentLab)
  const settings = adapters[declaration.adapter]
  if (!settings) throw new Error('Persistence lab supports postgresql|mariadb|mongodb only')
  const envPrefix = `P5_DB_${declaration.alias.replaceAll('-', '_').toUpperCase()}`
  const env = `      P5_PERSISTENCE_MODE: notes-lab\n      P5_DATABASE_PASSWORD_FILE: /run/secrets/p5_database_password\n      ${envPrefix}_HOST: db\n      ${envPrefix}_PORT: "${settings.port}"\n      ${envPrefix}_USER: featherslab\n      ${envPrefix}_NAME: feathers_lab\n`
  const deps = '    depends_on:\n      migrate:\n        condition: service_completed_successfully\n    secrets:\n      - p5_database_password\n'
  change(files, 'compose.prod.yaml', '      FEATHERS_API_PORT: "3030"\n', `      FEATHERS_API_PORT: "3030"\n${env}`)
  change(files, 'compose.prod.yaml', '    expose:\n      - "3030"\n', `    expose:\n      - "3030"\n${deps}`)
  const job = `  migrate:\n    build:\n      context: .\n      dockerfile: infra/compose/Dockerfile.api\n    command: ["node", "scripts/prepare-notes.mjs"]\n    environment:\n      NODE_ENV: production\n${env}    depends_on:\n      db:\n        condition: service_healthy\n    secrets:\n      - p5_database_password\n    networks:\n      - backend\n    security_opt:\n      - no-new-privileges:true\n    read_only: true\n    tmpfs:\n      - /tmp\n  db:\n    image: ${settings.image}\n    environment:\n${settings.environment}    secrets:\n      - p5_database_password\n    networks:\n      - backend\n    volumes:\n      - persistence_data:${settings.volume}\n    healthcheck:\n${settings.health}      interval: 10s\n      timeout: 5s\n      retries: 12\n      start_period: 25s\n`
  change(files, 'compose.prod.yaml', '  web:\n    build:\n', `${job}  web:\n    build:\n`)
  const prod = files.get('compose.prod.yaml')
  if (!prod.endsWith('    internal: true\n')) throw new Error('Compose network declaration changed')
  files.set('compose.prod.yaml', `${prod}volumes:\n  persistence_data:\nsecrets:\n  p5_database_password:\n    file: ./secrets/db_password\n`)
  change(files, 'infra/compose/Dockerfile.api', 'COPY api ./api\n', 'COPY api ./api\nCOPY scripts/prepare-notes.mjs ./scripts/prepare-notes.mjs\n')
  change(files, '.dockerignore', 'docs-private\n', 'docs-private\nsecrets\n')
  const ignores = files.get('.gitignore')
  if (!ignores || !ignores.includes('docs-private/')) throw new Error('Missing safe .gitignore')
  files.set('.gitignore', `${ignores.trimEnd()}\nsecrets/\n`)
  files.set('api/config/database-connections.generated.mjs', `export const databaseDeclarations = Object.freeze(${JSON.stringify([{ alias: declaration.alias, adapter: declaration.adapter, envPrefix }])})\n`)
  files.set('api/runtime/database-providers.generated.mjs', await readFile(new URL('./secure-runtime/providers.mjs', import.meta.url), 'utf8'))
  for (const [name,path] of [
    ['notes-service.mjs', 'api/runtime/notes-service.mjs'],
    ['storage.mjs', 'api/runtime/storage.mjs'],
    ['open.mjs', 'api/runtime/open.mjs'],
    ['prepare.mjs', 'scripts/prepare-notes.mjs'],
    ['create-secret.mjs', 'scripts/create-lab-secret.mjs'],
  ]) files.set(path, await source(name))

  const cap = `// Opt-in laboratory contract: never start a database-backed demo on Vite dev or in a public host.\n` +
    `export function assertCapabilities() {\n` +
    `  if (process.env.NODE_ENV !== 'production' || process.env.P5_PERSISTENCE_MODE !== 'notes-lab') {\n` +
    `    throw new Error('External persistence requires the private Docker Production lab profile')\n` +
    `  }\n` +
    `}\n`
  if (!files.get('api/config/capabilities.mjs')?.includes('Database adapters not provisioned:')) {
    throw new Error('Existing capability guard drift')
  }
  files.set('api/config/capabilities.mjs', cap)
  change(files, 'vite.config.ts', 'assertCapabilities()\nexport default defineConfig({',
    "if (process.env.NODE_ENV !== 'production') assertCapabilities()\nexport default defineConfig({")
  change(files, 'api/services/notes/notes.service.mjs', "app.use('notes', new NotesService(),", "const persistenceService = app.get('p5PersistentNotes')\n  if (!persistenceService) throw new Error('DB_NOT_BOUND')\n  app.use('notes', persistenceService,")

  let server = files.get('api/server.mjs')
  if (typeof server !== 'string' || !server.includes('assertCapabilities()') || !server.includes('const runtime = await createFeathersRuntime(')) {
    throw new Error('Production server template drift')
  }
  // Invariant: provider opens and schema is checked before registering services or opening HTTP.
  server = `import { openNotesDatabase } from './runtime/open.mjs'\nimport { PersistentNotesService } from './runtime/notes-service.mjs'\n${server}`
  const start = 'const runtime = await createFeathersRuntime(modules.map(String), file => import(file), {'
  if (server.split(start).length !== 2) throw new Error('Runtime bootstrap changed')
  server = server.replace(start,
    `const persistence = await openNotesDatabase()\nlet persistenceReady = false\ntry {\n${start}\n  configure: app => app.set('p5PersistentNotes', new PersistentNotesService(persistence.adapter)),`)
  const closeOld = '  await runtime.close()'
  if (server.split(closeOld).length !== 2) throw new Error('Runtime close changed')
  server = server.replace(closeOld, `${closeOld}\n  await persistence.close()`)
  server += `\npersistenceReady = true\n} finally {\n  if (!persistenceReady) await persistence.close()\n}\n`
  files.set('api/server.mjs', server)
  const readme = [
    '# Persistance Feathers — laboratoire Docker Production',
    '',
    '**Profil sans authentification : utilisation locale uniquement.** Nginx est exposé sur 127.0.0.1.',
    `Base sélectionnée : ${declaration.adapter} (alias ${declaration.alias}).`,
    '',
    '## Premier démarrage',
    '',
    'Dans le dossier du projet généré :',
    '```powershell',
    'node scripts/create-lab-secret.mjs',
    'corepack pnpm install --lockfile-only',
    'docker compose -f compose.prod.yaml up --build -d',
    '```',
    '',
    'Ouvrir http://127.0.0.1:8080, ajouter une note puis redémarrer seulement l’API :',
    '```powershell',
    'docker compose -f compose.prod.yaml restart api',
    'docker compose -f compose.prod.yaml ps',
    '```',
    '',
    'Les notes sont stockées dans le volume `persistence_data`. `docker compose down` le conserve.',
    '**Ne jamais lancer `down -v` pour ce test : cela supprime le volume !**',
    'Le job `migrate` crée la structure au besoin, sans supprimer de données.',
    'Le mot de passe est fourni par un secret Docker `secrets/db_password`, exclu de Git et des images.',
    '',
    '## Limites et sécurité',
    '',
    '- Démonstration sans JWT/RBAC : ne pas exposer au réseau public.',
    '- Une seule connexion, un service notes et Compose Production uniquement.',
    '- Développement Vite avec DB externe bloqué ; aucun repli vers la mémoire.',
    '- Le service add reste volontairement bloqué pour les DB externes.',
    '- Socket.IO annonce des événements, pas un journal persistant.',
    '- Les images Docker de DB doivent être figées à un digest et revues avant production réelle.',
    '',
  ].join('\n')
  files.set('PERSISTENCE.md', readme)
  const manifest = JSON.parse(files.get('package.json'))
  // Pin operational DB drivers for reproducible lockfiles; do not modify other profiles.
  if (declaration.adapter === 'postgresql') { manifest.dependencies.knex = '3.3.0'; manifest.dependencies.pg = '8.23.1' }
  if (declaration.adapter === 'mariadb') { manifest.dependencies.knex = '3.3.0'; manifest.dependencies.mysql2 = '3.24.6' }
  if (declaration.adapter === 'mongodb') manifest.dependencies.mongodb = '6.19.0'
  manifest.scripts['db:secret:lab'] = 'node scripts/create-lab-secret.mjs'
  files.set('package.json', JSON.stringify(manifest, null, 2) + '\n')
  if (options.auth === 'jwt') await enableJwtSessionLab(files, options)
}
