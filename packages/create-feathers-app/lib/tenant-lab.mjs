import { readFile } from 'node:fs/promises'
const content = name => readFile(new URL(`./tenant-lab/${name}`,import.meta.url),'utf8')
function once(files,path,before,after){
  const source=files.get(path)
  if(typeof source!=='string'||source.split(before).length!==2)throw Error('TENANT_TEMPLATE_DRIFT: '+path)
  files.set(path,source.replace(before,after))
}
/** Opt-in only. Historical RC10/R3 profiles must remain byte-identical. */
export async function enableTenantIsolationLab(files,options){
  if(options.tenantMode!=='isolated-lab'||options.auth!=='jwt'||options.persistence!=='lab'
      ||options.compose!=='prod'||options.render!=='spa'||options.databases.length!==1
      ||!['postgresql','mariadb','mongodb','universal'].includes(options.databases[0].adapter))throw Error('TENANT_PROFILE_REFUSED')
  for(const [name,target] of [
    ['scope.mjs','api/runtime/tenant-scope.mjs'],
    ['notes.mjs','api/runtime/tenant-notes.mjs'],
    ['schema.mjs','api/runtime/tenant-schema.mjs'],
    ['store.mjs','api/runtime/auth-store.mjs'],
  ])files.set(target,await content(name))
  once(files,'api/runtime/auth-setup.mjs',
    "import { createNotesRbacHook } from './auth-rbac.mjs'",
    "import { createNotesRbacHook } from './auth-rbac.mjs'\nimport { createTenantScopeHook } from './tenant-scope.mjs'".replace('\\n','\n'))
  once(files,'api/runtime/auth-setup.mjs',
    "createNotesRbacHook(app.get('p5AuthStore'))]",
    "createNotesRbacHook(app.get('p5AuthStore')),createTenantScopeHook(app.get('p5AuthStore'))]")
  once(files,'api/server.mjs',
    "import { configureJwtLab, protectNotesWithJwt } from './runtime/auth-setup.mjs'",
    "import { configureJwtLab, protectNotesWithJwt } from './runtime/auth-setup.mjs'\nimport { TenantNotesService } from './runtime/tenant-notes.mjs'\nimport { checkTenantSchema } from './runtime/tenant-schema.mjs'".replaceAll('\\n','\n'))
  once(files,'api/server.mjs',
    "const jwtSecret = await readAuthSecret('jwt')",
    "await checkTenantSchema(persistence.provider)\nconst jwtSecret = await readAuthSecret('jwt')".replace('\\n','\n'))
  once(files,'api/server.mjs',
    "app.set('p5PersistentNotes',new PersistentNotesService(persistence.adapter))",
    "app.set('p5PersistentNotes',new TenantNotesService(persistence.provider))")
  // The Feathers service must expose update only when the tenant repository
  // actually implements it; old RC10 profiles retain their method contract.
  once(files,'api/services/notes/notes.service.mjs',
    "['find', 'get', 'create', 'patch', 'remove']",
    "['find', 'get', 'create', 'update', 'patch', 'remove']")
  once(files,'scripts/prepare-notes.mjs',
    "import { prepareAuthSchema } from '../api/runtime/auth-schema.mjs'",
    "import { prepareAuthSchema } from '../api/runtime/auth-schema.mjs'\nimport { prepareTenantSchema } from '../api/runtime/tenant-schema.mjs'\nimport { randomUUID } from 'node:crypto'".replaceAll('\\n','\n'))
  once(files,'scripts/prepare-notes.mjs',
    'await prepareAuthSchema(provider)',
    'await prepareAuthSchema(provider)\n    await prepareTenantSchema(provider)'.replace('\\n','\n'))
  once(files,'scripts/prepare-notes.mjs',
    "await createAuthStore(provider).seedAdmin('lab-admin@example.invalid',await hash(adminPassword,12))",
    "await createAuthStore(provider).seedAdmin('lab-admin@example.invalid',await hash(adminPassword,12),randomUUID())")
  const composeFiles=['compose.prod.yaml',...['mariadb','mongodb'].map(d=>`compose.${d}.yaml`).filter(f=>files.has(f))]
  for(const path of composeFiles){
    const source=files.get(path)
    if(!source.includes('      P5_AUTH_MODE: jwt-lab\n'.replace('\\n','\n')))throw Error('TENANT_COMPOSE_DRIFT: '+path)
    files.set(path,source.replaceAll('      P5_AUTH_MODE: jwt-lab\n'.replace('\\n','\n'),
      '      P5_AUTH_MODE: jwt-lab\n      P5_TENANT_MODE: isolated-lab\n'.replaceAll('\\n','\n')))
  }
  files.set('api/contracts/tenancy.ts',`export type TenantId = string & {readonly __tenantBrand: unique symbol}
export type OwnerId = string & {readonly __ownerBrand: unique symbol}
export type TenantRole = 'viewer' | 'editor' | 'admin'
export interface TenantScope { readonly tenantId: TenantId; readonly ownerId: OwnerId; readonly role: TenantRole }
export interface TenantNote { readonly id:number; readonly title:string }
`)
  files.set('TENANCY.md',`# Isolation des organisations — laboratoire local

Activer explicitement le mode \`--tenant-mode isolated-lab\` avec JWT et une base persistante.
Le serveur recharge le rôle, l'organisation et le statut depuis la base après validation du JWT.
Chaque note possède un \`tenant_id\` et un \`owner_id\` immuables, absents du DTO client.

- Viewer : lecture des notes de son organisation uniquement.
- Editor : lecture des notes de son organisation ; création et modification de ses propres notes.
- Admin : lecture, modification et suppression des notes de son organisation exclusivement.
- Ni super-admin global ni sélection d'organisation par query, JWT, Socket.IO ou payload client.
- Les requêtes \`$or\`, \`$in\`, \`tenantId\`, \`ownerId\` et autres filtres clients sont refusées.
- SQL : contraintes de tenant sur le SELECT, UPDATE et DELETE ; MongoDB : mêmes contraintes dans les filtres atomiques.
- Migrations additives : refuse d'attribuer automatiquement à un tenant les notes ou utilisateurs historiques sans tenant.
- Les événements Feathers restent désactivés, aucun canal de diffusion multi-tenant n'est activé.

Le laboratoire n'est pas prêt pour Internet, la migration des données historiques et les E2E Docker multi-tenant restent à certifier.
`)
  const original=files.get('RBAC.md')
  if(typeof original!=='string')throw Error('TENANT_RBAC_DOC_DRIFT')
  files.set('RBAC.md',original+'\n## Isolation des données\n\nLire [TENANCY.md](TENANCY.md) pour les contrôles owner/tenant.\n'.replaceAll('\\n','\n'))
}
