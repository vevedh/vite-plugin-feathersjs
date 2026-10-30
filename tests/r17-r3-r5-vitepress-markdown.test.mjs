import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { findUnsafeTableCodePipes } from '../scripts/r17/vitepress-markdown-lint.mjs'

test('VitePress table lint identifies the Windows Pages failure in the previous documentation', () => {
  const original = '| `--db <alias>:postgresql|mariadb|mysql|sqlite` | Exemple |\n' +
    '| `--schema typebox|json|zod` | Exemple |'
  assert.deepEqual(findUnsafeTableCodePipes(original).map((x) => x.line), [1, 2])
})

test('VitePress table lint allows separate inline code examples or escaped pipes', () => {
  const correct = '| `--db NOM:postgresql` (ou `mariadb`, `sqlite`) | Exemple |\n' +
    '| `--schema typebox`, `--schema json`, `--schema zod` | Exemple |\n' +
    '| `a\\|b` | Exemple |'
  assert.deepEqual(findUnsafeTableCodePipes(correct), [])
})

test('R17-r3-r5 guide resolves the Vue template compilation risk and docs check passes', () => {
  const guide = readFileSync('docs/cli/guide/identites-bases.md', 'utf8')
  assert.deepEqual(findUnsafeTableCodePipes(guide), [])
  assert.doesNotMatch(guide, /<alias>/)
  const check = execFileSync(process.execPath, ['scripts/check-r17-docs.mjs'], { encoding: 'utf8' })
  assert.match(check, /PASS: VitePress 1\.6\.4 source validated, 16 pages/)
})
