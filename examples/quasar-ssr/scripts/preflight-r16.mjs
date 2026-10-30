import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveSsrEntry } from './ssr-entry.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stage = (process.argv.find(v => v.startsWith('--stage=')) || '--stage=dev').split('=')[1].toLowerCase()
if (!['dev', 'production'].includes(stage)) throw new Error('Invalid --stage=dev|production')
if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22+ required')
const main = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const pkg = path.join(root, 'node_modules', '@quasar', 'app-vite', 'package.json')
let cli
try { cli = JSON.parse(await readFile(pkg, 'utf8')) }
catch { throw new Error('Missing @quasar/app-vite: run corepack pnpm install in examples/quasar-ssr') }
if (!/^2\./.test(cli.version)) throw new Error(`Expected @quasar/app-vite v2.x, received ${cli.version}; Vite 8 migration is not certified`)
const installed = path.join(root, 'node_modules', 'vite-plugin-feathersjs')
const installedPkg = JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8').catch(() => '{"name":"missing"}'))
if (installedPkg.name !== 'vite-plugin-feathersjs' || installedPkg.version !== '0.2.6') throw new Error('Local vite-plugin-feathersjs 0.2.6 not installed: rerun pnpm install')
for (const name of ['index.js', 'app.js', 'performance.js']) {
  if (!(await stat(path.join(installed, 'dist', name)).catch(() => null))?.isFile()) throw new Error(`Missing compiled plugin ${name}: npm run build at repository root, then node scripts/sync-plugin-dist.mjs`)
}
if (stage === 'production') console.log(`SSR entry: ${await resolveSsrEntry(root)}`)
console.log(`PASS: Quasar CLI ${cli.version}, plugin ${installedPkg.version}, Node ${process.versions.node}, stage=${stage}, ${main.name}`)
