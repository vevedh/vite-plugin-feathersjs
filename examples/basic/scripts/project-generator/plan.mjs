import { normalizePlanOptions } from './options.mjs'

const DATABASE_PACKAGES = {
  memory: ['@feathersjs/memory'],
  mongodb: ['@feathersjs/mongodb', 'mongodb'],
  postgresql: ['@feathersjs/knex', 'knex', 'pg'],
  mariadb: ['@feathersjs/knex', 'knex', 'mysql2'],
  mysql: ['@feathersjs/knex', 'knex', 'mysql2'],
  sqlite: ['@feathersjs/knex', 'knex'],
}
const PROVIDERS = {
  jwt: ['@feathersjs/authentication'],
  local: ['@feathersjs/authentication-local'],
  oauth: ['@feathersjs/authentication-oauth'],
  oidc: [],
  ldap: [],
}
/** Deterministic, read-only plan. This is a capability contract, NOT a scaffold.
 * Store no connection URLs or authentication secrets in this plan.
 */
export function buildProjectPlan(rawOptions) {
  const options = normalizePlanOptions(rawOptions)
  const packages = new Set(['vite', 'vue', 'pinia', '@feathersjs/feathers', '@feathersjs/koa', 'vite-plugin-feathersjs'])
  const tasks = []
  const warnings = []
  if (options.ui === 'quasar2') {
    if (options.engine === 'vite') {
      for (const pkg of ['quasar', '@quasar/extras', '@quasar/vite-plugin@^1', 'sass-embedded']) packages.add(pkg)
      tasks.push('Vite 7 requires @quasar/vite-plugin 1.x, which supports SPA only; certify Quasar 2 component compatibility.')
    }
    else {
      for (const pkg of ['quasar', '@quasar/extras', '@quasar/app-vite']) packages.add(pkg)
      tasks.push('Use Quasar CLI with Vite rather than @quasar/vite-plugin. Scaffold independently and certify integration with Feathers v5, services, Pinia, HMR and deployment.')
      if (options.render === 'ssg') warnings.push('Quasar CLI Vite SSG is in beta: APIs and deployment requirements may change.')
      warnings.push('Quasar CLI SSR/SSG + vite-plugin-feathersjs integration is NOT yet implemented or certified in this project.')
    }
  }
  else {
    for (const pkg of ['tailwindcss', '@tailwindcss/vite', 'daisyui']) packages.add(pkg)
    if (options.ui === 'daisyui-kit') warnings.push('daisyUI kit is an external UI-template/preset selection; its license and assets are NOT bundled or installed by the planner.')
    tasks.push('Use the Tailwind 4 Vite plugin and daisyUI CSS; avoid duplicate global UnoCSS/Tailwind resets.')
    if (options.render === 'ssr') {
      packages.add('@vue/server-renderer')
      tasks.push('Build a Vite/Vue SSR server entry, isolated per-request Vue/Pinia state, HTML template and hydration, and certify dev and production SSR.')
    }
    if (options.render === 'ssg') {
      packages.add('vite-ssg')
      tasks.push('Prerender only public/static routes; verify generated HTML and client hydration, and use a separate Feathers API for dynamic data.')
    }
  }
  if (options.render === 'ssr') {
    warnings.push('SSR must isolate Pinia and authentication state per request; never serialize tokens, secrets or other users’ data into HTML.')
    tasks.push('Define a production SSR server lifecycle, security headers, cache policy and explicit separation from Feathers REST/Socket.IO endpoints.')
  }
  if (options.render === 'ssg') {
    warnings.push('SSG must not bake user-specific, authenticated or private content into static HTML; dynamic services require a running Feathers API.')
  }
  if (options.pwa === 'on') {
    if (options.engine === 'vite') packages.add('vite-plugin-pwa')
    tasks.push(options.engine === 'quasar-cli-vite' ? 'Configure Quasar CLI PWA takeover / offline mode for the selected SSR/SSG build, and certify separately.' : 'Configure manifest, icons, service worker lifecycle and offline caching; test update/recovery and HTTPS deployment.')
  }
  if (options.schema === 'typebox') {
    packages.add('@feathersjs/typebox')
    packages.add('@feathersjs/schema')
  }
  else if (options.schema === 'json') {
    packages.add('@feathersjs/schema')
    tasks.push('Generate plain JSON Schema and typed Ajv validators/resolvers; compile schema once, do not bypass query validation.')
  }
  else {
    packages.add('zod')
    warnings.push('Zod requires a Feathers v5 validation/resolver integration. The native TypeBox/Ajv generator cannot be reused unchanged.')
    tasks.push('Implement and test dedicated Zod validation hooks for data, patch and query before enabling generated services.')
  }
  for (const strategy of options.auth.filter(item => item !== 'none')) {
    for (const pkg of PROVIDERS[strategy]) packages.add(pkg)
    if (strategy === 'oidc' || strategy === 'ldap') warnings.push(`${strategy.toUpperCase()} requires a separately implemented/audited authentication strategy and identity-provider configuration.`)
  }
  if (!options.auth.includes('none')) {
    packages.add('@feathersjs/authentication-client')
    tasks.push('Register AuthenticationService and per-service authenticate/authorize hooks; require RBAC for protected services.')
  }
  if (options.auth.includes('oauth')) tasks.push('Choose OAuth providers explicitly and configure redirect allowlists, callback HTTPS URLs, account linking and secret storage.')
  for (const db of options.databases) for (const pkg of DATABASE_PACKAGES[db.adapter]) packages.add(pkg)
  if (options.databases.some(db => db.adapter === 'sqlite')) warnings.push('Choose and certify a compatible SQLite driver for the target Node/Knex versions before implementation.')
  if (options.databases.some(db => db.adapter === 'memory')) warnings.push('Memory adapter is for development/test: not durable production storage.')
  if (options.databases.length > 1) tasks.push('Create separate named clients and bind each service to exactly one connection; cross-database transactions are not automatic.')
  const connections = options.databases.map(({ alias, adapter }) => ({ alias, adapter, envKey: `FEATHERS_DB_${alias.replaceAll('-', '_').toUpperCase()}_URL`, isPrimary: alias === options.primary }))
  const rendering = {
    mode: options.render,
    engine: options.engine,
    deployment: options.render === 'ssr' ? 'node-ssr-runtime-required' : options.render === 'ssg' ? 'static-pages-plus-separate-feathers-api' : 'static-spa-plus-feathers-api',
    hydrationRequired: options.render !== 'spa',
    integrationStatus: 'not-generated-or-certified',
  }
  return {
    version: 2, status: 'planning-only', writesFiles: false,
    project: options.name,
    stack: { vite: options.engine === 'vite' ? '7' : 'managed-by-quasar-cli', vue: '3', feathers: '5', pinia: true, ui: options.ui, render: options.render, renderEngine: options.engine, pwa: options.pwa === 'on', schema: options.schema, transport: options.transport },
    rendering,
    authentication: { strategies: options.auth, customIntegrationRequired: options.auth.filter(item => ['oidc', 'ldap'].includes(item)) },
    database: { primary: options.primary, connections },
    proposedPackages: [...packages].sort(),
    implementationTasks: tasks,
    warnings,
  }
}
