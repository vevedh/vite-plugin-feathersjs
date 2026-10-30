import { copyFile, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const stage = join(source, '.release', 'npm')
const pkg = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
if (pkg.name !== 'vite-plugin-feathersjs' || pkg.private !== true) {
  throw new Error('Unsafe source manifest: expected an unpublished, private legacy development package')
}
if (!/^0\.2\.6$/.test(pkg.version)) throw new Error('Version changed: review and update the release contract first')
const scopedName = '@vevedh/vite-plugin-feathersjs'
const whitelist = [
  'index.js', 'index.d.ts', 'app.js', 'app.d.ts',
  'options.js', 'options.d.ts', 'types.d.ts', 'performance.js',
]
for (const name of whitelist) {
  if (!(await lstat(join(source, 'dist', name)).catch(() => null))?.isFile()) {
    throw new Error(`Missing dist/${name}: run npm run build first`)
  }
}
const release = {
  ...pkg,
  name: scopedName,
  private: false,
  publishConfig: { access: 'public' },
}
delete release.scripts
// The compiled plugin is a runtime library; source tests and demo tooling are not published.
release.files = ['dist', 'README.md', 'LICENSE']
for (const group of ['dependencies', 'peerDependencies']) {
  if (Object.values(release[group] || {}).some(value => typeof value !== 'string' || /^(?:file:|link:|workspace:)/.test(value))) {
    throw new Error(`Local or unsupported dependencies in ${group}`)
  }
}
await rm(stage, { recursive: true, force: true })
await mkdir(stage, { recursive: true })
for (const file of ['README.md', 'LICENSE']) await copyFile(join(source, file), join(stage, file))
await mkdir(join(stage, 'dist'))
// Copy only compiled output files, not source, demos or other private artifacts.
import { readdir } from 'node:fs/promises'
async function copyDist(input, output) {
  for (const entry of await readdir(input, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Refusing symlink in dist: ${entry.name}`)
    if (entry.isDirectory()) {
      await mkdir(join(output, entry.name), { recursive: true })
      await copyDist(join(input, entry.name), join(output, entry.name))
    } else if (entry.isFile()) {
      if (!/\.(?:js|d\.ts|map|css)$/.test(entry.name)) throw new Error(`Unexpected dist asset: ${entry.name}`)
      await copyFile(join(input, entry.name), join(output, entry.name))
    } else throw new Error(`Unexpected dist entry: ${entry.name}`)
  }
}
await copyDist(join(source, 'dist'), join(stage, 'dist'))
await writeFile(join(stage, 'package.json'), `${JSON.stringify(release, null, 2)}\n`)
console.log(`PASS: staged ${scopedName}@${release.version} at .release/npm (root remains private)`)
