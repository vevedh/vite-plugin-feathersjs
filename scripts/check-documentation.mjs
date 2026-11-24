import assert from 'node:assert/strict'
import { readFileSync, lstatSync, readdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const read=p=>readFileSync(join(root,p),'utf8')
const config=read('docs/.vitepress/config.mts')
assert.match(config,/srcDir:\s*['"]\.\/site['"]/)
assert.doesNotMatch(config,/ignoreDeadLinks:\s*true/)
assert.equal(JSON.parse(read('docs/package.json')).devDependencies.vitepress,'1.6.4')
assert.ok(lstatSync(join(root,'docs/pnpm-lock.yaml')).isFile())
for(const line of ['docs-private/','.ai/','.release/']) assert.ok(read('.gitignore').split(/\r?\n/).includes(line))
for(const p of ['index.md','guide/demarrage.md','guide/exemples.md','guide/configuration.md','reference/lexique.md','guide/release.md']) assert.ok(lstatSync(join(root,'docs/site',p)).isFile())
let count=0
function walk(dir){ for(const e of readdirSync(dir,{withFileTypes:true})){ const p=join(dir,e.name); assert.ok(!e.isSymbolicLink()); if(e.isDirectory())walk(p);else if(e.isFile()&&e.name.endsWith('.md')){const text=readFileSync(p,'utf8'); assert.doesNotMatch(text,/docs-private|patch-memory|\.ai\//i); count++} } }
walk(join(root,'docs/site')); console.log(`PUBLIC_DOCS_SOURCE=PASS | PAGES=${count} | LINKS_REQUIRE_VITEPRESS_BUILD`)
