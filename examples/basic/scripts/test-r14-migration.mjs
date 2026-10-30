import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateLegacyRegistrations } from './migrate-r14-legacy.mjs'

const base = mkdtempSync(join(tmpdir(), 'feathers-r14-migrate-'))
const root = join(base, 'project')
const folder = join(root, 'server')
mkdirSync(folder, { recursive: true })
const digest = text => createHash('sha256').update(text).digest('hex')
try {
  const notes = join(folder, 'notes.ts')
  const health = join(folder, 'health.ts')
  const approved = { 'server/notes.ts': [digest('old notes')], 'server/health.ts': [digest('old health')] }
  writeFileSync(notes, 'old notes')
  writeFileSync(health, 'user modification')
  assert.throws(() => migrateLegacyRegistrations(root, approved), /Modified\/unknown legacy file/)
  assert.equal(readFileSync(notes, 'utf8'), 'old notes', 'Migration must be atomic at validation stage')
  assert.equal(readFileSync(health, 'utf8'), 'user modification')
  writeFileSync(health, 'old health')
  assert.deepEqual(migrateLegacyRegistrations(root, approved), ['server/notes.ts', 'server/health.ts'])
  assert.equal(existsSync(notes), false)
  assert.deepEqual(migrateLegacyRegistrations(root, approved), [], 'Migration must be idempotent')
  writeFileSync(notes, 'modified')
  assert.throws(() => migrateLegacyRegistrations(root, approved), /Modified\/unknown legacy file/)
  rmSync(notes)
  try {
    symlinkSync(join(base, 'target'), notes, 'file')
    assert.throws(() => migrateLegacyRegistrations(root, approved), /non-regular legacy file/)
  }
  catch (cause) { if (!['EPERM', 'EACCES'].includes(cause?.code)) throw cause }
  assert.throws(() => migrateLegacyRegistrations(root, { '../escape': ['bad'] }), /Unsafe migration file name/)
  console.log('PASS: r14 legacy migration matches approved hashes only, is idempotent, refuses unknown files and links')
}
finally { rmSync(base, { recursive: true, force: true }) }
