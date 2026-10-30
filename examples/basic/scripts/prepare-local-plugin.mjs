import { spawn } from 'node:child_process'
import { readFile, realpath, stat } from 'node:fs/promises'
import { syncLocalDist } from './sync-local-dist.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const exampleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageRoot = path.resolve(exampleRoot, '../..')
const sourceDist = path.join(packageRoot, 'dist')

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: false, windowsHide: true })
    child.once('error', reject)
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code ?? signal}`)))
  })
}

// Build from current source, not from a stale local package snapshot.
await run(process.execPath, [path.join(packageRoot, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'], packageRoot)
for (const filename of ['index.js', 'app.js', 'performance.js']) {
  const file = path.join(sourceDist, filename)
  if (!(await stat(file).catch(() => null))?.isFile()) throw new Error(`Missing build output: ${file}`)
}

// Resolve the package directory itself. The package is import-only and deliberately
// does not expose a CommonJS `require` condition; require.resolve() cannot be used.
const installedRoot = path.join(exampleRoot, 'node_modules', 'vite-plugin-feathersjs')
const installedManifest = JSON.parse(await readFile(path.join(installedRoot, 'package.json'), 'utf8'))
const sourceManifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'))
if (installedManifest.name !== 'vite-plugin-feathersjs' || installedManifest.version !== sourceManifest.version) {
  throw new Error('Local dependency does not match the source package version; rerun pnpm install explicitly')
}
const modulesRoot = await realpath(path.join(exampleRoot, 'node_modules'))
const destinationReal = await realpath(installedRoot)
if (!(destinationReal.startsWith(modulesRoot + path.sep))) {
  throw new Error('Resolved local package is not in the example node_modules; refusing to overwrite it')
}
const result = await syncLocalDist(sourceDist, path.join(installedRoot, 'dist'))
console.log(`PASS: synchronized local plugin dist (copied=${result.copied}, skipped=${result.skipped}, linked=${result.linked})`)
console.log('PASS: local vite-plugin-feathersjs build includes performance.js')
