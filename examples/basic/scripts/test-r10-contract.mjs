import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const code = readFileSync(new URL('./check-basic-e2e.mjs', import.meta.url), 'utf8')
assert.match(code, /FEATHERS_R10_CONFIG_LOADER/)
assert.match(code, /\['bundle', 'runner'\]/)
assert.match(code, /'--configLoader', viteConfigLoader/)
assert.match(code, /configLoader: viteConfigLoader/)
console.log('PASS: R10 config loader selection contract')
