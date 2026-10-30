import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildProjectPlan } from './project-generator/plan.mjs'
import { parsePlanArguments } from './project-generator/options.mjs'

const basic = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const script = resolve(basic, 'scripts/plan-feathers-project.mjs')
const manifest = resolve(basic, 'feathers.services.json')
const before = readFileSync(manifest)
const args = [
  '--name', 'portail-cyber', '--ui', 'quasar2', '--render', 'spa', '--pwa', 'on',
  '--schema', 'typebox', '--auth', 'local,oauth', '--db', 'main:mongodb,audit:postgresql',
  '--primary', 'audit', '--transport', 'both', '--json',
]
const plan = JSON.parse(execFileSync(process.execPath, [script, ...args], { cwd: basic, encoding: 'utf8' }))
assert.equal(plan.project, 'portail-cyber')
assert.equal(plan.writesFiles, false)
assert.deepEqual(plan.authentication.strategies, ['jwt', 'local', 'oauth'])
assert.equal(plan.stack.pwa, true)
assert.equal(plan.stack.ui, 'quasar2')
assert.equal(plan.database.primary, 'audit')
assert.equal(plan.database.connections.length, 2)
assert.deepEqual(plan.database.connections.map(x => x.envKey), ['FEATHERS_DB_MAIN_URL', 'FEATHERS_DB_AUDIT_URL'])
assert(plan.proposedPackages.includes('@quasar/vite-plugin@^1'))
assert(plan.proposedPackages.includes('@feathersjs/authentication-oauth'))
assert(!JSON.stringify(plan).includes('password'))
assert.deepEqual(readFileSync(manifest), before, 'Planning modified the existing service manifest')

const zod = buildProjectPlan({ ui: 'daisyui-kit', schema: 'zod', auth: 'jwt,oidc,ldap', db: 'main:mariadb,reporting:sqlite', pwa: 'off' })
assert.deepEqual(zod.authentication.customIntegrationRequired, ['oidc', 'ldap'])
assert(zod.warnings.some(w => w.includes('Zod')))
assert(zod.warnings.some(w => w.includes('kit')))
assert(zod.warnings.some(w => w.includes('SQLite')))
assert(zod.proposedPackages.includes('zod'))
assert(zod.proposedPackages.includes('daisyui'))
assert(!zod.proposedPackages.includes('vite-plugin-pwa'))
const json = buildProjectPlan({ ui: 'daisyui', render: 'ssg', schema: 'json', auth: 'none', db: 'main:memory' })
assert.equal(json.stack.render, 'ssg')
assert(json.proposedPackages.includes('@feathersjs/schema'))
assert(!json.proposedPackages.includes('@feathersjs/authentication-client'))

// Renderer compatibility is a declared, tested plan, not a scaffold or runtime guarantee.
const renderingCases = [
  ['quasar2', 'spa', 'vite'],
  ['quasar2', 'ssr', 'quasar-cli-vite'],
  ['quasar2', 'ssg', 'quasar-cli-vite'],
  ['daisyui', 'spa', 'vite'],
  ['daisyui', 'ssr', 'vite'],
  ['daisyui', 'ssg', 'vite'],
  ['daisyui-kit', 'spa', 'vite'],
  ['daisyui-kit', 'ssr', 'vite'],
  ['daisyui-kit', 'ssg', 'vite'],
]
for (const [ui, render, expectedEngine] of renderingCases) {
  const configured = buildProjectPlan({ ui, render })
  assert.equal(configured.stack.renderEngine, expectedEngine)
  assert.equal(configured.rendering.mode, render)
  assert.equal(configured.rendering.engine, expectedEngine)
  assert.equal(configured.rendering.integrationStatus, 'not-generated-or-certified')
  assert.equal(configured.writesFiles, false)
  assert.equal(configured.rendering.hydrationRequired, render !== 'spa')
}
const quasarSsr = buildProjectPlan({ ui: 'quasar2', render: 'ssr', auth: 'jwt,local', pwa: 'on' })
assert(quasarSsr.proposedPackages.includes('@quasar/app-vite'))
assert(!quasarSsr.proposedPackages.some(pkg => pkg.startsWith('@quasar/vite-plugin')))
assert(!quasarSsr.proposedPackages.includes('vite-plugin-pwa'))
assert(quasarSsr.warnings.some(w => w.includes('NOT yet implemented')))
const quasarSsg = buildProjectPlan({ ui: 'quasar2', render: 'ssg' })
assert(quasarSsg.warnings.some(w => w.includes('beta')))
const viteSsr = buildProjectPlan({ ui: 'daisyui', render: 'ssr' })
assert(viteSsr.proposedPackages.includes('@vue/server-renderer'))
assert(viteSsr.warnings.some(w => w.includes('Pinia')))
const viteSsg = buildProjectPlan({ ui: 'daisyui-kit', render: 'ssg' })
assert(viteSsg.proposedPackages.includes('vite-ssg'))
assert(viteSsg.warnings.some(w => w.includes('private content')))
assert.equal(buildProjectPlan({ ui: 'quasar2', render: 'spa', engine: 'quasar-cli-vite' }).stack.renderEngine, 'quasar-cli-vite')

const badInputs = [
  { name: '../app' },
  { name: 'BadApp' },
  { ui: 'nuxt' },
  { ui: 'quasar2', render: 'ssg', engine: 'vite' },
  { ui: 'daisyui', render: 'ssr', engine: 'quasar-cli-vite' },
  { engine: 'invalid' },
  { pwa: 'maybe' },
  { schema: 'typescript' },
  { auth: 'none,jwt' },
  { auth: 'jwt,jwt' },
  { auth: 'apikey' },
  { db: 'main:mongodb,main:postgresql' },
  { db: '../main:mongodb' },
  { db: 'main:oracle' },
  { db: 'main:mongodb', primary: 'unknown' },
  { transport: 'webtransport' },
]
for (const invalid of badInputs) assert.throws(() => buildProjectPlan(invalid), Error, JSON.stringify(invalid))
for (const invalidArgs of [
  ['--ui', 'react'],
  ['--schema', 'zod', '--schema', 'typebox'],
  ['--db'],
  ['--unknown', 'value'],
  ['--auth', 'none,jwt'],
]) {
  const result = spawnSync(process.execPath, [script, ...invalidArgs], { cwd: basic, encoding: 'utf8' })
  assert.notEqual(result.status, 0, JSON.stringify(invalidArgs))
  assert.match(result.stderr, /FAIL/)
}
assert.deepEqual(readFileSync(manifest), before, 'Planner wrote files')
assert.deepEqual(parsePlanArguments(['--help']), { help: true })
console.log('PASS: CLI capability matrix SPA/SSR/SSG by UI/engine, PWA, schema, auth and multi-DB; read-only plans')
