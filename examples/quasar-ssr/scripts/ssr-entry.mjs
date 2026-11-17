import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Resolve the entry declared by Quasar itself, without interpreting a shell command. */
export async function resolveSsrEntry(root = projectRoot) {
  const output = path.resolve(root, 'dist', 'ssr')
  const pkgPath = path.join(output, 'package.json')
  let manifest
  try { manifest = JSON.parse(await readFile(pkgPath, 'utf8')) }
  catch { throw new Error('SSR dist/package.json absent or malformed: run pnpm run build:ssr first') }
  const script = manifest.scripts?.start
  if (typeof script !== 'string') throw new Error('SSR build has no package.json scripts.start')
  const match = /^node\s+(?:\.\/)?([A-Za-z0-9_.\/-]+\.m?js)$/.exec(script.trim())
  if (!match) throw new Error(`Unsupported Quasar SSR start script: ${JSON.stringify(script)}. Inspect dist/ssr/package.json`)
  const entry = path.resolve(output, match[1])
  const rel = path.relative(output, entry)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('SSR start script escapes dist/ssr')
  if (!(await stat(entry).catch(() => null))?.isFile()) throw new Error(`Compiled SSR entry missing: ${entry}`)
  return entry
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(await resolveSsrEntry()) }
  catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1 }
}
