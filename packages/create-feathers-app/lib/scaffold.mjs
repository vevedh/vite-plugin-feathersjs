import { mkdir, lstat, readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { buildProjectPlan } from './planner/plan.mjs'
import { enableCompose } from './compose.mjs'
import { enableSingleServer } from './single-server.mjs'
import { enablePersistentLab } from './persistence-lab.mjs'
import { enableTenantIsolationLab } from './tenant-lab.mjs'
import { enableIntegrationBlueprints } from './universal/integrations.mjs'

const KEYS = new Set(['--name', '--dir', '--ui', '--render', '--adapter', '--transport', '--dry-run', '--json', '--schema', '--auth', '--db', '--pwa', '--dev-api', '--compose', '--persistence', '--database-mode', '--cache', '--storage', '--tenant-mode', '--single-server'])
const CASES = Object.freeze({
  'quasar2:spa': 'quasar-spa',
  'quasar2:ssr': 'quasar-ssr',
  'daisyui:spa': 'daisyui-spa',
  'daisyui:ssr': 'daisyui-ssr',
  'daisyui:ssg': 'daisyui-ssg',
})
const IGNORED = new Set(['node_modules', 'dist', 'coverage', '.env', 'test-results', 'playwright-report', 'docs-private', '.vite', '.quasar', '.git', 'pnpm-lock.yaml'])

async function walk(directory, prefix = '') {
  const output = []
  for (const entry of (await readdir(directory, {withFileTypes: true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
    if (entry.isSymbolicLink()) throw new Error('Template symlink refused')
    if (IGNORED.has(entry.name)) continue
    const key = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) output.push(...await walk(join(directory, entry.name), key))
    else if (entry.isFile()) output.push([key, await readFile(join(directory, entry.name),'utf8')])
  }
  return output
}
async function rejectSymlinks(pathname) {
  let current = pathname
  while (true) {
    if (existsSync(current) && (await lstat(current)).isSymbolicLink()) throw new Error('Symlink in destination path')
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
}
function safeProjectName(value) {
  return typeof value === 'string' && value.length <= 48 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)
}
function envChange(text, options) {
  return text.replace(/^FEATHERS_ADAPTER=.*$/m, `FEATHERS_ADAPTER=${options.adapter}`)
    .replace(/^FEATHERS_SOCKETIO=.*$/m, `FEATHERS_SOCKETIO=${options.transport === 'both' ? '1' : '0'}`)
    .replace(/^VITE_FEATHERS_REALTIME=.*$/m, `VITE_FEATHERS_REALTIME=${options.transport === 'both' ? '1' : '0'}`)
}
function spaManifest(o) {
  const dependencies = {
    '@vevedh/vite-plugin-feathersjs':'0.2.7', '@feathersjs/feathers':'5.0.50', '@feathersjs/errors':'5.0.50',
    '@feathersjs/koa':'5.0.51', '@feathersjs/express':'5.0.51', '@feathersjs/socketio':'5.0.51',
    vue:'^3.5.44', pinia:'^3.0.4', 'socket.io-client':'^4.8.4',
  }
  const devDependencies = {
    vite:'^7.3.7', '@vitejs/plugin-vue':'^6.0.0', 'vue-tsc':'^3.0.7',
    typescript:'^5.9.3', '@types/node':'^22.0.0',
  }
  if (o.pwa === 'on') devDependencies['vite-plugin-pwa'] = '^2.0.0'
  if (o.ui === 'quasar2') { dependencies.quasar = '^2.35.2'; devDependencies['@quasar/vite-plugin']='^1.12.0';devDependencies['sass-embedded']='^1.93.2' }
  else { devDependencies.tailwindcss='^4.1.0';devDependencies['@tailwindcss/vite']='^4.1.0';devDependencies.daisyui='^5.0.0' }
  return {name:o.name,version:'0.1.0',private:true,type:'module',packageManager:'pnpm@10.30.2',engines:{node:'>=22.12'},
    scripts:{dev:'vite --host 127.0.0.1', 'dev:api':'node --env-file=.env.example api/server.mjs',
      'dev:all':'node scripts/dev-all.mjs',build:'vue-tsc --noEmit && vite build',typecheck:'vue-tsc --noEmit',preview:'vite preview --host 127.0.0.1'},
    dependencies,devDependencies}
}
function generatedReadme(o) {
  const renderInfo = o.render === 'ssg' ? 'Le build pré-rend les routes publiques / et /about. Les notes restent dynamiques via /api.'
    : o.render === 'ssr' ? 'Le serveur Node effectue le SSR avec un état Pinia distinct par requête.'
      : o.devApi === 'vite'
        ? 'En développement, le plugin Vite monte les services Feathers directement sur /api. En production, l’API doit être lancée et déployée séparément.'
        : 'Le frontend est une SPA Vite. En développement, une API Feathers indépendante écoute sur 127.0.0.1:3030.'
  return `# ${o.name}\n\nProjet ${o.ui} ${o.render.toUpperCase()} avec Vue 3, Pinia et FeathersJS v5 (${o.adapter}, ${o.transport}).\n\n`+
  `${renderInfo}\n\n## Démarrage local (Windows / PowerShell)\n\n`+
  '```powershell\ncorepack pnpm install\ncorepack pnpm run dev:all\n```\n\n' +
  (o.devApi === 'vite' ? 'Ouvrir http://127.0.0.1:5173. Pendant le développement, Feathers REST est servi sur le même port via /api.\n\n' : 'Ouvrir http://127.0.0.1:5173. L’API indépendante utilise http://127.0.0.1:3030.\n\n') +
  '```powershell\ncorepack pnpm run typecheck\ncorepack pnpm run build\n```\n\n' +
  (o.render !== 'spa' ? 'Pour vérifier le build, lancer `corepack pnpm run serve:production` avec l’API active.\n\n' : '') +
  (o.devApi === 'vite' ? 'Le plugin Vite est actif en développement uniquement. `pnpm run preview` sert les fichiers statiques et ne démarre pas l’API. Pour tester la SPA construite avec CRUD, lancer `corepack pnpm run dev:api` dans un premier terminal puis `corepack pnpm run preview` dans un second. Le proxy `preview.proxy` relaie /api vers 127.0.0.1:3030 (et Socket.IO vers 3031 si activé). En l’absence de backend, l’interface affiche « API indisponible » ; hors ligne, seule la coque statique reste disponible. Ne jamais exposer le serveur de démonstration sans authentification.\n\n' : '') +
  `Profil: schema ${o.schema}; auth ${o.auth}; databases ${o.db}. Les profils d'identité et les bases externes nécessitent un raccordement explicite.\n\n`+
  (o.ui==='quasar2' && o.render==='ssr'?'Quasar SSR : ouvrir http://127.0.0.1:8080 (reverse proxy local). Ne pas exposer le serveur SSR directement.\n\n':'')+
  (o.pwa === 'on' ? 'PWA SPA activée : le service worker n’est produit qu’au build. Il met en cache les ressources statiques uniquement, jamais les réponses API ou Socket.IO.\nL’icône SVG d’exemple doit être remplacée par des icônes PNG 192/512 adaptées avant une distribution publique. En HTTPS, tester les mises à jour et l’installation sur le navigateur cible.\n\n' : '') +
  'Les données de démonstration sont en mémoire ; sans authentification les services ne doivent pas être exposés publiquement.\n'
}
/** Replace the SPA proxy with the public Vite plugin. The standalone API remains for production. */
function enableSpaViteRuntime(files, options) {
  const source = files.get('vite.config.ts')
  const marker = 'plugins: [vue(),'
  const oldProxy = ",\n    proxy: { '/api': 'http://127.0.0.1:3030', '/socket.io': { target: 'ws://127.0.0.1:3031', ws: true } }"
  if (typeof source !== 'string' || !source.includes(marker) || !source.includes(oldProxy)) {
    throw new Error('Unsupported SPA Vite template for embedded Feathers; refusing partial generation')
  }
  const realtime = options.transport === 'both'
  const socket = realtime
    ? "{ port: 3031, host: '127.0.0.1', origins: ['http://127.0.0.1:' + String(Number(process.env.P4_DEV_PORT || 5173))] }"
    : 'false'
  const runtime = `feathers({
    serviceFiles: 'api/services/*/*.service.mjs',
    watchDirectories: ['api/services'],
    adapter: ${JSON.stringify(options.adapter)},
    prefix: '/api',
    lifecycle: 'managed',
    cors: false,
    socketio: ${socket},
  })`
  // 'vite preview' serves static assets: the Feathers Vite plugin is dev-only.
  // Proxy API traffic to the separately started, loopback-bound demo API.
  const previewProxy = `preview: { host: '127.0.0.1', port: 4173, strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3030',${realtime ? " '/socket.io': { target: 'ws://127.0.0.1:3031', ws: true }" : ''} } },`
  const socketProxy = realtime
    ? ",\n    proxy: { '/socket.io': { target: 'ws://127.0.0.1:3031', ws: true } }"
    : ''
  files.set('vite.config.ts',
    `import feathers from '@vevedh/vite-plugin-feathersjs'\n` +
    `import { assertCapabilities } from './api/config/capabilities.mjs'\n` +
    source.replace(marker, `${marker} ${runtime},`).replace(oldProxy, socketProxy)
      .replace('export default defineConfig({',
        '// Do not silently start an unprotected or unconfigured identity/database service.\nassertCapabilities()\nexport default defineConfig({\n' +
        `  ${previewProxy}\n` +
        `  define: { 'import.meta.env.VITE_FEATHERS_REALTIME': '${JSON.stringify(realtime ? '1' : '0')}' },`))
}

/** PWA is opt-in, SPA-only, and must never cache API or realtime responses. */
function enableSpaPwa(files, options) {
  const config = files.get('vite.config.ts')
  const marker = 'plugins: [vue(),'
  if (typeof config !== 'string' || !config.includes(marker) || config.includes('vite-plugin-pwa')) {
    throw new Error('Unsupported Vite SPA template for PWA; refusing partial generation')
  }
  const pwa = `VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      devOptions: { enabled: false },
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: ${JSON.stringify(options.name)},
        short_name: ${JSON.stringify(options.name)},
        description: 'Application Feathers et Vue',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [{ src: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        globIgnores: ['**/api/**', '**/socket.io/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\\/api(?:\\/|$)/, /^\\/socket\\.io(?:\\/|$)/],
        runtimeCaching: [],
      },
    })`
  files.set('vite.config.ts', `import { VitePWA } from 'vite-plugin-pwa'\n${config.replace(marker, `${marker} ${pwa},`)}`)
  if (files.has('public/pwa-icon.svg')) throw new Error('PWA icon conflict in source template')
  files.set('public/pwa-icon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" role="img" aria-label="Feathers app"><rect width="192" height="192" rx="40" fill="#1e293b"/><path d="M44 96l40 40 64-80" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></svg>\n')
}

export function createGenerator({outputRoot, templatesRoot, examplesRoot = templatesRoot, reportRoot = outputRoot}) {
  const output = resolve(outputRoot), templates = resolve(templatesRoot), report = resolve(reportRoot)
  function parse(args) {
    const o={ui:'daisyui',render:'spa',adapter:'koa',transport:'rest',schema:'typebox',auth:'none',db:'main:memory',pwa:'off',compose:'off',persistence:'off',tenantMode:'off',singleServer:'off',databaseMode:'single',cache:'none',storage:'none',devApi:undefined,dryRun:false,json:false}
    const seen=new Set()
    if (args.length && !args[0].startsWith('-')) {o.name=args[0];args=args.slice(1);if(args.includes('--name'))throw new Error('Use either positional name or --name, not both')}
    for(let i=0;i<args.length;i++) {
      const flag=args[i]
      if(!KEYS.has(flag)||seen.has(flag))throw new Error(`Unknown or duplicate option: ${flag}`)
      seen.add(flag)
      if(flag==='--dry-run'||flag==='--json') o[flag==='--dry-run'?'dryRun':'json']=true
      else { const value=args[++i];if(!value||value.startsWith('--'))throw new Error(`Missing ${flag}`);o[flag==='--dev-api'?'devApi':flag==='--database-mode'?'databaseMode':flag==='--tenant-mode'?'tenantMode':flag==='--single-server'?'singleServer':flag.slice(2)]=value }
    }
    if(!safeProjectName(o.name))throw new Error('Invalid or missing --name (lowercase kebab-case, max 48 characters)')
    o.devApi ??= o.render === 'spa' ? 'vite' : 'separate'
    if (!['vite','separate'].includes(o.devApi)) throw new Error('Invalid --dev-api: expected vite|separate')
    if (o.devApi === 'vite' && o.render !== 'spa') throw new Error('--dev-api vite is supported for SPA only; SSR/SSG require separate API')
    if(!['koa','express'].includes(o.adapter))throw new Error('Only koa|express adapters are supported')
    if(!['rest','both'].includes(o.transport))throw new Error('Only rest|both are supported')
    if (o.compose === 'dev-prod') o.compose = 'both'
    if (!['off','dev','prod','both'].includes(o.compose)) throw new Error('Invalid --compose: expected off|dev|prod|both')
    if (!['off','lab'].includes(o.persistence)) throw new Error('Invalid --persistence: expected off|lab')
    if (!['single','universal','multi'].includes(o.databaseMode)) throw new Error('Invalid --database-mode: single|universal|multi')
    if (!['off','isolated-lab'].includes(o.tenantMode)) throw new Error('Invalid --tenant-mode: off|isolated-lab')
    if (!['none','valkey'].includes(o.cache)) throw new Error('Invalid --cache: none|valkey')
    if (!['none','s3-external'].includes(o.storage)) throw new Error('Invalid --storage: none|s3-external')
    if (o.persistence === 'lab' && (o.cache !== 'none' || o.storage !== 'none')) throw new Error('Persistence lab requires --cache none --storage none until integrations are certified')
    if (o.compose !== 'off' && o.render !== 'spa') throw new Error('Docker Compose currently supports SPA only; SSR/SSG must be certified separately')
    if (o.compose !== 'off' && o.devApi !== 'vite' && o.compose !== 'prod') throw new Error('Compose dev requires --dev-api vite')
    if (!['on','off'].includes(o.pwa)) throw new Error('Invalid --pwa: expected on|off')
    if (o.pwa==='on' && o.render!=='spa') throw new Error('PWA is supported for SPA only; SSR/SSG require separate certification')
    if (!['typebox','json','zod'].includes(o.schema)) throw new Error('Invalid --schema: expected typebox|json|zod')
    if (!['none','jwt','oauth2','oidc','keycloak'].includes(o.auth)) throw new Error('Invalid --auth: expected none|jwt|oauth2|oidc|keycloak')
    if (!/^[a-z][a-z0-9-]{0,31}:(?:memory|mongodb|postgresql|mariadb|mysql|sqlite|universal)(?:,[a-z][a-z0-9-]{0,31}:(?:memory|mongodb|postgresql|mariadb|mysql|sqlite|universal))*$/.test(o.db)) throw new Error('Invalid --db: use alias:adapter[,alias:adapter]')
    const dbPairs=o.db.split(',').map(x=>{const [alias,adapter]=x.split(':');return {alias,adapter}})
    if(new Set(dbPairs.map(x=>x.alias)).size!==dbPairs.length)throw new Error('Duplicate database alias')
    if (o.databaseMode === 'universal' && (dbPairs.length !== 1 || dbPairs[0].adapter !== 'universal')) throw new Error('Universal mode requires exactly --db main:universal')
    if (o.databaseMode === 'universal' && o.persistence !== 'lab') throw new Error('Universal provider selection requires --persistence lab')
    if (o.databaseMode !== 'universal' && dbPairs.some(db => db.adapter === 'universal')) throw new Error('Use --database-mode universal for an universal adapter')
    if (o.databaseMode === 'multi' && o.persistence === 'lab') throw new Error('Multi-database routing is a blueprint, not a certified persistence lab')
    if (o.databaseMode === 'multi' && dbPairs.length < 2) throw new Error('Multi mode requires at least two named database declarations')
    if (o.persistence === 'lab' && (o.compose !== 'prod' || o.render !== 'spa' || o.devApi !== 'vite' || !['none','jwt'].includes(o.auth) || dbPairs.length !== 1 || !['postgresql','mariadb','mongodb',...(o.databaseMode === 'universal' ? ['universal'] : [])].includes(dbPairs[0].adapter))) {
      throw new Error('Persistence lab requires SPA --compose prod --auth none and a single postgresql|mariadb|mongodb DB')
    }
    if (o.tenantMode==='isolated-lab' && (o.auth!=='jwt' || o.persistence!=='lab' || o.compose!=='prod' || o.render!=='spa' || dbPairs.length!==1 || !['postgresql','mariadb','mongodb','universal'].includes(dbPairs[0].adapter))) throw Error('Tenant isolation requires --auth jwt --persistence lab --compose prod and one supported provider')
    // Gate25 opt-in: restrict first release to the actually validated lab profile.
    if (!['off','node','bun'].includes(o.singleServer)) throw Error('Invalid --single-server: node|bun')
    if (o.singleServer !== 'off' && !(o.ui==='daisyui' && o.render==='spa' && o.adapter==='express' && o.transport==='both' && o.compose==='prod' && o.devApi==='vite' && o.pwa==='off' && o.auth==='jwt' && o.persistence==='lab' && o.tenantMode==='isolated-lab' && o.databaseMode==='universal' && o.db==='main:universal' && o.cache==='none' && o.storage==='none')) throw Error('GATE25_SINGLE_PROFILE_REFUSED')
    // Reuse the actual R15 planner as the capability validator, not a separate feature catalogue.
    const plan=buildProjectPlan({name:o.name,ui:o.ui,render:o.render,transport:o.transport,
      engine:'auto',auth:o.auth==='oauth2'?'jwt,oauth':o.auth==='oidc'||o.auth==='keycloak'?'jwt,oidc':o.auth,db:o.databaseMode === 'universal' ? o.db.replace(':universal', ':postgresql') : o.db,primary:dbPairs[0].alias,pwa:o.pwa,schema:o.schema})
    if(!CASES[`${o.ui}:${o.render}`])throw new Error('Unsupported combination: Quasar2 supports SPA/SSR; daisyui supports SPA/SSR/SSG')
    if(o.render!=='spa' && o.transport!=='rest')throw new Error('SSR/SSG supports REST only; Socket.IO proxy not certified')
    if(o.dir!==undefined && !safeProjectName(o.dir))throw new Error('--dir must be a single safe directory name')
    o.destination=resolve(output,o.dir||o.name)
    if(dirname(o.destination)!==output)throw new Error('Destination escapes output root')
    o.case=CASES[`${o.ui}:${o.render}`];o.plan=plan;o.databases=dbPairs
    return o
  }
  async function generate(o) {
    await rejectSymlinks(output)
    await rejectSymlinks(o.destination)
    if(existsSync(o.destination))throw new Error('Destination already exists; refusing overwrite')
    const files=new Map(o.render==='spa' ? [
      ...await walk(join(templates,'spa','common')),
      ...await walk(join(templates,'spa',o.ui)),
    ] : await walk(join(resolve(examplesRoot),`${o.ui==='quasar2'?'quasar':'daisyui'}-${o.render}`)))
    // npm pack excludes files literally named .gitignore, even in subdirectories.
    // The published templates use gitignore.template, rewritten here to real .gitignore.
    if(files.has('gitignore.template')){files.set('.gitignore',files.get('gitignore.template'));files.delete('gitignore.template')}
    if(files.has('.gitignore')) {
      const ignores=files.get('.gitignore')
      const additions=['.agents/','AGENTS.md','SKILLS.md','*.prompt.md','.ai/','.codex/','.cursor/','.claude/','.gemini/','.windsurf/','.aider*','.mcp.json','.vscode/mcp.json','.github/copilot-instructions.md','docs-private/','.npmrc','.env*','!.env.example','api/.create-feathers-service.lock']
      files.set('.gitignore',ignores.trimEnd()+'\n\n# Local editor tooling and private maintenance files\n'+additions.filter(x=>!ignores.split(/\r?\n/).includes(x)).join('\n')+'\n')
    }
    if(!files.has('api/server.mjs')||!files.has('.env.example')||!files.has('index.html'))throw new Error('Incomplete source template')
    files.set('.env.example',envChange(files.get('.env.example'),o))
    if (o.devApi === 'vite') {
      enableSpaViteRuntime(files, o)
      files.set('api/config/capabilities.d.mts', 'export declare function assertCapabilities(): void\n')
    }
    if (o.pwa === 'on') enableSpaPwa(files,o)
    if(o.ui==='quasar2' && o.render==='ssr') {
      // R16 HTML has no Vite SPA identity marker; add one without touching frozen R16 sources.
      const html=files.get('index.html')
      files.set('index.html',html.replace('<meta charset="utf-8">','<meta charset="utf-8">\n    <meta name="r17-example" content="quasar-ssr">\n    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'/%3E">'))
    }
    files.set('index.html',files.get('index.html').replace('__R17_CASE__',o.case).replace(/(<meta name="r17-example" content=")[^"]+("\s*\/?>)/,`$1${o.case}$2`))
    const manifest=o.render==='spa'?spaManifest(o):o.ui==='quasar2'?quasarSSRManifest(o):JSON.parse(files.get('package.json'))
    manifest.name=o.name;manifest.private=true
    manifest.scripts={...manifest.scripts,'dev:all':o.devApi==='vite'?'vite --host 127.0.0.1':'node scripts/dev-all.mjs'}
    files.set('package.json',JSON.stringify(manifest,null,2)+'\n')
    files.set('README.md',generatedReadme(o))
    // Keep the visible application description consistent with the actual dev API mode.
    // The standalone production API is intentionally unaffected.
    if (o.render === 'spa' && o.devApi === 'vite') {
      const app = files.get('src/App.vue')
      const separateDescription = 'Le service Feathers est exécuté dans un processus séparé.'
      if (typeof app !== 'string' || !app.includes(separateDescription)) {
        throw new Error('SPA description contract changed: refusing inconsistent Vite-native scaffold')
      }
      files.set('src/App.vue', app.replace(separateDescription,
        'En développement, les services Feathers sont intégrés directement à Vite.'))
    }
    if (o.devApi !== 'vite') files.set('scripts/dev-all.mjs',await readFile(join(templates,'common',o.ui==='quasar2'&&o.render==='ssr'?'dev-all-quasar-ssr.mjs':'dev-all.mjs'),'utf8'))
    // A configuration contract, not a simulated authentication or persistence layer.
    // Non-memory databases and external identity providers fail closed at startup
    // until explicitly integrated and tested with a real provider.
    files.set('api/config/capabilities.mjs',capabilityGuard(o))
    const server=files.get('api/server.mjs').replace("from 'vite-plugin-feathersjs'","from '@vevedh/vite-plugin-feathersjs'")
    files.set('api/server.mjs',"import { assertCapabilities } from './config/capabilities.mjs'\nassertCapabilities()\n" + server)
    files.set('api/config/README.md',`# Configuration des capacités\n\nProfil sélectionné : schéma ${o.schema}, identité ${o.auth}, connexions ${o.db}.\n\nLes services en mémoire et sans authentification sont destinés au laboratoire local. Les bases externes nécessitent une instance réelle, un client Feathers/Knex ou MongoDB, ses migrations et la vérification de son cycle de vie.\n\nL'authentification JWT exige un service utilisateurs, un secret hors Git, une stratégie JWT active, des contrôles d'accès et des tests. OAuth2, OIDC et Keycloak exigent en plus un fournisseur HTTPS, la vérification de l'issuer, audience, JWKS, PKCE et le mapping des identités. Ne pas exposer l'API avant validation.\n\nLa commande \`service add tickets --schema zod --db main\` crée un service et l'enregistre dans l'API.\n`)
    files.set('api/config/profile.json',JSON.stringify({schema:o.schema,auth:o.auth,databases:o.databases,primary:o.databases[0].alias,databaseMode:o.databaseMode,cache:o.cache,storage:o.storage,operational:o.auth==='none' && o.databases.every(db=>db.adapter==='memory') && o.cache==='none' && o.storage==='none'},null,2)+'\n')
    const depMap={typebox:['@feathersjs/typebox','ajv'],json:['ajv'],zod:['zod']}
    // Dependencies for the service subcommand; project options alone create no arbitrary services.
    for(const dep of depMap[o.schema])manifest.dependencies[dep] ||= dep==='ajv'?'^8.17.1':dep==='zod'?'^4.1.0':'5.0.51'
    if(o.auth==='jwt')manifest.dependencies['@feathersjs/authentication']='5.0.50'
    if(o.auth==='oauth2')manifest.dependencies['@feathersjs/authentication-oauth']='5.0.51'
    for(const db of o.databases) {
      const drivers={mongodb:['@feathersjs/mongodb','mongodb'],postgresql:['@feathersjs/knex','knex','pg'],mariadb:['@feathersjs/knex','knex','mysql2'],mysql:['@feathersjs/knex','knex','mysql2'],sqlite:['@feathersjs/knex','knex','better-sqlite3']}
      for(const dep of drivers[db.adapter]||[])manifest.dependencies[dep] ||= dep === 'mongodb' ? '6.19.0' : dep === '@feathersjs/mongodb' ? '5.0.51' : dep === '@feathersjs/knex' ? '5.0.50' : '*'
    }
    files.set('package.json',JSON.stringify(manifest,null,2)+'\n')
    if (o.auth === 'jwt' && o.databases.some(db => ['postgresql','mariadb','mongodb'].includes(db.adapter))) {
      for (const name of ['register.mjs','policy.mjs']) files.set('api/security/' + name, await readFile(new URL('./secure-runtime/' + name, import.meta.url), 'utf8'))
      Object.assign(manifest.dependencies, { '@feathersjs/authentication-local': '5.0.50', '@casl/ability': '6.8.1', 'feathers-casl': '3.1.0' })
      manifest.dependencies.zod ||= '^4.1.0'
      files.set('package.json',JSON.stringify(manifest,null,2)+'\n')
    }
    const persistentDatabases = o.databases.filter(db => ['postgresql','mariadb','mongodb'].includes(db.adapter))
    if (o.auth === 'jwt' && persistentDatabases.length) {
      const declarations = persistentDatabases.map(db => ({ alias: db.alias, adapter: db.adapter, envPrefix: 'P5_DB_' + db.alias.replaceAll('-', '_').toUpperCase() }))
      if (new Set(declarations.map(db => db.envPrefix)).size !== declarations.length) throw new Error('Database environment prefix collision')
      files.set('api/config/database-connections.generated.mjs', 'export const databaseDeclarations = Object.freeze(' + JSON.stringify(declarations, null, 2) + ')\n')
      for (const [source, target] of [['providers.mjs','api/runtime/database-providers.generated.mjs'], ['storage.mjs','api/runtime/storage.mjs'], ['prepare-storage.mjs','scripts/prepare-storage.mjs'], ['connect.mjs','api/security/connect.mjs']]) {
        files.set(target, await readFile(new URL('./secure-runtime/' + source, import.meta.url), 'utf8'))
      }
      const env = declarations.flatMap(db => [db.envPrefix + '_HOST=127.0.0.1', db.envPrefix + '_PORT=' + (db.adapter === 'postgresql' ? '5432' : db.adapter === 'mariadb' ? '3306' : '27017'), db.envPrefix + '_USER=', db.envPrefix + '_PASSWORD=', db.envPrefix + '_NAME='])
      files.set('database.env.example', env.join('\n') + '\n')
    }
    if (o.compose !== 'off') enableCompose(files, o)
    if (o.persistence === 'lab') await enablePersistentLab(files, o)
    if (o.tenantMode === 'isolated-lab') await enableTenantIsolationLab(files, o)
    if (o.cache !== 'none' || o.storage !== 'none') await enableIntegrationBlueprints(files, o)
    if (o.singleServer !== 'off') await enableSingleServer(files, o)
    const list=[...files.keys()].sort()
    const result={name:o.name,ui:o.ui,render:o.render,adapter:o.adapter,transport:o.transport,
      destination:relative(report,o.destination).split(sep).join('/'),schema:o.schema,auth:o.auth,pwa:o.pwa,compose:o.compose,persistence:o.persistence,tenantMode:o.tenantMode,databaseMode:o.databaseMode,cache:o.cache,storage:o.storage,devApi:o.devApi,databases:o.databases,...(o.singleServer==='off'?{}:{singleServer:o.singleServer}),files:list}
    if(o.dryRun)return result
    // Do not follow symlinks and refuse any existing destination, including empty ones.
    await mkdir(output,{recursive:true})
    await rejectSymlinks(output)
    await mkdir(o.destination,{recursive:false})
    for(const [key,value] of [...files].sort(([a],[b])=>a.localeCompare(b,'en'))) {
      const filepath=resolve(o.destination,key)
      if(!filepath.startsWith(o.destination+sep))throw new Error('Template path escapes destination')
      await mkdir(dirname(filepath),{recursive:true})
      await writeFile(filepath,value.replace(/\r\n/g,'\n'),{flag:'wx'})
    }
    return result
  }
  return {parse,generate}
}

function quasarSSRManifest(o){
  return {name:o.name,version:'0.1.0',private:true,type:'module',packageManager:'pnpm@10.30.2',engines:{node:'>=22.12'},
    scripts:{'dev:ssr':'quasar dev -m ssr','build:ssr':'quasar build -m ssr',build:'quasar build -m ssr',
      typecheck:'vue-tsc --noEmit', 'dev:api':'node --env-file=.env.example api/server.mjs',
      'serve:production':'node dist/ssr/index.js',postinstall:'quasar prepare', 'dev:edge':'node scripts/edge-proxy.mjs'},
    dependencies:{'@vevedh/vite-plugin-feathersjs':'0.2.7', '@feathersjs/feathers':'5.0.50', '@feathersjs/koa':'5.0.51',
      '@feathersjs/express':'5.0.51', '@feathersjs/errors':'5.0.50', '@feathersjs/socketio':'5.0.51',
      '@feathersjs/rest-client':'5.0.50', '@feathersjs/socketio-client':'5.0.50',
      '@quasar/extras':'^1.18.0',pinia:'^3.0.4',quasar:'^2.35.2','socket.io-client':'^4.8.4',
      vue:'^3.5.44','vue-router':'^4.6.4',express:'^4.22.3','serialize-javascript':'^7.1.4'},
    devDependencies:{'@quasar/app-vite':'2.6.2','@types/node':'^22.0.0',typescript:'^5.9.3','vue-tsc':'^3.3.14',
      // Quasar app-vite 2.6.2 runs Express v4. Keep its ambient types in
      // the same major as Express runtime, including nested pnpm dependencies.
      '@types/express':'4.17.25','@types/express-serve-static-core':'4.19.9',vite:'^7.3.7'},
    pnpm:{overrides:{'@types/express':'4.17.25','@types/express-serve-static-core':'4.19.9'}}}
}
function capabilityGuard(o) {
 const external=o.databases.filter(x=>x.adapter!=='memory')
 const desc=JSON.stringify({auth:o.auth,databases:o.databases})
 return `// Generated capability contract: never silently downgrade identity or persistence.\n`+
   `export const profile=Object.freeze(${desc})\n`+
   `export function assertCapabilities(){\n`+
   `  if (profile.auth !== 'none') throw new Error('Authentication '+profile.auth+' is a configuration blueprint; identity provider and JWT validation must be integrated and certified before serving requests')\n`+
   `  const missing=profile.databases.filter(item=>item.adapter!=='memory')\n`+
   `  if(missing.length)throw new Error('Database adapters not provisioned: '+missing.map(x=>x.alias+':'+x.adapter).join(', ')+'. Configure named adapters before serving requests')\n`+
   `}\n`
}
