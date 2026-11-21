// Opt-in generator extension for create-feathers-app, Vite 7 SPA only.
import { readFile } from 'node:fs/promises'
import { canonicalNotesContract } from './canonical-contract.mjs'

const assets = {
  'api/devtools/feathers-studio-catalog.mjs': 'feathers-studio-catalog.mjs',
  'api/devtools/feathers-studio-live.mjs': 'feathers-studio-live.mjs',
  'api/devtools/feathers-studio-live.d.mts': 'feathers-studio-live.d.mts',
  'api/devtools/feathers-studio-catalog.d.mts': 'feathers-studio-catalog.d.mts',
  'api/devtools/panel.html': 'panel.html',
  'api/devtools/panel.css': 'panel.css',
  'api/devtools/panel.js': 'panel.js',
  'src/devtools/register-feathers-studio.ts': 'register-feathers-studio.ts',
  'scripts/dev-feathers-studio.mjs': 'dev-feathers-studio.mjs',
  'src/schema-designer/main.ts': 'schema-designer/main.ts',
  'src/schema-designer/DesignerApp.vue': 'schema-designer/DesignerApp.vue',
  'src/schema-designer/studio-bridge.ts': 'schema-designer/studio-bridge.ts',
  'src/schema-designer/model.ts': 'schema-designer/model.ts',
  'src/schema-designer/draft-import.ts': 'schema-designer/draft-import.ts',
  'src/schema-designer/style.css': 'schema-designer/style.css',
  'docs/schema-designer-r6.md': 'schema-designer/generated-public.md',
}

function spliceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw Error('FEATHERS_STUDIO_TEMPLATE_DRIFT')
  return source.replace(before, after)
}

export async function enableFeathersDevtools(files, options) {
  if (options.devtools !== 'feathers') return
  if (options.render !== 'spa' || options.devApi !== 'vite' || options.adapter !== 'express') throw Error('FEATHERS_STUDIO_PROFILE_REQUIRES_SPA_VITE_EXPRESS')
  const conf = files.get('vite.config.ts')
  const main = files.get('src/main.ts')
  const manifestText = files.get('package.json')
  const notesClass = files.get('api/services/notes/notes.class.mjs')
  const notesRegistrar = files.get('api/services/notes/notes.service.mjs')
  if (typeof conf !== 'string' || typeof main !== 'string' || typeof manifestText !== 'string') throw Error('FEATHERS_STUDIO_MISSING_TEMPLATE')
  const classic = /\bconst\s+app\s*=\s*createApp\(App\)/.test(main) && /\bapp\.mount\(['"]#app['"]\)/.test(main)
  const chain = /^createApp\(App\)\.use\(createPinia\(\)\)(?:\.use\(Quasar\))?\.mount\(['"]#app['"]\);?$/gm
  const matches = [...main.matchAll(chain)]
  if ((!classic && matches.length !== 1) || (classic && matches.length !== 0) || main.includes('registerFeathersStudioDevtools')) throw Error('FEATHERS_STUDIO_MAIN_ENTRY_UNSUPPORTED')
  if (conf.includes('vite-plugin-vue-devtools') || conf.includes('feathersStudioCatalog')) throw Error('FEATHERS_STUDIO_CONFIG_CONFLICT')
  const pkg = JSON.parse(manifestText)
  if (!pkg.private || typeof pkg.devDependencies?.vite !== 'string' || !/^\^?7\./.test(pkg.devDependencies.vite)) throw Error('FEATHERS_STUDIO_VITE7_REQUIRED')
  if (pkg.devDependencies['vite-plugin-vue-devtools'] || pkg.devDependencies['@vue/devtools-api'] || pkg.scripts['dev:studio']) throw Error('FEATHERS_STUDIO_PACKAGE_CONFLICT')
  if (files.has('api/services/notes/contract.json')) throw Error('CANONICAL_NOTES_CONFLICT')
  const notesContract = canonicalNotesContract(notesClass, notesRegistrar)
  for (const target of Object.keys(assets)) if (files.has(target)) throw Error('FEATHERS_STUDIO_ASSET_CONFLICT')
  const withLive = spliceOnce(spliceOnce(conf, "    serviceFiles: 'api/services/*/*.service.mjs',", "    ...(studioLive ? { afterRegister: studioLive.afterRegister } : {}),\n    serviceFiles: 'api/services/*/*.service.mjs',"), 'export default defineConfig({', "const studioLive = process.env.NODE_ENV === 'development' && process.env.FEATHERS_STUDIO_DEVTOOLS === '1' ? createFeathersStudioLiveBridge() : undefined\nexport default defineConfig({")
  const updatedConf = `import vueDevTools from 'vite-plugin-vue-devtools'\nimport { feathersStudioCatalog } from './api/devtools/feathers-studio-catalog.mjs'\nimport { createFeathersStudioLiveBridge } from './api/devtools/feathers-studio-live.mjs'\n` + spliceOnce(withLive, 'plugins: [vue(),', `plugins: [vue(), ...(process.env.NODE_ENV === 'development' && process.env.FEATHERS_STUDIO_DEVTOOLS === '1' ? [vueDevTools(), feathersStudioCatalog(studioLive ? { live: studioLive } : {})] : []),`)
  const withRegistration = classic
    ? spliceOnce(main, 'app.mount(', `if (import.meta.env.DEV) registerFeathersStudioDevtools(app)\napp.mount(`)
    : main.replace(/^createApp\(App\)\.use\(createPinia\(\)\)(\.use\(Quasar\))?\.mount\(['"]#app['"]\);?$/m, (_original, extra = '') =>
      `const app = createApp(App).use(createPinia())${extra || ''}\nif (import.meta.env.DEV) registerFeathersStudioDevtools(app)\napp.mount('#app')`)
  const updatedMain = `import { registerFeathersStudioDevtools } from './devtools/register-feathers-studio'\n` + withRegistration
  pkg.devDependencies['vite-plugin-vue-devtools'] = '^8.0.0'
  pkg.devDependencies['@vue/devtools-api'] = '^8.0.0'
  pkg.scripts['dev:studio'] = 'node scripts/dev-feathers-studio.mjs'
  const next = new Map(files)
  next.set('api/services/notes/contract.json', notesContract)
  next.set('api/devtools/database-registry.json', studioDatabaseRegistry(options.db))
  next.set('vite.config.ts', updatedConf)
  next.set('src/main.ts', updatedMain)
  next.set('package.json', JSON.stringify(pkg, null, 2) + '\n')
  next.set('docs-private/devtools-feathers-studio.md', `# Feathers Studio — Vue DevTools v8\n\nActivation : \`npm run dev:studio\` (après installation des dépendances).\n\nVite 7 / Express / SPA uniquement. Le catalogue valide les empreintes des sources déclarées dans des contrats dans \`api/services/<nom>/contract.json\` et ne publie aucune donnée métier. L'onglet et l'inspecteur sont en lecture seule. Aucun endpoint de migration, aucun passage en production. Les migrations restent au CLI local avec préflight, approbation SHA-256, tests et rollback.\n\nLe serveur refuse les interfaces non loopback. Vérifier régulièrement les advisory npm.\n`)
  next.set('docs/feathers-studio.md', `# Explorer les schémas Feathers\n\nEn développement, Feathers Studio permet de consulter les services documentés depuis Vue DevTools. Les champs, les méthodes REST et les types s'affichent sans modifier les services. Pour faire évoluer un schéma, utilisez le CLI du projet après vérification du plan.\n`)
  next.set('docs-private/schema-designer-r6.md', "# Schema Designer — guide technique du projet généré\n\nCe document accompagne le module Feathers Studio optionnel, uniquement en développement local (Vite 7, Vue 3, Express).\n\n## Activation\n\nDans le projet généré, installez les dépendances puis exécutez `npm run dev:studio`. Ouvrez l’interface sur `http://127.0.0.1:5173/schema-designer.html` et consultez le panneau Feathers dans Vue DevTools.\n\n## Fonctionnement\n\n- Le catalogue en lecture seule est fourni par `GET /__feathers-studio/catalog`. Il vérifie les contrats et les empreintes des sources des services.\n- L’interface permet d’observer les services, de préparer un brouillon de schéma et d’exporter un JSON **non exécutable** ; elle n’applique aucune migration et ne modifie pas les services.\n- L’import d’un brouillon vérifie le format `feathers-schema-designer-draft` version 2, les clés attendues, les empreintes et une taille maximale de 64 Kio.\n- L’interface de développement doit rester accessible uniquement depuis la machine locale. Les contrôles d’accès métier et la validation côté serveur ne sont pas remplacés par cette interface.\n\n## Vérifications de sécurité avant évolution\n\n1. Vérifiez les changements de champs et les empreintes des contrats `api/services/<service>/contract.json`.\n2. Refusez les champs imprévus, les noms non autorisés et les changements de schéma non validés.\n3. Exécutez séparément les tests de validation, de droits RBAC, de typecheck et de build avant toute mise en production.\n4. Conservez les comptes rendus et sauvegardes de migration hors du répertoire public et hors des paquets npm.\n\nCe guide est une aide d’utilisation générique ; il ne contient ni les données ni les journaux des laboratoires de qualification du générateur.\n")
  for (const [target, name] of Object.entries(assets)) next.set(target, await readFile(new URL(`./feathers-studio-assets/${name}`, import.meta.url), 'utf8'))
  files.clear()
  for (const [key, value] of next) files.set(key, value)
}

/** Public metadata only. Never read URI, credentials, environment variables or contents. */
export function studioDatabaseRegistry(option) {
  const allowed = new Set(['memory', 'mongodb', 'postgresql', 'postgres', 'mariadb', 'mysql', 'sqlite', 'universal'])
  const input = typeof option === 'string' ? option : ''
  const databases = []
  for (const entry of input.split(',')) {
    const match = /^([a-z][a-z0-9-]{0,31}):([a-z][a-z0-9-]{0,23})$/.exec(entry)
    if (!match || !allowed.has(match[2]) || databases.some(item => item.alias === match[1])) continue
    if (databases.length >= 8) break
    databases.push({ alias: match[1], engine: match[2] })
  }
  return JSON.stringify({ version: 1, databases }, null, 2) + '\n'
}
