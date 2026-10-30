import { readFile, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveSsrEntry } from './ssr-entry.mjs'

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export async function checkProductionDependencies(root = projectRoot, requireFromEntry) {
  const entry = await resolveSsrEntry(root)
  const output = path.resolve(root, 'dist', 'ssr')
  const manifest = JSON.parse(await readFile(path.join(output, 'package.json'), 'utf8'))
  const declared = manifest.dependencies ?? {}
  if (!Object.hasOwn(declared, 'serialize-javascript')) {
    throw new Error('Generated SSR manifest omits serialize-javascript; rebuild with r16-r3 before installing')
  }
  if (!(await stat(path.join(output, 'node_modules')).catch(() => null))?.isDirectory()) {
    throw new Error('SSR production dependencies absent: run .\\scripts\\PREPARE_R16_PRODUCTION.ps1')
  }
  const requireEntry = requireFromEntry ?? createRequire(entry)
  for (const name of ['serialize-javascript', 'express']) {
    try { requireEntry.resolve(name) }
    catch {
      throw new Error(`SSR runtime dependency ${name} unavailable: run .\\scripts\\PREPARE_R16_PRODUCTION.ps1`)
    }
  }
  return { entry, dependencyCount: Object.keys(declared).length }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkProductionDependencies()
    console.log(`PASS: SSR compiled entry and runtime dependencies (${result.dependencyCount} declared)`)
  } catch (error) {
    console.error(`FAIL: ${error.message}`)
    process.exitCode = 1
  }
}
