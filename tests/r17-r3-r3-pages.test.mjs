import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'

test('GitHub Pages whitelist contract is validated offline',()=>{
 const output=execFileSync(process.execPath,['scripts/r17/check-pages-publication.mjs'],{encoding:'utf8'})
 assert.match(output,/PASS: 22 clean VitePress source files/)
})
test('Windows GitHub publication is review-only unless -Push is specified',()=>{
 const script=readFileSync('scripts/r17/certify-and-stage-pages-windows.ps1','utf8')
 const preparation=readFileSync('scripts/r17/prepare-gh-pages-branch.ps1','utf8')
 assert.match(script,/\[switch\]\$Push/)
 assert.match(script,/prepare-gh-pages-branch\.ps1/)
 assert.match(preparation,/if\(\$Push\)/)
 assert.match(preparation,/git add -- \.github\/workflows\/cli-vitepress-pages\.yml docs\/cli/)
 assert.doesNotMatch(preparation,/git add\s+\./)
})
