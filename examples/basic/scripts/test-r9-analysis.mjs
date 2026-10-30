import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const source = await readFile(new URL('./analyze-r9.mjs', import.meta.url), 'utf8')
assert.match(source, /beforeConfigPercent/)
assert.match(source, /medianBeforeConfigMs/)
assert.match(source, /feathers\.transport\.ready/)
console.log('PASS: R9 phase analysis contract')
