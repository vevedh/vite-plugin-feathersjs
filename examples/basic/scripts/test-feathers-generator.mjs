import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { generate, parseArguments } from './service-generator/core.mjs'

const require = createRequire(import.meta.url)
const ts = require(process.env.FEATHERS_TYPESCRIPT_MODULE ?? 'typescript')
const fixture = mkdtempSync(join(tmpdir(), 'feathers-r13-test-'))
function createProject(name) {
  const root = join(fixture, name)
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'feathers.services.json'), `${JSON.stringify({ version: 1, framework: 'feathers-v5', modules: [
    { name: 'notes', path: 'notes', server: 'server/notes.ts', schema: 'shared/feathers/notes.schema.ts', methods: ['find'] },
  ] }, null, 2)}\n`)
  return root
}
function manifest(root) { return JSON.parse(readFileSync(join(root, 'feathers.services.json'), 'utf8')) }
const expectedFiles = ['server/services/articles/articles.service.ts', 'shared/feathers/articles.schema.ts', 'src/feathers/services/articles/client.ts', 'src/feathers/services/articles/store.ts']
try {
  assert.deepEqual(parseArguments(['articles', '--store', 'none', '--methods', 'find']), {
    name: 'articles', path: 'articles', store: 'none', id: 'number', realtime: false, dryRun: false, methods: ['find'],
  })
  for (const input of [
    ['../escape'], ['Notes'], ['some/escape'], ['one..two'], ['notes', '--methods', 'create,create'],
    ['notes', '--methods', 'invalid'], ['items', '--store', 'sqlite'],
    ['items', '--methods', 'create', '--store', 'pinia'],
    ['items', '--methods', 'find', '--realtime'],
    ['items', '--id', 'uuid'], ['items', '--path', '../secret'],
    ['items', '--store'], ['items', '--dry-run', '--dry-run'],
  ]) assert.throws(() => parseArguments(input), `Expected failure: ${input.join(' ')}`)

  const main = createProject('crud')
  const dry = generate(main, parseArguments(['articles', '--dry-run', '--realtime']))
  assert.equal(dry.dryRun, true)
  assert.equal(manifest(main).modules.length, 1)
  for (const path of expectedFiles) assert.ok(!existsSync(resolve(main, path)))

  const saved = readFileSync(join(main, 'feathers.services.json'), 'utf8')
  const result = generate(main, parseArguments(['articles', '--realtime']))
  assert.equal(result.dryRun, false)
  for (const path of expectedFiles) assert.ok(existsSync(resolve(main, path)), `Missing ${path}`)
  const service = readFileSync(resolve(main, 'server/services/articles/articles.service.ts'), 'utf8')
  assert.match(service, /app\.use\(articlesPath/)
  assert.match(service, /methods: \[\.\.\.articlesMethods\]/)
  assert.match(service, /service\.publish/)
  assert.match(readFileSync(resolve(main, 'server/services/articles/articles.class.ts'), 'utf8'), /async create\(/)
  assert.match(readFileSync(resolve(main, 'server/services/articles/articles.class.ts'), 'utf8'), /async remove\(/)
  const store = readFileSync(resolve(main, 'src/feathers/services/articles/store.ts'), 'utf8')
  assert.match(store, /defineStore\('feathers-articles'/)
  assert.match(store, /typeof window === 'undefined'/)
  assert.match(store, /api\.service\.off\(event, listener\)/)
  assert.equal(manifest(main).modules.length, 2)
  assert.ok(manifest(main).modules[1].serviceClass.endsWith('/articles.class.ts'))
  assert.equal(manifest(main).modules[1].storeExport, 'useArticlesStore')
  assert.throws(() => generate(main, parseArguments(['articles'])), /already exists/)
  assert.equal(manifest(main).modules.length, 2)
  assert.notEqual(readFileSync(join(main, 'feathers.services.json'), 'utf8'), saved)

  const readonly = createProject('readonly')
  generate(readonly, parseArguments(['calendar-items', '--id', 'string', '--methods', 'find,get']))
  const readOnlyCode = readFileSync(join(readonly, 'server/services/calendar-items/calendar-items.class.ts'), 'utf8')
  assert.match(readFileSync(resolve(readonly, 'server/services/calendar-items/calendar-items.class.ts'), 'utf8'), /new Map<CalendarItemsId, CalendarItemsRecord>/)
  assert.doesNotMatch(readFileSync(resolve(readonly, 'server/services/calendar-items/calendar-items.class.ts'), 'utf8'), /async create\(/)
  assert.doesNotMatch(readOnlyCode, /requireTitle/)
  const client = readFileSync(join(readonly, 'src/feathers/services/calendar-items/client.ts'), 'utf8')
  assert.doesNotMatch(client, /CalendarItemsData/)
  assert.match(client, /createFeathersServiceApi/)

  const readonlyList = createProject('readonly-list')
  generate(readonlyList, parseArguments(['catalog', '--methods', 'find', '--store', 'pinia']))
  assert.doesNotMatch(readFileSync(resolve(readonlyList, 'src/feathers/services/catalog/store.ts'), 'utf8'), /async function run\(/)

  const none = createProject('none')
  generate(none, parseArguments(['metrics', '--store', 'none', '--methods', 'find']))
  assert.equal(manifest(none).modules[1].store, undefined)
  assert.equal(manifest(none).modules[1].realtime, false)
  assert.ok(!existsSync(resolve(none, 'src/feathers/services/metrics')))
  // Parse and strictly typecheck the generated TypeScript with minimal external
  // module declarations. The actual installed packages are checked by vue-tsc.
  const shim = join(fixture, 'types.d.ts')
  writeFileSync(shim, `declare module '@feathersjs/errors' { export class BadRequest extends Error {}; export class NotFound extends Error {} }
declare module 'node:crypto' { export function randomUUID(): string }
declare module '@feathersjs/feathers' { export interface RealTimeConnection { id: string } }
declare module 'vite-plugin-feathersjs' { export interface FeathersApp { services: Record<string, unknown>; use(path: string, obj: unknown, options?: unknown): void; service(path: string): unknown; on(event: string, listener: (connection: import('@feathersjs/feathers').RealTimeConnection) => void): void } }
declare module 'pinia' { export function defineStore<T>(id: string, setup: () => T): () => T }
declare module 'vue' { export function ref<T>(value: T): {value: T}; export function computed<T>(fn: () => T): {value: T} }
declare module 'socket.io-client' { export interface Socket { on(name: string, listener: () => void): void; connect(): void; disconnect(): void; removeAllListeners(): void } }
declare module '~/lib/feathers-client' { export function createFeathersServiceApi<T>(path: string, realtime: boolean, port: number): { service: T; socket?: import('socket.io-client').Socket; disconnect(): void } }
`)
  const sources = [shim]
  for (const [root, name] of [[main, 'articles'], [readonly, 'calendar-items'], [readonlyList, 'catalog'], [none, 'metrics']]) {
    for (const rel of [`server/services/${name}/${name}.service.ts`, `server/services/${name}/${name}.class.ts`, `server/services/${name}/${name}.schema.ts`, `shared/feathers/${name}.schema.ts`, `src/feathers/services/${name}/client.ts`, `src/feathers/services/${name}/store.ts`]) {
      const file = resolve(root, rel)
      if (existsSync(file)) sources.push(file)
    }
  }
  const program = ts.createProgram(sources, {
    strict: true, noUnusedLocals: true, noUnusedParameters: true,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], noEmit: true,
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.deepEqual(diagnostics.map(diag => {
    const filename = diag.file?.fileName ?? '<unknown>'
    return `${filename}: TS${diag.code}: ${ts.flattenDiagnosticMessageText(diag.messageText, ' ')}`
  }), [], 'Generated TypeScript has errors')
  const metrics = readFileSync(resolve(none, 'server/services/metrics/metrics.class.ts'), 'utf8')
  assert.doesNotMatch(metrics, /BadRequest|NotFound|requireTitle|requireId/)

  const collisions = createProject('collision')
  mkdirSync(join(collisions, 'server/services/articles'), { recursive: true })
  writeFileSync(join(collisions, 'server/services/articles/articles.service.ts'), 'existing')
  const originalManifest = readFileSync(join(collisions, 'feathers.services.json'), 'utf8')
  assert.throws(() => generate(collisions, parseArguments(['articles'])), /overwrite/)
  assert.equal(readFileSync(join(collisions, 'server/services/articles/articles.service.ts'), 'utf8'), 'existing')
  assert.equal(readFileSync(join(collisions, 'feathers.services.json'), 'utf8'), originalManifest)

  // A symlinked destination directory must never be followed outside the project.
  const outside = join(fixture, 'outside')
  mkdirSync(outside)
  const links = createProject('links')
  try {
    symlinkSync(outside, join(links, 'server'), process.platform === 'win32' ? 'junction' : 'dir')
    assert.throws(() => generate(links, parseArguments(['articles'])), /symbolic-link/)
    assert.ok(!existsSync(join(outside, 'services/articles/articles.service.ts')))
  }
  catch (cause) {
    // Some Windows users cannot create symbolic links without Developer Mode.
    if (!['EPERM', 'EACCES'].includes(cause?.code)) throw cause
  }
  console.log('PASS: generator inputs, dry-run, CRUD + Pinia + realtime, readonly/string IDs, store-none, path safety, generated TS strict')
}
finally {
  rmSync(fixture, { recursive: true, force: true })
}
