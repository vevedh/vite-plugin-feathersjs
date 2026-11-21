import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path'

export function parseFlags(args, allowed, booleans = new Set(['--json'])) {
  const flags = new Map()
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]
    if (!allowed.has(flag) || flags.has(flag)) throw new Error('INVALID_OR_DUPLICATE_OPTION')
    if (booleans.has(flag)) { flags.set(flag, true); continue }
    const value = args[++i]
    if (typeof value !== 'string' || !value.length || value.startsWith('--') || value.length > 4096) throw new Error('INVALID_OPTION_VALUE')
    flags.set(flag, value)
  }
  return flags
}
export function safeName(value) {
  return typeof value === 'string' && value.length <= 48 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) &&
    !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)
}
function refuseLinks(path) {
  let item = path
  while (true) {
    if (existsSync(item) && lstatSync(item).isSymbolicLink()) throw new Error('SYMLINK_PATH_REFUSED')
    const parent = dirname(item)
    if (parent === item) break
    item = parent
  }
}
export function localPath(cwd, userPath, { allowRoot = false } = {}) {
  if (typeof userPath !== 'string' || userPath.length > 240 || userPath.includes('\\') || userPath.includes('\0') ||
    isAbsolute(userPath) || /(^|\/)\.\.(\/|$)/.test(userPath) || /^[a-z]:/i.test(userPath) || /^\/\//.test(userPath) ||
    !/^[a-zA-Z0-9_./-]+$/.test(userPath)) throw new Error('UNSAFE_RELATIVE_PATH')
  const base = resolve(cwd)
  const target = resolve(base, userPath)
  const rel = relative(base, target)
  if ((!allowRoot && !rel) || rel.startsWith('..') || isAbsolute(rel) || target !== base && !target.startsWith(base + sep)) throw new Error('PROJECT_PATH_ESCAPE')
  refuseLinks(base)
  refuseLinks(target)
  return target
}
export function readSafeJson(path, maxBytes = 65536) {
  refuseLinks(path)
  if (!existsSync(path) || !lstatSync(path).isFile()) throw new Error('JSON_FILE_NOT_FOUND')
  if (lstatSync(path).size > maxBytes) throw new Error('JSON_FILE_TOO_LARGE')
  let parsed
  try { parsed = JSON.parse(readFileSync(path, 'utf8')) } catch { throw new Error('INVALID_JSON') }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON_OBJECT_REQUIRED')
  return parsed
}
export function emit(result, isJson) {
  if (isJson) console.log(JSON.stringify(result, null, 2))
  else console.log(`${result.status} | ${result.message}`)
}
