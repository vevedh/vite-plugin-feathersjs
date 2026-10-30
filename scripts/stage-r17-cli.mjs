#!/usr/bin/env node
/** Build a clean, independently publishable CLI without copying installed examples. */
import { cp, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'packages/create-feathers-app')
const output = resolve(root, '.release/create-feathers-app')
const excluded = new Set([
  'node_modules', 'dist', 'coverage', '.vite', '.quasar', '.git', '.agents', '.ai',
  '.claude', '.codex', '.cursor', '.vscode', 'docs-private', 'test-results',
  'playwright-report', '.release', '.env', '.npmrc', 'pnpm-lock.yaml',
  'package-lock.json', 'yarn.lock', 'bun.lock', 'bun.lockb', '.DS_Store',
])
// Path arguments from fs.cp use the platform separator. Support both Windows and POSIX.
export function isExcludedTemplatePath(pathname) {
  const name = pathname.split(/[\\/]/).at(-1)
  return excluded.has(name) || /^\.env\.(?!example$)/.test(name) || /\.(?:log|tgz|zip)$/.test(name)
}

async function cleanCopy(from, to) {
  const stat = await lstat(from)
  if (stat.isSymbolicLink()) throw new Error(`Template symlink refused: ${from}`)
  await cp(from, to, {
    recursive: true,
    force: false,
    errorOnExist: true,
    filter: async (pathname) => {
      if (isExcludedTemplatePath(pathname)) return false
      if ((await lstat(pathname)).isSymbolicLink()) throw new Error(`Template symlink refused: ${pathname}`)
      return true
    },
  })
}

async function stage() {
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  for (const asset of ['bin', 'lib', 'README.md', 'LICENSE', 'package.json']) {
    await cleanCopy(resolve(source, asset), resolve(output, asset))
  }
  const templates = resolve(output, 'templates')
  await mkdir(templates, { recursive: true })
  for (const item of ['spa', 'common']) {
    await cleanCopy(resolve(root, 'examples/r17/templates', item), resolve(templates, item))
  }
  // Only these project source assets are publishable; never copy whole example roots.
  const appAssets = [
    '.env.example', '.gitignore', 'README.md', 'index.html', 'package.json',
    'tsconfig.json', 'vite.config.ts', 'api', 'scripts', 'src',
  ]
  for (const mode of ['ssr', 'ssg']) {
    const destination = resolve(templates, `daisyui-${mode}`)
    await mkdir(destination, { recursive: true })
    for (const asset of appAssets) {
      await cleanCopy(resolve(root, 'examples/r17', `daisyui-${mode}`, asset), resolve(destination, asset))
    }
  }
  // Quasar 2 SSR: copy ONLY the certified application runtime sources.
  // Never include local plugin imports, Playwright artifacts, R16 private docs or dependencies.
  const quasarSSR = resolve(templates, 'quasar-ssr')
  await mkdir(quasarSSR, { recursive: true })
  const quasarAssets = [
    '.env.example', '.gitignore', 'index.html', 'quasar.config.ts', 'tsconfig.json',
    'src', 'src-ssr', 'api',
  ]
  for (const asset of quasarAssets) {
    await cleanCopy(resolve(root, 'examples/quasar-ssr', asset), resolve(quasarSSR, asset))
  }
  await mkdir(resolve(quasarSSR, 'scripts'), { recursive: true })
  for (const asset of ['edge-proxy.mjs', 'edge-routing.mjs']) {
    await cleanCopy(resolve(root, 'examples/quasar-ssr/scripts', asset), resolve(quasarSSR, 'scripts', asset))
  }
  // npm never packs .gitignore files, so reconstruct them when scaffolding.
  for (const parent of ['spa/common', 'daisyui-ssr', 'daisyui-ssg', 'quasar-ssr']) {
    await rename(resolve(templates, parent, '.gitignore'), resolve(templates, parent, 'gitignore.template'))
  }
  const manifestPath = resolve(output, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  delete manifest.private
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  const report = await auditStagedPackage(output)
  console.log(`PASS: staged ${manifest.name}@${manifest.version} (${report.count} clean files, ${report.bytes} bytes) at .release/create-feathers-app`)
}

export async function auditStagedPackage(packagePath) {
  let count = 0, bytes = 0
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name)
      const rel = relative(packagePath, absolute).split(sep).join('/')
      if (isExcludedTemplatePath(entry.name) || entry.name === '.gitignore') {
        throw new Error(`Unsafe staged CLI asset: ${rel}`)
      }
      if (entry.isSymbolicLink()) throw new Error(`Staged symlink refused: ${rel}`)
      if (entry.isDirectory()) await walk(absolute)
      else if (entry.isFile()) {
        count++
        bytes += (await lstat(absolute)).size
      } else throw new Error(`Unsupported staged asset: ${rel}`)
    }
  }
  await walk(packagePath)
  if (count > 200 || bytes > 2 * 1024 * 1024) {
    throw new Error(`Abnormal CLI payload: ${count} files, ${bytes} bytes; refusing npm release`)
  }
  return { count, bytes }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await stage() } catch (error) { console.error(`FAIL: CLI staging: ${error.message}`); process.exitCode = 1 }
}
