import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { boundedEnvInteger, boundedEnvChoice } from './e2e-env.mjs'

for (const blank of [undefined, '', '   ', '\t']) {
  assert.equal(boundedEnvInteger(blank, 'FEATHERS_E2E_RUNS', 1, 1, 5), 1)
  assert.equal(boundedEnvInteger(blank, 'FEATHERS_R8_RUNS', 3, 1, 5), 3)
}
for (const good of ['1', '3', '5', ' 2 ']) {
  assert.equal(boundedEnvInteger(good, 'FEATHERS_E2E_RUNS', 1, 1, 5), Number(good))
}
for (const bad of ['0', '-1', '6', '2.5', 'NaN', '1e2', 'Infinity', '1abc']) {
  assert.throws(() => boundedEnvInteger(bad, 'FEATHERS_E2E_RUNS', 1, 1, 5), /Invalid FEATHERS_E2E_RUNS/)
}
assert.match(readFileSync(new URL('./e2e-launch-env.mjs', import.meta.url), 'utf8'), /FEATHERS_R10_CONFIG_LOADER: 'bundle'/)
console.log('PASS: bounded benchmark environment settings, optional config loader and pinned HTML gate')

const loaders = ['bundle', 'runner']
for (const blank of [undefined, '', '   ', '\t']) {
  assert.equal(boundedEnvChoice(blank, 'FEATHERS_R10_CONFIG_LOADER', 'bundle', loaders), 'bundle')
}
for (const option of loaders) {
  assert.equal(boundedEnvChoice(` ${option} `, 'FEATHERS_R10_CONFIG_LOADER', 'bundle', loaders), option)
}
for (const wrong of ['native', 'none', '1', 'bun', 'BUNDLE']) {
  assert.throws(() => boundedEnvChoice(wrong, 'FEATHERS_R10_CONFIG_LOADER', 'bundle', loaders), /Invalid FEATHERS_R10_CONFIG_LOADER/)
}
