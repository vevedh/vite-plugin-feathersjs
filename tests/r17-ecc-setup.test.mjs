import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('ECC optional setup is offline by default and has complete guardrails', () => {
  const run = spawnSync(process.execPath, ['scripts/ecc/verify-ecc-contract.mjs'], { cwd: root, encoding: 'utf8' })
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`)
  assert.match(run.stdout, /PASS: ECC optional integration/)
})

test('ECC setup is independent of the npm runtime package and public VitePress site', () => {
  const stage = readFileSync(resolve(root, 'scripts/stage-r17-cli.mjs'), 'utf8')
  const docs = readFileSync(resolve(root, 'docs/cli/.vitepress/config.mts'), 'utf8')
  assert.doesNotMatch(stage, /ecc-profile|setup-ecc|verify-ecc-contract/)
  assert.doesNotMatch(docs, /ecc-universal|scripts\/ecc/)
  const guide = readFileSync(resolve(root, '.agents/skills/vevedh-full-web-stack-vite/references/ecc-setup.md'), 'utf8')
  assert.match(guide, /ne remplace pas|ne remplacent pas/)
})
