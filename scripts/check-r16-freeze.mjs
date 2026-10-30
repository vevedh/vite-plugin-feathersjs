#!/usr/bin/env node
/** R16 certification source snapshot verification; no package installation required. */
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const m = JSON.parse(readFileSync(resolve(root,'docs-private/maintenance/r16-freeze-manifest.json'),'utf8'))
let mismatches = 0
for (const [rel, expected] of Object.entries(m.frozen_files)) {
  const full = resolve(root, rel)
  if (!existsSync(full)) { console.error(`MISSING ${rel}`); mismatches++;continue }
  const got = createHash('sha256').update(readFileSync(full)).digest('hex')
  if (got !== expected) { console.error(`MODIFIED ${rel}`); mismatches++ }
}
if (mismatches) { console.error(`FAIL: R16 frozen files diverged (${mismatches})`);process.exitCode = 1 }
else console.log(`PASS: R16 source snapshot (${Object.keys(m.frozen_files).length} local files). Registry publish is verified separately.`)
