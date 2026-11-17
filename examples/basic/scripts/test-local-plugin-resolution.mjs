import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const root = await mkdtemp(path.join(os.tmpdir(), 'feathers-local-resolution-'))
try {
  const example = path.join(root, 'example')
  const store = path.join(example, 'node_modules', '.pnpm', 'vite-plugin-feathersjs@file_test', 'node_modules', 'vite-plugin-feathersjs')
  const linked = path.join(example, 'node_modules', 'vite-plugin-feathersjs')
  await mkdir(store, { recursive: true })
  await writeFile(path.join(store, 'package.json'), JSON.stringify({
    name: 'vite-plugin-feathersjs', version: '0.2.6', type: 'module',
    exports: { '.': { import: './dist/index.js' } },
  }))
  await symlink(store, linked, 'junction')
  const resolved = await realpath(linked)
  const modulesRoot = await realpath(path.join(example, 'node_modules'))
  assert.ok(resolved.startsWith(`${modulesRoot}${path.sep}`))
  const manifest = JSON.parse(await readFile(path.join(linked, 'package.json'), 'utf8'))
  assert.equal(manifest.version, '0.2.6')
  assert.ok(manifest.exports['.'].import)
  assert.equal(manifest.exports['.'].require, undefined)
  console.log('PASS: import-only pnpm local package resolves by directory (no require export)')
} finally {
  await rm(root, { recursive: true, force: true })
}
