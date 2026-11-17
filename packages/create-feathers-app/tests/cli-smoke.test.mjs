import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
test('CLI expose create-feathers-app et cfapp sur un seul binaire', () => {
  assert.equal(manifest.private, false)
  assert.equal(manifest.bin.cfapp, manifest.bin['create-feathers-app'])
  assert.ok(existsSync(resolve(root, manifest.bin.cfapp)))
})
test('CLI --help et --version s exécutent hors du dépôt historique', () => {
  const bin = resolve(root, manifest.bin.cfapp)
  for (const arg of ['--help', '--version']) {
    const result = spawnSync(process.execPath, [bin, arg], { cwd: root, encoding: 'utf8', timeout: 12000, env: { ...process.env, CI: '1' } })
    assert.equal(result.status, 0, String(result.stderr || result.stdout).slice(0, 500))
  }
})
test('les quatre templates incluent un .env.example et jamais .env', () => {
  for (const sub of ['spa/common', 'daisyui-ssr', 'daisyui-ssg', 'quasar-ssr']) {
    assert.ok(existsSync(resolve(root, 'templates', sub, '.env.example')))
    assert.equal(existsSync(resolve(root, 'templates', sub, '.env')), false)
  }
})
