import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, link, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { syncLocalDist } from './sync-local-dist.mjs'

const root = await mkdtemp(path.join(os.tmpdir(), 'feathers-dist-sync-'))
try {
  const source = path.join(root, 'source')
  const dest = path.join(root, 'dest')
  await mkdir(source)
  await mkdir(dest)
  await writeFile(path.join(source, 'index.js'), 'export const version = 2')
  await link(path.join(source, 'index.js'), path.join(dest, 'index.js'))
  await writeFile(path.join(source, 'performance.js'), 'export const profile = true')
  const first = await syncLocalDist(source, dest)
  assert.equal(first.skipped, 1, 'hardlinked file should not be copied onto itself')
  assert.equal(first.copied, 1)
  assert.equal(await readFile(path.join(dest, 'performance.js'), 'utf8'), 'export const profile = true')
  const second = await syncLocalDist(source, dest)
  assert.equal(second.skipped, 1)
  assert.equal(second.copied, 1)
  const linked = path.join(root, 'linked')
  await symlink(source, linked, process.platform === 'win32' ? 'junction' : 'dir')
  const third = await syncLocalDist(source, linked)
  assert.equal(third.linked, true)
  assert.equal(third.copied, 0)
  console.log('PASS: local dist sync handles pnpm hardlinks, separate files and directory links')
} finally {
  await rm(root, { recursive: true, force: true })
}
