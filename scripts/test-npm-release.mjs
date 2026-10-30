import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const stage = join(root, '.release', 'npm')
const source = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const pkg = JSON.parse(await readFile(join(stage, 'package.json'), 'utf8'))
const readme = await readFile(join(stage, 'README.md'), 'utf8')
assert.equal(source.private, true)
assert.equal(pkg.name, '@vevedh/vite-plugin-feathersjs')
assert.equal(pkg.version, source.version)
assert.equal(pkg.private, false)
assert.deepEqual(pkg.publishConfig, { access: 'public' })
assert.equal(pkg.exports['.'].import, './dist/index.js')
assert.equal(pkg.exports['.'].types, './dist/index.d.ts')
assert.ok(!pkg.scripts, 'Release tarball must not execute lifecycle scripts')
assert.ok(readme.startsWith('# @vevedh/vite-plugin-feathersjs'))
for (const text of ['serviceFiles', "adapter: 'koa'", 'socketio: false', 'createFeathersRuntime', 'development-only', 'npm install']) assert.ok(readme.includes(text), text)
for (const name of ['index.js', 'index.d.ts', 'app.js', 'app.d.ts']) assert.ok((await stat(join(stage, 'dist', name))).isFile())
assert.deepEqual((await readdir(stage)).sort(), ['LICENSE', 'README.md', 'dist', 'package.json'])
console.log('PASS: scoped npm manifest, README examples, compiled exports, explicit root publish guard')
