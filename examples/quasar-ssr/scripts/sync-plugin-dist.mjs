import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { syncLocalDist } from '../../basic/scripts/sync-local-dist.mjs'

const exampleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageRoot = path.resolve(exampleRoot, '../..')
const installedRoot = path.join(exampleRoot, 'node_modules', 'vite-plugin-feathersjs')
const sourceDist = path.join(packageRoot, 'dist')
const source = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'))
const installed = JSON.parse(await readFile(path.join(installedRoot, 'package.json'), 'utf8'))
if (source.name !== installed.name || source.version !== installed.version) throw new Error('Local package mismatch: rerun corepack pnpm install')
const modulesRoot = await realpath(path.join(exampleRoot, 'node_modules'))
const actual = await realpath(installedRoot)
if (!actual.startsWith(modulesRoot + path.sep)) throw new Error('Refusing to synchronize outside the example node_modules')
for (const name of ['index.js', 'app.js', 'performance.js']) {
  if (!(await stat(path.join(sourceDist, name)).catch(() => null))?.isFile()) throw new Error(`Missing ${name}: run npm run build in repository root`)
}
const result = await syncLocalDist(sourceDist, path.join(installedRoot, 'dist'))
console.log(`PASS: Quasar SSR local plugin dist synchronized (copied=${result.copied}, skipped=${result.skipped}, linked=${result.linked})`)
