import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, renameSync, rmSync, rmdirSync, writeFileSync, openSync, closeSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { filesFor } from './templates.mjs'

export const ALLOWED_METHODS = ['find', 'get', 'create', 'update', 'patch', 'remove']
const SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

export function parseArguments(args) {
  if (args.includes('--help') || args.includes('-h')) return { help: true }
  const result = { store: 'pinia', id: 'number', realtime: false, dryRun: false, methods: ['find', 'get', 'create', 'patch', 'remove'] }
  const seen = new Set()
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--dry-run' || arg === '--realtime') {
      if (seen.has(arg)) throw new Error(`Duplicate option: ${arg}`)
      seen.add(arg)
      result[arg === '--dry-run' ? 'dryRun' : 'realtime'] = true
    }
    else if (['--name', '--path', '--store', '--id', '--methods'].includes(arg)) {
      if (seen.has(arg)) throw new Error(`Duplicate option: ${arg}`)
      seen.add(arg)
      const value = args[++i]
      if (!value || value.startsWith('--')) throw new Error(`Missing value: ${arg}`)
      if (arg === '--methods') result.methods = value.split(',')
      else result[arg.slice(2)] = value
    }
    else if (!arg.startsWith('-') && !result.name) result.name = arg
    else throw new Error(`Unknown or duplicate argument: ${arg}`)
  }
  return normalizeOptions(result)
}

export function normalizeOptions(value) {
  const name = value.name
  const path = value.path ?? name
  if (typeof name !== 'string' || name.length > 48 || !SLUG.test(name)) throw new Error('Invalid service name: use lowercase kebab-case (max 48)')
  if (typeof path !== 'string' || path.length > 48 || !SLUG.test(path)) throw new Error('Invalid service path: use lowercase kebab-case (max 48)')
  if (value.store !== 'pinia' && value.store !== 'none') throw new Error('--store must be pinia or none')
  if (value.id !== 'number' && value.id !== 'string') throw new Error('--id must be number or string')
  if (!Array.isArray(value.methods) || value.methods.length === 0) throw new Error('At least one method is required')
  if (new Set(value.methods).size !== value.methods.length || value.methods.some(method => !ALLOWED_METHODS.includes(method)))
    throw new Error(`Invalid or repeated service methods: ${value.methods.join(',')}`)
  if (value.store === 'pinia' && !value.methods.includes('find')) throw new Error('Pinia store requires find() for refresh()')
  if (value.realtime && !value.methods.some(method => ['create', 'update', 'patch', 'remove'].includes(method)))
    throw new Error('--realtime requires at least one mutation method')
  return { name, path, store: value.store, id: value.id, methods: ALLOWED_METHODS.filter(method => value.methods.includes(method)), realtime: Boolean(value.realtime), dryRun: Boolean(value.dryRun) }
}

function verifyManifest(manifest) {
  if (manifest?.version !== 1 || manifest.framework !== 'feathers-v5' || !Array.isArray(manifest.modules))
    throw new Error('Unsupported feathers.services.json manifest format')
  const names = new Set()
  const paths = new Set()
  for (const entry of manifest.modules) {
    if (typeof entry?.name !== 'string' || !SLUG.test(entry.name) || typeof entry?.path !== 'string' || !SLUG.test(entry.path))
      throw new Error('Invalid existing manifest module')
    if (names.has(entry.name) || paths.has(entry.path)) throw new Error('Duplicate existing manifest module')
    names.add(entry.name)
    paths.add(entry.path)
  }
  return { names, paths }
}

function lstatIfPresent(path) {
  try { return lstatSync(path) }
  catch (cause) { if (cause?.code === 'ENOENT') return null; throw cause }
}

function assertSafeParents(root, destination) {
  const rel = relative(root, destination)
  if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) throw new Error('Destination is outside examples/basic')
  let candidate = root
  for (const segment of rel.split(sep)) {
    candidate = join(candidate, segment)
    if (lstatIfPresent(candidate)?.isSymbolicLink()) throw new Error(`Refusing symbolic-link destination: ${rel}`)
  }
}

/** Creates all outputs in a staging directory and installs the manifest last. */
export function generate(rootPath, config) {
  const spec = normalizeOptions(config)
  const root = realpathSync(resolve(rootPath))
  const manifestPath = join(root, 'feathers.services.json')
  assertSafeParents(root, manifestPath)
  const manifestOriginal = readFileSync(manifestPath, 'utf8')
  const manifest = JSON.parse(manifestOriginal)
  const { names, paths } = verifyManifest(manifest)
  if (names.has(spec.name) || paths.has(spec.path)) throw new Error(`Service name or path already exists: ${spec.name} / ${spec.path}`)
  const { outputs, events, pascal } = filesFor(spec)
  const destinations = [...outputs.keys()]
  for (const rel of destinations) {
    const destination = resolve(root, rel)
    assertSafeParents(root, destination)
    if (lstatIfPresent(destination)) throw new Error(`Refusing to overwrite: ${rel}`)
  }
  const moduleEntry = {
    name: spec.name, path: spec.path,
    server: `server/services/${spec.name}/${spec.name}.service.ts`,
    serviceClass: `server/services/${spec.name}/${spec.name}.class.ts`,
    serverSchema: `server/services/${spec.name}/${spec.name}.schema.ts`, schema: `shared/feathers/${spec.name}.schema.ts`,
    ...(spec.store === 'pinia' ? {
      client: `src/feathers/services/${spec.name}/client.ts`,
      store: `src/feathers/services/${spec.name}/store.ts`,
      storeExport: `use${pascal}Store`,
    } : {}),
    methods: spec.methods,
    events,
    id: spec.id,
    realtime: spec.realtime ? 'optional' : false,
  }
  manifest.modules.push(moduleEntry)
  if (spec.dryRun) return { spec, files: [...destinations, 'feathers.services.json'], dryRun: true }
  const lockPath = join(root, '.feathers-generate.lock')
  const lock = openSync(lockPath, 'wx')
  let staging
  const installed = []
  const createdDirectories = []
  let manifestCommitted = false
  try {
    // Repeat assertions after obtaining the lock: don't silently overwrite concurrent work.
    if (readFileSync(manifestPath, 'utf8') !== manifestOriginal) throw new Error('Manifest changed during generation')
    for (const rel of destinations) {
      const dest = resolve(root, rel)
      assertSafeParents(root, dest)
      if (lstatIfPresent(dest)) throw new Error(`Refusing to overwrite: ${rel}`)
    }
    staging = mkdtempSync(join(root, '.feathers-staging-'))
    for (const [rel, content] of outputs) {
      const temp = resolve(staging, rel)
      mkdirSync(dirname(temp), { recursive: true })
      writeFileSync(temp, content, { encoding: 'utf8', flag: 'wx' })
    }
    writeFileSync(join(staging, 'feathers.services.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
    for (const rel of destinations) {
      const dest = resolve(root, rel)
      const missing = []
      let current = dirname(dest)
      while (!existsSync(current) && current !== root) { missing.push(current); current = dirname(current) }
      mkdirSync(dirname(dest), { recursive: true })
      createdDirectories.push(...missing)
      if (lstatIfPresent(dest)) throw new Error(`Refusing to overwrite: ${rel}`)
      renameSync(resolve(staging, rel), dest)
      installed.push(dest)
    }
    if (readFileSync(manifestPath, 'utf8') !== manifestOriginal) throw new Error('Manifest changed before commit')
    renameSync(join(staging, 'feathers.services.json'), manifestPath)
    manifestCommitted = true
    return { spec, files: [...destinations, 'feathers.services.json'], dryRun: false }
  }
  catch (cause) {
    if (!manifestCommitted) {
      for (const dest of installed.reverse()) rmSync(dest, { force: true })
      for (const dir of [...new Set(createdDirectories)].sort((a, b) => b.length - a.length)) {
        try { if (existsSync(dir) && readdirSync(dir).length === 0) rmdirSync(dir) } catch { /* retained for diagnosis */ }
      }
    }
    throw cause
  }
  finally {
    if (staging) rmSync(staging, { force: true, recursive: true })
    closeSync(lock)
    rmSync(lockPath, { force: true })
  }
}
