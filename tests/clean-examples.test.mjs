import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { cleanExamples } from '../scripts/maintenance/clean-examples.mjs'

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'feathers-clean-examples-'))
  const root = join(base, 'repo')
  const generated = join(root, 'examples', 'r17', 'generated')
  await mkdir(generated, { recursive: true })
  await mkdir(join(root, 'examples', 'basic'), { recursive: true })
  await mkdir(join(root, 'examples', 'quasar-ssr'), { recursive: true })
  await mkdir(join(generated, 'r17-quasar-ssr'))
  await writeFile(join(generated, 'r17-quasar-ssr', 'package.json'), JSON.stringify({ name: 'r17-quasar-ssr' }))
  await mkdir(join(generated, 'unrelated'))
  await writeFile(join(generated, 'unrelated', 'package.json'), JSON.stringify({ name: 'unrelated' }))
  await symlink(join(root, 'examples', 'basic'), join(generated, 'r17-symlink'), 'dir')
  return { base, root, generated }
}

test('dry-run does not modify examples', async t => {
  const { root, generated } = await fixture(t)
  const result = await cleanExamples({ root, apply: false })
  assert.equal(result.selected, 1)
  assert.equal(result.mode, 'dry-run')
  assert.equal((await stat(join(generated, 'r17-quasar-ssr'))).isDirectory(), true)
  assert.ok(result.entries.find(entry => entry.state === 'skip-not-directory'))
})

test('apply requires safe quarantine outside project', async t => {
  const { root } = await fixture(t)
  await assert.rejects(() => cleanExamples({ root, apply: true, quarantine: join(root, 'tmp') }), /Quarantine/)
  await assert.rejects(() => cleanExamples({ root, apply: true }), /requires/)
})

test('quarantine moves only recognized generated projects', async t => {
  const { root, generated, base } = await fixture(t)
  const quarantine = join(base, 'quarantine')
  const reportPath = join(root, 'docs-private', 'maintenance', 'cleanup.json')
  const result = await cleanExamples({ root, apply: true, quarantine, report: reportPath })
  assert.equal(result.entries.filter(entry => entry.state === 'moved').length, 1)
  assert.equal((await stat(join(quarantine, 'r17-quasar-ssr'))).isDirectory(), true)
  assert.equal((await stat(join(generated, 'unrelated'))).isDirectory(), true)
  assert.equal((await stat(join(root, 'examples', 'basic'))).isDirectory(), true)
  assert.equal((await stat(join(root, 'examples', 'quasar-ssr'))).isDirectory(), true)
  assert.match(await readFile(reportPath, 'utf8'), /"moved"/)
})
