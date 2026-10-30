#!/usr/bin/env node
/** Offline, read-only ECC integration contract. Never installs or invokes ECC. */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')
const profile = JSON.parse(read('scripts/ecc/ecc-profile.json'))
assert.equal(profile.source, 'https://ecc.tools/skills')
assert.equal(profile.upstream, 'https://github.com/affaan-m/ECC')
assert.equal(profile.package, 'ecc-universal')
assert.equal(profile.version, '2.2.3')
assert.equal(profile.defaultMode, 'Plan')
assert.equal(profile.strategy, 'guided-opt-in')
assert.deepEqual(profile.harnesses, ['codex', 'claude', 'kimi'])
assert.ok(profile.skills.length >= 8 && profile.skills.length <= 12)
for (const group of [profile.skills, profile.agents, profile.commands]) {
  assert.equal(new Set(group).size, group.length, 'Duplicate catalog ID')
  for (const id of group) assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
}
for (const invariant of Object.values(profile.policy)) assert.equal(invariant, true)

const skill = read('.agents/skills/vevedh-full-web-stack-vite/SKILL.md')
const ref = read('.agents/skills/vevedh-full-web-stack-vite/references/ecc-setup.md')
assert.match(skill, /references\/ecc-setup\.md/)
assert.match(skill, /FeathersJS \*\*v5\*\*/)
assert.match(skill, /Project rules always win/)
assert.match(ref, /https:\/\/ecc\.tools\/skills/)
assert.match(ref, /2\.2\.3/)
for (const id of profile.skills) assert.ok(ref.includes(`\`${id}\``), `Missing skill mapping: ${id}`)

const setup = read('scripts/ecc/setup-ecc.ps1')
assert.match(setup, /\[ValidateSet\('Plan','Preview','Install'\)\]/)
assert.match(setup, /\[string\]\$Mode = 'Plan'/)
assert.match(setup, /if \(\$Mode -eq 'Plan'\)/)
assert.match(setup, /  return/)
assert.match(setup, /'--guided'/)
assert.match(setup, /'--dry-run'/)
assert.match(setup, /& \$npx\.Source @argv/)
assert.doesNotMatch(setup, /Invoke-Expression|\biex\b|Invoke-WebRequest|curl\b|\b--yes\b|npm publish|git push|Start-Process/)
assert.ok(setup.indexOf('  return') < setup.indexOf('Get-Command npx'), 'Plan must exit before external commands')

const ignores = read('.gitignore')
for (const entry of ['.agents/', '.codex/', '.claude/', '.cursor/', '.ecc/', '.kimi-code/', 'docs-private/', '.env*']) {
  assert.ok(ignores.split(/\r?\n/).includes(entry), `Missing gitignore entry: ${entry}`)
}
const pluginManifest = JSON.parse(read('package.json'))
assert.equal(pluginManifest.version, '0.2.6')
assert.equal(JSON.stringify(pluginManifest).includes('ecc-universal'), false)
const cliManifest = JSON.parse(read('packages/create-feathers-app/package.json'))
assert.equal(JSON.stringify(cliManifest).includes('ecc-universal'), false)
console.log(`PASS: ECC optional integration: ${profile.skills.length} curated skills, pinned ${profile.package}@${profile.version}; offline Plan, no plugin/CLI dependency`)
