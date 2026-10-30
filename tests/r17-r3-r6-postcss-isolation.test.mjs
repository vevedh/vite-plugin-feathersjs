import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
const require = createRequire(import.meta.url)

test('VitePress has an explicit local PostCSS config with no inherited plugins', () => {
  const config = require('../docs/cli/postcss.config.cjs')
  assert.deepEqual(config, { plugins: {} })
  const body = readFileSync('docs/cli/postcss.config.cjs', 'utf8')
  assert.doesNotMatch(body, /require\(['"](postcss-nesting|autoprefixer)/)
})

test('public Pages whitelist includes local PostCSS isolation', () => {
  const report = execFileSync(process.execPath, ['scripts/r17/check-pages-publication.mjs'], {encoding: 'utf8'})
  assert.match(report, /PASS: 22 clean VitePress source files/)
  const preparer = readFileSync('scripts/r17/prepare-gh-pages-branch.ps1', 'utf8')
  assert.match(preparer, /postcss\.config\.cjs/)
  assert.match(preparer, /docs\/vitepress-postcss-isolation-r17-r3-r6/)
})

test('Windows Pages preparation routes into a dedicated reviewable fix branch', () => {
  const powershell = readFileSync('scripts/r17/certify-and-stage-pages-windows.ps1', 'utf8')
  assert.match(powershell, /-Branch \$Branch/)
  assert.match(powershell, /-Push/)
  const workflow = readFileSync('.github/workflows/cli-vitepress-pages.yml', 'utf8')
  assert.match(workflow, /working-directory: docs\/cli/)
  assert.match(workflow, /VITEPRESS_BASE: \/vite-plugin-feathersjs\//)
})
