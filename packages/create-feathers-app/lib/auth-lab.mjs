import { readFile } from 'node:fs/promises'
const content = name => readFile(new URL(`./auth-lab/${name}`, import.meta.url),'utf8')
function replaceOnce(files,path,needle,withText) {
  const value = files.get(path)
  if (typeof value !== 'string' || value.split(needle).length !== 2) throw Error('AUTH_TEMPLATE_DRIFT: '+path)
  files.set(path,value.replace(needle,withText))
}
export async function enableJwtSessionLab(files,options) {
  if (options.persistence !== 'lab' || options.compose !== 'prod' || options.auth !== 'jwt' || options.render !== 'spa' || options.databases.length !== 1 || !['postgresql','mariadb','mongodb'].includes(options.databases[0].adapter)) throw Error('JWT_LAB_PROFILE_REFUSED')
  for (const [name,target] of [
    ['store.mjs','api/runtime/auth-store.mjs'],
    ['schema.mjs','api/runtime/auth-schema.mjs'],
    ['secrets.mjs','api/runtime/auth-secrets.mjs'],
    ['setup.mjs','api/runtime/auth-setup.mjs'],
    ['rbac-policy.mjs','api/runtime/auth-rbac-policy.mjs'],
    ['rbac.mjs','api/runtime/auth-rbac.mjs'],
    ['create-secret.mjs','scripts/create-auth-secrets.mjs'],
  ]) files.set(target,await content(name))
  replaceOnce(files,'api/runtime/open.mjs','return { adapter, close: () => providers.close() }','return { adapter, provider: providers.get(declaration.alias), close: () => providers.close() }')
  // The database migration runs in the one-shot, private Docker job; secrets
  // never enter generated code, images, environment values or browser bundles.
  const prepImports = `import { prepareAuthSchema } from '../api/runtime/auth-schema.mjs'\nimport { createAuthStore } from '../api/runtime/auth-store.mjs'\nimport { readAuthSecret } from '../api/runtime/auth-secrets.mjs'\nimport { hash } from 'bcryptjs'\n`
  replaceOnce(files,'scripts/prepare-notes.mjs',"import { readFile, lstat } from 'node:fs/promises'\n", "import { readFile, lstat } from 'node:fs/promises'\n"+prepImports)
  replaceOnce(files,'scripts/prepare-notes.mjs',"    await prepareNotesStorage(providers.get(declaration.alias))\n    console.log('P5_DB_INIT=PASS | NOTES_SCHEMA=READY | NO_SEED=YES')", `    const provider = providers.get(declaration.alias)
    await prepareNotesStorage(provider)
    if (process.env.P5_AUTH_MODE !== 'jwt-lab') throw Error('AUTH_MODE_REFUSED')
    await prepareAuthSchema(provider)
    const adminPassword = await readAuthSecret('admin')
    await createAuthStore(provider).seedAdmin('lab-admin@example.invalid',await hash(adminPassword,12))
    console.log('P5_AUTH_INIT=PASS | USERS=INTERNAL | SESSIONS=DURABLE')
    console.log('P5_DB_INIT=PASS | NOTES_SCHEMA=READY')`)
  const server = files.get('api/server.mjs')
  if (typeof server !== 'string' || !server.includes("configure: app => app.set('p5PersistentNotes', new PersistentNotesService(persistence.adapter)),")) throw Error('AUTH_BOOTSTRAP_DRIFT')
  files.set('api/server.mjs',`import { configureJwtLab, protectNotesWithJwt } from './runtime/auth-setup.mjs'\nimport { readAuthSecret } from './runtime/auth-secrets.mjs'\n`+server.replace('const runtime = await createFeathersRuntime(modules.map(String), file => import(file), {',`const jwtSecret = await readAuthSecret('jwt')
const runtime = await createFeathersRuntime(modules.map(String), file => import(file), {`).replace("configure: app => app.set('p5PersistentNotes', new PersistentNotesService(persistence.adapter)),",`configure: async app => {
    app.set('p5PersistentNotes',new PersistentNotesService(persistence.adapter))
    await configureJwtLab(app,persistence.provider,jwtSecret)
  },
  afterRegister: app => protectNotesWithJwt(app),`))
  let prod = files.get('compose.prod.yaml')
  if (typeof prod !== 'string' || !prod.includes('  migrate:\n') || !prod.includes('  db:\n') || prod.split('      P5_PERSISTENCE_MODE: notes-lab\n').length !== 3) throw Error('AUTH_COMPOSE_DRIFT')
  prod = prod.replaceAll('      P5_PERSISTENCE_MODE: notes-lab\n','      P5_PERSISTENCE_MODE: notes-lab\n      P5_AUTH_MODE: jwt-lab\n')
  const migratePos = prod.indexOf('\n  migrate:\n') + 1
  const dbPos = prod.indexOf('\n  db:\n', migratePos) + 1
  if (dbPos < 0) throw Error('AUTH_COMPOSE_DRIFT')
  let api = prod.slice(0,migratePos)
  let migrate = prod.slice(migratePos,dbPos)
  const dbRest=prod.slice(dbPos)
  const needle='      - p5_database_password\n'
  if (api.split(needle).length !== 2 || migrate.split(needle).length !== 2) throw Error('AUTH_COMPOSE_SECRET_DRIFT')
  api=api.replace(needle,needle+'      - p5_jwt_secret\n')
  migrate=migrate.replace(needle,needle+'      - p5_admin_password\n')
  api=api.replace('      P5_AUTH_MODE: jwt-lab\n','      P5_AUTH_MODE: jwt-lab\n      P5_JWT_SECRET_FILE: /run/secrets/p5_jwt_secret\n')
  migrate=migrate.replace('      P5_AUTH_MODE: jwt-lab\n','      P5_AUTH_MODE: jwt-lab\n      P5_ADMIN_PASSWORD_FILE: /run/secrets/p5_admin_password\n')
  prod=api+migrate+dbRest
  if (!prod.endsWith('    file: ./secrets/db_password\n')) throw Error('AUTH_COMPOSE_SECRET_DRIFT')
  prod += '  p5_jwt_secret:\n    file: ./secrets/jwt_secret\n  p5_admin_password:\n    file: ./secrets/admin_password\n'
  files.set('compose.prod.yaml',prod)
  // Limit brute-force attempts on the sole local login route.
  const nginx=files.get('infra/compose/nginx.conf')
  if (typeof nginx !== 'string' || !nginx.startsWith('server {\n') || !nginx.includes('  location /api/ {')) throw Error('AUTH_NGINX_DRIFT')
  files.set('infra/compose/nginx.conf', 'limit_req_zone $binary_remote_addr zone=p5_auth:10m rate=6r/m;\n'+nginx.replace('  location /api/ {',`  limit_req_status 429;
  location = /api/authentication {
    limit_req zone=p5_auth burst=6 nodelay;
    proxy_pass http://api:3030/api/authentication;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_read_timeout 30s;
    client_max_body_size 8k;
  }
  location /api/ {`))
  const manifest=JSON.parse(files.get('package.json'))
  manifest.dependencies['@feathersjs/authentication']='5.0.50'
  manifest.dependencies['@feathersjs/authentication-local']='5.0.50'
  manifest.dependencies.bcryptjs='3.0.3'
  manifest.scripts['auth:secrets:lab']='node scripts/create-auth-secrets.mjs'
  files.set('package.json',JSON.stringify(manifest,null,2)+'\n')
  files.set('AUTHENTICATION.md',await content('AUTHENTICATION.md'))
  files.set('RBAC.md',await content('RBAC.md'))
  files.set('api/contracts/rbac.ts', `export type NotesRole = 'viewer' | 'editor' | 'admin'\nexport type NotesMethod = 'find' | 'get' | 'create' | 'update' | 'patch' | 'remove'\nexport type NotesPermissions = Readonly<Record<NotesRole, readonly NotesMethod[]>>\n`)
  const old=files.get('PERSISTENCE.md')
  if (typeof old!=='string')throw Error('AUTH_DOC_DRIFT')
  files.set('PERSISTENCE.md',old+'\n## Identité et sessions\n\nLe profil JWT dispose du guide [AUTHENTICATION.md](AUTHENTICATION.md). Ne pas exposer en dehors du laboratoire loopback.\n')
  files.set('api/contracts/durable-auth.ts',`export type UserRole = 'viewer' | 'editor' | 'admin'
export interface PublicUser { readonly id: string; readonly role: UserRole; readonly status: 'active'; readonly sessionVersion: number }
export type AuthSessionAction = Readonly<{ operation: 'revoke' | 'rotate' }>
export type AuthSessionResult = Readonly<{ revoked: true } | { rotated: true; accessToken: string }>
`)
}
