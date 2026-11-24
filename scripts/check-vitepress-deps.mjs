import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2]
if (mode !== 'public' && mode !== 'private') {
  process.stderr.write('Usage: node scripts/check-vitepress-deps.mjs public|private\n')
  process.exitCode = 2
} else {
  const folder = mode === 'public' ? 'docs' : 'docs-private'
  const marker = resolve(root, folder, 'node_modules', 'vitepress', 'package.json')
  const lock = resolve(root, folder, 'pnpm-lock.yaml')
  if (!existsSync(lock)) {
    process.stderr.write(`[vitepress] Lockfile missing: ${folder}/pnpm-lock.yaml\n`)
    process.exitCode = 1
  } else if (!existsSync(marker)) {
    process.stderr.write(`[vitepress] ${folder} dependencies not installed. From the repository root run: npm run docs:setup\n`)
    process.exitCode = 1
  } else {
    let version
    try { version = JSON.parse(readFileSync(marker, 'utf8')).version } catch { version = null }
    if (version !== '1.6.4') {
      process.stderr.write(`[vitepress] ${folder} expects VitePress 1.6.4, found ${version ?? 'unknown'}. Run: npm run docs:setup\n`)
      process.exitCode = 1
    } else {
      console.log(`[vitepress] ${folder}: VitePress ${version} installed`)
    }
  }
}
